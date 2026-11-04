import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { STATES, transitionProspect, canTransition, type AcqState } from './lifecycle';
import { enqueueAcqTask, cancelAcqTasks } from './tasks/queue';
import { addSuppression } from './suppression';
import { eraseContacts, storeContact, isEmail } from './contacts';
import { usageToday } from './budget';
import { ACTIVATION } from './activation';
import { crawlerIdentity } from './web/fetcher';
import { placesActivation } from './places/adapter';
import { getIndustry } from './config/registry';
import { blockDrafts, pitchReadiness } from './drafts';
import { clinicTimeline } from './agents';

/**
 * Admin-side reads and actions behind the /api/acquisition routes. Every
 * function is scoped to the calling admin's userId. Nothing here sends,
 * drafts or contacts anyone.
 */

export class AdminActionError extends Error {}

export async function listProspects(userId: string, q: { state?: string; band?: string; search?: string; page?: number }) {
  const page = Math.max(1, Math.min(1000, q.page ?? 1));
  const where: Record<string, unknown> = { userId };
  if (q.state && (STATES as readonly string[]).includes(q.state)) where.state = q.state;
  const acq = await prisma.acquisitionProspect.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 500 });
  const prospectIds = acq.map((a: { prospectId: string }) => a.prospectId);
  const [prospects, scores, contacts] = await Promise.all([
    prisma.prospect.findMany({ where: { userId, id: { in: prospectIds } }, select: { id: true, businessName: true } }),
    prisma.acquisitionScore.findMany({ where: { userId, acqProspectId: { in: acq.map((a: { id: string }) => a.id) } }, orderBy: { computedAt: 'desc' } }),
    prisma.acquisitionDecisionMaker.findMany({ where: { userId, acqProspectId: { in: acq.map((a: { id: string }) => a.id) } }, select: { acqProspectId: true, kind: true } }),
  ]);
  const nameOf = new Map(prospects.map((p: { id: string; businessName: string }) => [p.id, p.businessName]));
  const latest = new Map<string, { total: number; band: string; coverage: number; contactability: string; eligible: boolean }>();
  for (const s of scores as Array<{ acqProspectId: string; total: number; band: string; coverage: number; contactability: string; eligible: boolean }>) {
    if (!latest.has(s.acqProspectId)) latest.set(s.acqProspectId, s);
  }
  let items = acq.map((a: { id: string; prospectId: string; state: string; area: string | null; orgDomain: string | null; crmConflict: string | null; lastScoredAt: Date | null; updatedAt: Date }) => ({
    id: a.id, name: nameOf.get(a.prospectId) ?? '(unknown)', state: a.state, area: a.area, domain: a.orgDomain,
    crmConflict: a.crmConflict, lastScoredAt: a.lastScoredAt, updatedAt: a.updatedAt,
    score: latest.get(a.id) ?? null,
    contactPoints: contacts.filter((c: { acqProspectId: string }) => c.acqProspectId === a.id).length,
  }));
  if (q.band) items = items.filter((i) => i.score?.band === q.band);
  if (q.search) {
    const s = q.search.toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(s) || (i.domain ?? '').includes(s));
  }
  const PAGE = 50;
  return { total: items.length, page, items: items.slice((page - 1) * PAGE, page * PAGE) };
}

export async function getProspectDetail(userId: string, acqProspectId: string) {
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  if (!acq) return null;
  const where = { userId, acqProspectId };
  const [prospect, sources, signals, findings, scores, recs, contacts, events, tasks, timeline, readiness] = await Promise.all([
    prisma.prospect.findFirst({ where: { id: acq.prospectId, userId }, select: { businessName: true, businessData: true, stage: true } }),
    prisma.acquisitionSource.findMany({ where, orderBy: { fetchedAt: 'desc' } }),
    prisma.acquisitionSignal.findMany({ where, orderBy: { observedAt: 'desc' } }),
    prisma.acquisitionFinding.findMany({ where, orderBy: { category: 'asc' } }),
    prisma.acquisitionScore.findMany({ where, orderBy: { computedAt: 'desc' }, take: 5 }),
    prisma.acquisitionRecommendation.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1 }),
    prisma.acquisitionDecisionMaker.findMany({ where, orderBy: { createdAt: 'asc' } }),
    prisma.acquisitionPipelineEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.acquisitionTask.findMany({ where: { userId, acqProspectId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, type: true, status: true, attempts: true, error: true, createdAt: true, completedAt: true } }),
    clinicTimeline(userId, acqProspectId),
    pitchReadiness(userId, acqProspectId),
  ]);
  const data = (prospect?.businessData ?? {}) as { website?: string };
  return {
    prospect: { ...acq, name: prospect?.businessName ?? '(unknown)', website: data.website ?? null, crmStage: prospect?.stage ?? null },
    sources, signals, findings, scores, recommendation: recs[0] ?? null, contacts, events, tasks, timeline, pitchReadiness: readiness,
    labels: { scoreIsEstimate: true, offerNotice: 'Internal: offer not yet approved for sale' },
  };
}

export const ActionSchema = z.strictObject({
  action: z.enum(['rescore', 'reaudit', 'needs_review', 'disqualify', 'suppress_domain', 'block_crawling', 'erase_contacts']),
  reason: z.string().trim().min(3).max(500),
});

export async function runAction(userId: string, actor: string, acqProspectId: string, body: unknown) {
  const { action, reason } = ActionSchema.parse(body);
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  if (!acq) throw new AdminActionError('Prospect not found');
  const runKey = `${action}-${Date.now()}`;
  const event = (to: string) => prisma.acquisitionPipelineEvent.create({ data: { userId, acqProspectId, fromState: acq.state, toState: to, reason: `${action}: ${reason}`, actor } });

  switch (action) {
    case 'rescore':
      await enqueueAcqTask({ userId, type: 'acq.strategize', acqProspectId, input: { industryKey: acq.industryKey, runKey } });
      await event(acq.state);
      return { ok: true, queued: 'acq.strategize' };
    case 'reaudit':
      await enqueueAcqTask({ userId, type: 'acq.audit', acqProspectId, input: { industryKey: acq.industryKey, runKey } });
      await event(acq.state);
      return { ok: true, queued: 'acq.audit' };
    case 'needs_review':
    case 'disqualify': {
      const to: AcqState = action === 'needs_review' ? 'needs_review' : 'disqualified';
      if (!canTransition(acq.state, to)) throw new AdminActionError(`Cannot move from ${acq.state} to ${to}`);
      await transitionProspect({ userId, acqProspectId, to, reason, actor });
      if (to === 'disqualified') await cancelAcqTasks(userId, acqProspectId, 'disqualified');
      return { ok: true, state: to };
    }
    case 'suppress_domain':
    case 'block_crawling': {
      if (!acq.orgDomain) throw new AdminActionError('This prospect has no website domain');
      await addSuppression({ userId, kind: action === 'suppress_domain' ? 'domain' : 'crawl_domain', value: acq.orgDomain, reason: action === 'suppress_domain' ? 'objection' : 'manual', source: `admin:${actor}` });
      if (action === 'suppress_domain') {
        await cancelAcqTasks(userId, acqProspectId, 'suppressed');
        await blockDrafts(userId, acqProspectId, `domain suppressed: ${reason}`, actor);
        if (canTransition(acq.state, 'suppressed')) await transitionProspect({ userId, acqProspectId, to: 'suppressed', reason, actor });
      } else {
        await event(acq.state);
      }
      return { ok: true };
    }
    case 'erase_contacts': {
      const r = await eraseContacts({ userId, acqProspectId, reason: 'erasure', actor, domain: acq.orgDomain });
      return { ok: true, ...r };
    }
  }
}

export const ManualContactSchema = z.strictObject({
  acqProspectId: z.string().min(1),
  name: z.string().trim().min(2).max(150),
  role: z.string().trim().max(150).optional(),
  email: z.string().trim().max(200).optional().refine((v) => !v || isEmail(v), 'invalid email'),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().min(3).max(500),
  sourceUrl: z.string().trim().max(500).optional().refine((v) => !v || /^https?:\/\//i.test(v), 'sourceUrl must be http(s)'),
  lawfulBasis: z.enum(['legitimate_interest_b2b', 'consent']),
  confidence: z.enum(['low', 'medium', 'high']),
  attest: z.literal(true),
});

export async function addManualContact(userId: string, actor: string, body: unknown) {
  const d = ManualContactSchema.parse(body);
  if (/google|maps|places/i.test(`${d.source} ${d.sourceUrl ?? ''}`)) throw new AdminActionError('Contacts copied from Google Maps / Places may not be stored');
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: d.acqProspectId, userId } });
  if (!acq) throw new AdminActionError('Prospect not found');
  const industry = getIndustry(acq.industryKey);
  const res = await storeContact({
    userId, acqProspectId: acq.id, kind: 'manual_named', name: d.name, role: d.role, email: d.email, phone: d.phone,
    sourceUrl: d.sourceUrl, sourceNote: `manual (${actor}): ${d.source}`, confidence: d.confidence, lawfulBasis: d.lawfulBasis,
    retainDays: industry?.retention.inactiveContactDays,
  });
  if (!res.stored) throw new AdminActionError(res.reason === 'suppressed' ? 'This contact is suppressed or was erased and cannot be added' : res.reason === 'exists' ? 'This contact already exists' : 'Invalid contact');
  await prisma.acquisitionPipelineEvent.create({ data: { userId, acqProspectId: acq.id, fromState: acq.state, toState: acq.state, reason: 'Named contact added manually (details in Contacts)', actor } });
  return { ok: true, id: res.id };
}

export async function deleteContact(userId: string, actor: string, contactId: string) {
  const c = await prisma.acquisitionDecisionMaker.findFirst({ where: { id: contactId, userId } });
  if (!c) throw new AdminActionError('Contact not found');
  await prisma.acquisitionDecisionMaker.deleteMany({ where: { id: contactId, userId } });
  await prisma.acquisitionPipelineEvent.create({ data: { userId, acqProspectId: c.acqProspectId, fromState: 'n/a', toState: 'n/a', reason: `Contact record deleted (${c.kind})`, actor } });
  return { ok: true };
}

export async function listRuns(userId: string) {
  return prisma.acquisitionAgentRun.findMany({
    where: { userId }, orderBy: { startedAt: 'desc' }, take: 100,
    select: { id: true, taskId: true, agent: true, attempt: true, status: true, provider: true, model: true, durationMs: true, error: true, startedAt: true },
  });
}

export async function overview(userId: string) {
  const [prospects, scores, contacts, dead, batches] = await Promise.all([
    prisma.acquisitionProspect.findMany({ where: { userId }, select: { id: true, state: true, crmConflict: true } }),
    prisma.acquisitionScore.findMany({ where: { userId }, orderBy: { computedAt: 'desc' }, select: { acqProspectId: true, band: true } }),
    prisma.acquisitionDecisionMaker.findMany({ where: { userId }, select: { kind: true } }),
    prisma.acquisitionTask.count({ where: { userId, status: 'dead' } }),
    prisma.acquisitionImportBatch.count({ where: { userId } }),
  ]);
  const byState: Record<string, number> = {};
  for (const p of prospects as Array<{ state: string }>) byState[p.state] = (byState[p.state] ?? 0) + 1;
  const seen = new Set<string>();
  const byBand: Record<string, number> = {};
  for (const s of scores as Array<{ acqProspectId: string; band: string }>) {
    if (seen.has(s.acqProspectId)) continue;
    seen.add(s.acqProspectId);
    byBand[s.band] = (byBand[s.band] ?? 0) + 1;
  }
  const byContactKind: Record<string, number> = {};
  for (const c of contacts as Array<{ kind: string }>) byContactKind[c.kind] = (byContactKind[c.kind] ?? 0) + 1;
  const crawler = crawlerIdentity();
  return {
    // Actual counts (results) vs estimates are labelled separately in the UI.
    results: { prospects: prospects.length, byState, contactPoints: byContactKind, crmConflicts: prospects.filter((p: { crmConflict: string | null }) => p.crmConflict).length, deadTasks: dead, importBatches: batches },
    estimates: { scoredProspectsByBand: byBand },
    budgets: await usageToday(),
    activation: {
      switches: ACTIVATION,
      crawler: crawler.ok ? 'configured' : crawler.reason,
      places: placesActivation().reasons,
      sending: 'disabled: no delivery adapter; drafts can reach "ready" at most',
    },
  };
}
