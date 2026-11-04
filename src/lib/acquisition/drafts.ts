import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getIndustry, getOffer } from './config/registry';
import type { IndustryConfig } from './config/schema';
import { activeSignals } from './signals';
import { findSuppressionHits } from './suppression';
import { canTransition, transitionProspect, TERMINAL } from './lifecycle';
import { buildPitch, type PitchRefusal, type CitedEvidence, type ReviewerNote } from './pitch';
import { currentEvidence, offerHashOf } from './draftEvidence';
import { checkDraftForDelivery, draftHash, evaluateDraftGate, type GateBlock, type GateBlockCode } from './gate';

/**
 * The human review queue for acquisition pitch drafts. Every draft is
 * generated deterministically (pitch.ts), bound to the evidence and offer
 * versions it was built from, and moves only through these statuses:
 *
 *   pending_approval → approved → ready
 *        ↑   edit          │ edit   │ edit
 *        └─────────────────┴────────┘
 *   any active → rejected | stale | superseded | blocked
 *
 * "ready" is the furthest a draft can go in this phase: it means a human
 * approved this exact text for these exact evidence and offer versions, and
 * every gate rule except the delivery-time ones (sender identity, live
 * sending, daily cap) passes. Nothing here sends anything.
 */

export class DraftError extends Error {}

export const ACTIVE_DRAFT = ['pending_approval', 'approved', 'ready'];
// Gate rules that can only pass at delivery time, which doesn't exist yet.
export const DELIVERY_TIME_CODES: GateBlockCode[] = ['sender_identity_missing', 'live_sending_disabled', 'daily_cap_reached'];
// Rules not applied when approving the wording (approval is what's being given,
// and an unapproved offer may be reviewed for wording but never marked ready).
const NOT_AT_APPROVAL: GateBlockCode[] = ['not_approved', 'approval_stale', 'offer_unconfigured', ...DELIVERY_TIME_CODES];

export interface Reason { code: string; detail: string }

interface DraftRow {
  id: string; userId: string; acqProspectId: string; channel: string; recipientDmId: string | null;
  subject: string | null; body: string; evidenceFindingIds: unknown; offerId: string; status: string;
  riskFlags: unknown; gateResult: unknown; version: number; idempotencyKey: string; createdAt: Date; updatedAt: Date;
  evidenceSignalIds: unknown; evidenceHash: string | null; offerHash: string | null; offerConfigVersion: number | null;
  industryConfigVersion: number | null; readiness: unknown; statusReason: string | null;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

async function loadProspect(userId: string, acqProspectId: string) {
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  if (!acq) throw new DraftError('Prospect not found');
  const industry = getIndustry(acq.industryKey);
  if (!industry) throw new DraftError(`Unknown industry "${acq.industryKey}"`);
  const prospect = await prisma.prospect.findFirst({ where: { id: acq.prospectId, userId }, select: { businessName: true } });
  return { acq, industry, businessName: prospect?.businessName ?? '(unknown)' };
}

async function latestRecommendation(userId: string, acqProspectId: string) {
  return prisma.acquisitionRecommendation.findFirst({ where: { userId, acqProspectId }, orderBy: { createdAt: 'desc' } });
}

/** Moves the prospect back to `strategized` when it has no active draft left. */
async function rewindProspect(userId: string, acqProspectId: string, reason: string, actor: string) {
  const remaining = await prisma.acquisitionDraft.count({ where: { userId, acqProspectId, status: { in: ACTIVE_DRAFT } } });
  if (remaining > 0) return;
  const cur = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId }, select: { state: true } });
  if (cur?.state === 'approved') await transitionProspect({ userId, acqProspectId, to: 'draft_pending_approval', reason, actor });
  const now = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId }, select: { state: true } });
  if (now?.state === 'draft_pending_approval') await transitionProspect({ userId, acqProspectId, to: 'strategized', reason, actor });
}

async function record(userId: string, draftId: string, action: string, actorEmail: string, extra: Partial<{ note: string; bodyHashBefore: string; bodyHashAfter: string; evidenceHash: string | null; offerHash: string | null }> = {}) {
  await prisma.acquisitionApproval.create({
    data: { userId, draftId, action, actorEmail, note: extra.note?.slice(0, 1000) ?? null, bodyHashBefore: extra.bodyHashBefore ?? null, bodyHashAfter: extra.bodyHashAfter ?? null, evidenceHash: extra.evidenceHash ?? null, offerHash: extra.offerHash ?? null },
  });
}

/**
 * Moves a draft from one status to another only if it is still in `from` and,
 * when `version` is given, still at that version. Review actions pass the
 * version they read, so a decision can never attach to text it did not see
 * (e.g. an Approve that races an edit still saving).
 */
async function setStatus(userId: string, draftId: string, from: string[], data: Record<string, unknown>, version?: number) {
  const where: Record<string, unknown> = { id: draftId, userId, status: { in: from } };
  if (version !== undefined) where.version = version;
  const res = await prisma.acquisitionDraft.updateMany({ where, data });
  if (res.count === 0) throw new DraftError('The draft changed while you were working on it; reload and try again');
}

// ─── Generation ─────────────────────────────────────────────────────────────

export type GenerateResult = { ok: true; draftId: string; version: number; warnings: string[] } | { ok: false; reasons: PitchRefusal[] };

/**
 * Loads everything a pitch needs and runs the deterministic template once.
 * Used both to generate a draft and, as a dry run, to explain up front why a
 * pitch can or can't be produced yet. Writes nothing.
 */
async function preparePitch(userId: string, acqProspectId: string, opts: { recipientDmId?: string; offerId?: string } = {}) {
  const { acq, industry, businessName } = await loadProspect(userId, acqProspectId);
  const [signals, findings, rec, contacts] = await Promise.all([
    activeSignals(userId, acq.id),
    prisma.acquisitionFinding.findMany({ where: { userId, acqProspectId: acq.id } }),
    latestRecommendation(userId, acq.id),
    prisma.acquisitionDecisionMaker.findMany({ where: { userId, acqProspectId: acq.id }, orderBy: { createdAt: 'asc' } }),
  ]);
  const offerId = opts.offerId ?? rec?.primaryOfferId ?? 'none';
  const offer = getOffer(industry, offerId);
  type Contact = { id: string; kind: string; name: string | null; email: string | null; flags: unknown };
  const withEmail = (contacts as Contact[]).filter((c) => c.email);
  const recipient = opts.recipientDmId
    ? (contacts as Contact[]).find((c) => c.id === opts.recipientDmId) ?? null
    : withEmail.find((c) => c.kind === 'role_inbox' && !(c.flags as { duplicateOf?: string } | null)?.duplicateOf) ?? null;
  if (opts.recipientDmId && !recipient) throw new DraftError('Recipient not found on this prospect');
  const hits = recipient?.email || acq.orgDomain
    ? await findSuppressionHits(userId, { email: recipient?.email ?? undefined, domain: acq.orgDomain ?? undefined })
    : [];

  const now = new Date();
  const pitch = buildPitch({
    industry, offer, businessName, domain: acq.orgDomain, prospectState: acq.state,
    recommendedOfferId: rec?.primaryOfferId ?? null,
    signals: signals as never, findings: findings as never,
    recipient, recipientSuppressed: hits.length > 0, now,
  });
  return { acq, industry, offer, rec, recipient, hits, pitch, now };
}

export async function generateDraft(userId: string, actor: string, acqProspectId: string, opts: { recipientDmId?: string; offerId?: string } = {}): Promise<GenerateResult> {
  const { acq, industry, offer, pitch, now } = await preparePitch(userId, acqProspectId, opts);
  if (!pitch.ok) return pitch;

  const evidence = await currentEvidence(userId, acq.id, pitch.citedSignalIds, industry, now);
  const offerHash = offerHashOf(offer!);

  // A new draft replaces any active one for this prospect.
  const active = await prisma.acquisitionDraft.findMany({ where: { userId, acqProspectId: acq.id, status: { in: ACTIVE_DRAFT } } });
  for (const d of active as DraftRow[]) {
    await setStatus(userId, d.id, ACTIVE_DRAFT, { status: 'superseded', statusReason: 'Replaced by a newer draft', readiness: Prisma.DbNull });
    await record(userId, d.id, 'regenerate', actor, { note: 'Superseded by a newly generated draft' });
  }
  const last = await prisma.acquisitionDraft.findFirst({ where: { userId, acqProspectId: acq.id }, orderBy: { version: 'desc' } });
  const version = ((last as DraftRow | null)?.version ?? 0) + 1;

  const draft = await prisma.acquisitionDraft.create({
    data: {
      userId, acqProspectId: acq.id, channel: 'email', recipientDmId: pitch.recipientDmId,
      subject: pitch.subject, body: pitch.body, offerId: offer!.id, status: 'pending_approval',
      evidenceFindingIds: pitch.citedFindingIds as Prisma.InputJsonValue,
      evidenceSignalIds: pitch.citedSignalIds as Prisma.InputJsonValue,
      evidenceHash: evidence.hash, offerHash,
      offerConfigVersion: offer!.configVersion ?? null, industryConfigVersion: industry.version,
      riskFlags: { warnings: pitch.warnings, cited: pitch.cited, inferred: pitch.inferred, unknown: pitch.unknown, generator: 'template-v1' } as unknown as Prisma.InputJsonValue,
      version, idempotencyKey: `pitch:${acq.id}:v${version}`,
      statusReason: offer!.status === 'approved' ? null : `${offer!.name} is not approved for sale`,
    },
  });

  if (acq.state === 'strategized' || acq.state === 'approved') {
    await transitionProspect({ userId, acqProspectId: acq.id, to: 'draft_pending_approval', reason: `Pitch draft v${version} generated for review`, actor });
  } else {
    await prisma.acquisitionPipelineEvent.create({ data: { userId, acqProspectId: acq.id, fromState: acq.state, toState: acq.state, reason: `Pitch draft v${version} generated for review`, actor } });
  }
  return { ok: true, draftId: draft.id, version, warnings: pitch.warnings };
}

// ─── Pitch readiness (dry run) ──────────────────────────────────────────────

export interface ReadinessCheck { label: string; ok: boolean; detail: string; blocking: boolean }

/**
 * Says, before anyone clicks Generate, what is in place and what is missing for
 * a pitch. Same rules and the same loader as generateDraft, so the answer can't
 * drift from what generation will actually do. Nothing is written.
 */
export async function pitchReadiness(userId: string, acqProspectId: string) {
  const { acq, industry, offer, rec, recipient, hits, pitch } = await preparePitch(userId, acqProspectId);
  const score = await prisma.acquisitionScore.findFirst({ where: { userId, acqProspectId }, orderBy: { computedAt: 'desc' } });
  const refusal = (...codes: string[]) => (pitch.ok ? [] : pitch.reasons.filter((r) => codes.includes(r.code)));
  const detailOf = (rs: Array<{ detail: string }>, ok: string) => (rs.length ? rs.map((r) => r.detail).join('; ') : ok);
  const min = offer?.evidenceRequirement?.minObservedWeaknesses ?? 1;

  const checks: ReadinessCheck[] = [
    { label: 'Clinic is eligible and in a pitchable state', ok: refusal('prospect_state').length === 0, blocking: true,
      detail: detailOf(refusal('prospect_state'), `State: ${acq.state}${score ? `; fit ${score.band}, ${score.eligible ? 'eligible' : 'needs review'}` : ''}`) },
    { label: 'An offer is recommended', ok: refusal('no_recommendation', 'offer_unknown', 'offer_not_recommended', 'no_pitch_template').length === 0, blocking: true,
      detail: detailOf(refusal('no_recommendation', 'offer_unknown', 'offer_not_recommended', 'no_pitch_template'), `${rec?.primaryOfferId ?? 'none'}`) },
    { label: `At least ${min} fresh, observed weakness for that offer`, ok: refusal('insufficient_evidence').length === 0, blocking: true,
      detail: detailOf(refusal('insufficient_evidence'), 'Evidence is sufficient') },
    { label: 'A clinic email contact exists', ok: refusal('no_recipient').length === 0, blocking: true,
      detail: detailOf(refusal('no_recipient'), recipient ? `${recipient.kind}` : 'ok') },
    { label: 'Contact and domain are not suppressed', ok: hits.length === 0, blocking: true,
      detail: hits.length ? `Suppressed: ${hits.join(', ')}` : 'Not suppressed' },
    { label: 'Offer is approved for sale', ok: offer?.status === 'approved', blocking: false,
      detail: offer?.status === 'approved' ? 'Approved' : `${offer?.name ?? 'The offer'} is not approved: a pitch can be reviewed but never marked ready` },
  ];
  const canGenerate = pitch.ok;
  return {
    canGenerate,
    canBeMarkedReady: canGenerate && offer?.status === 'approved',
    checks,
    // The industry's own requirement, so the UI can say which signals would help.
    helpfulSignals: pitch.ok ? [] : Array.from(new Set(
      // The recommended offer's requirement, or, before any offer is recommended, every offer that has one.
      (offer?.evidenceRequirement ? [offer] : industry.offers.filter((o) => o.evidenceRequirement))
        .flatMap((o) => o.evidenceRequirement!.categories)
        .flatMap((c) => industry.opportunityCategories.find((x) => x.id === c)?.signalRules.filter((r) => r.weight > 0).map((r) => r.signal) ?? []),
    )),
  };
}

// ─── Validity ───────────────────────────────────────────────────────────────

export interface Validity { valid: boolean; reasons: Reason[]; evidenceHash: string | null; offerHash: string | null }

/** Re-checks that what the draft was built from is still true now. */
export async function draftValidity(userId: string, draft: DraftRow, industry?: IndustryConfig, now = new Date()): Promise<Validity> {
  const reasons: Reason[] = [];
  const add = (code: string, detail: string) => reasons.push({ code, detail });
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: draft.acqProspectId, userId } });
  if (!acq) return { valid: false, reasons: [{ code: 'prospect_missing', detail: 'Prospect no longer exists' }], evidenceHash: null, offerHash: null };
  const ind = industry ?? getIndustry(acq.industryKey);
  if (!ind) return { valid: false, reasons: [{ code: 'industry_missing', detail: acq.industryKey }], evidenceHash: null, offerHash: null };
  if ((TERMINAL as string[]).includes(acq.state)) add('prospect_inactive', `Prospect is ${acq.state}`);

  const offer = getOffer(ind, draft.offerId);
  const offerHash = offer ? offerHashOf(offer) : null;
  if (!offer) add('offer_missing', `Offer "${draft.offerId}" is no longer in the catalogue`);
  else if (draft.offerHash !== offerHash) add('offer_changed', 'The offer configuration has changed since the draft was generated');

  const cited = strings(draft.evidenceSignalIds);
  let evidenceHash: string | null = null;
  if (cited.length === 0) add('no_evidence_binding', 'The draft is not bound to any evidence');
  else {
    const ev = await currentEvidence(userId, acq.id, cited, ind, now);
    evidenceHash = ev.hash;
    if (ev.missing.length) add('evidence_removed', `${ev.missing.length} cited signal(s) no longer exist`);
    if (ev.superseded.length) add('evidence_changed', `${ev.superseded.length} cited signal(s) were superseded by newer evidence`);
    if (ev.stale.length) add('evidence_stale', `${ev.stale.length} cited signal(s) are past the ${ind.retention.signalStaleDays}-day freshness limit`);
    if (!ev.missing.length && !ev.superseded.length && ev.hash !== draft.evidenceHash) add('evidence_changed', 'The cited evidence has changed');
  }
  const findingIds = strings(draft.evidenceFindingIds);
  if (findingIds.length) {
    const found = await prisma.acquisitionFinding.count({ where: { userId, acqProspectId: acq.id, id: { in: findingIds } } });
    if (found !== findingIds.length) add('finding_removed', 'A cited finding no longer applies');
  }
  const rec = await latestRecommendation(userId, acq.id);
  if (!rec || rec.primaryOfferId !== draft.offerId) add('recommendation_changed', `The current recommendation is ${rec?.primaryOfferId ?? 'none'}`);

  if (draft.recipientDmId) {
    const r = await prisma.acquisitionDecisionMaker.findFirst({ where: { id: draft.recipientDmId, userId, acqProspectId: acq.id } });
    if (!r) add('recipient_removed', 'The recipient contact was deleted');
    const hits = await findSuppressionHits(userId, { email: r?.email ?? undefined, domain: acq.orgDomain ?? undefined });
    if (hits.length) add('suppressed', `Suppressed: ${hits.join(', ')}`);
  }
  return { valid: reasons.length === 0, reasons, evidenceHash, offerHash };
}

/**
 * Marks every active draft of a prospect that no longer matches its evidence,
 * offer or recommendation as stale. Called after research re-runs, after
 * manual evidence is added, and before any approval or readiness decision.
 */
export async function invalidateStaleDrafts(userId: string, acqProspectId: string, cause: string): Promise<number> {
  const drafts = await prisma.acquisitionDraft.findMany({ where: { userId, acqProspectId, status: { in: ACTIVE_DRAFT } } }) as DraftRow[];
  let n = 0;
  for (const d of drafts) {
    const v = await draftValidity(userId, d);
    if (v.valid) continue;
    const blocked = v.reasons.some((r) => r.code === 'suppressed' || r.code === 'prospect_inactive');
    const res = await prisma.acquisitionDraft.updateMany({
      where: { id: d.id, userId, status: { in: ACTIVE_DRAFT } },
      data: { status: blocked ? 'blocked' : 'stale', statusReason: v.reasons.map((r) => r.detail).join('; ').slice(0, 2000), readiness: Prisma.DbNull },
    });
    if (res.count === 0) continue;
    await record(userId, d.id, 'invalidate', 'system', { note: `${cause}: ${v.reasons.map((r) => r.code).join(', ')}` });
    n++;
  }
  if (n > 0) {
    const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId }, select: { state: true } });
    if (acq && !(TERMINAL as string[]).includes(acq.state)) await rewindProspect(userId, acqProspectId, `Draft invalidated (${cause})`, 'system');
  }
  return n;
}

/** Blocks every active draft (suppression, objection, erasure). */
export async function blockDrafts(userId: string, acqProspectId: string, reason: string, actor: string, opts: { erase?: boolean } = {}): Promise<number> {
  const where: Record<string, unknown> = { userId, acqProspectId };
  if (!opts.erase) where.status = { in: ACTIVE_DRAFT };
  const drafts = await prisma.acquisitionDraft.findMany({ where }) as DraftRow[];
  let n = 0;
  for (const d of drafts) {
    const data: Record<string, unknown> = opts.erase
      ? { status: d.status === 'sent' ? 'sent' : 'invalidated', subject: '[erased with contacts]', body: '[erased with contacts]', riskFlags: Prisma.DbNull, gateResult: Prisma.DbNull, readiness: Prisma.DbNull, recipientDmId: null, statusReason: reason }
      : { status: 'blocked', statusReason: reason, readiness: Prisma.DbNull };
    await prisma.acquisitionDraft.updateMany({ where: { id: d.id, userId }, data });
    if (opts.erase || ACTIVE_DRAFT.includes(d.status)) await record(userId, d.id, 'invalidate', actor, { note: reason });
    n++;
  }
  return n;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listDrafts(userId: string, q: { status?: string } = {}) {
  const where: Record<string, unknown> = { userId };
  if (q.status) where.status = q.status;
  const drafts = await prisma.acquisitionDraft.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 }) as DraftRow[];
  const acqs = await prisma.acquisitionProspect.findMany({ where: { userId, id: { in: drafts.map((d) => d.acqProspectId) } }, select: { id: true, prospectId: true, state: true } });
  const names = await prisma.prospect.findMany({ where: { userId, id: { in: acqs.map((a: { prospectId: string }) => a.prospectId) } }, select: { id: true, businessName: true } });
  const nameOf = new Map(names.map((p: { id: string; businessName: string }) => [p.id, p.businessName]));
  const acqOf = new Map(acqs.map((a: { id: string; prospectId: string; state: string }) => [a.id, a]));
  const items = [];
  for (const d of drafts) {
    const a = acqOf.get(d.acqProspectId) as { prospectId: string; state: string } | undefined;
    const validity = ACTIVE_DRAFT.includes(d.status) ? await draftValidity(userId, d) : null;
    items.push({
      id: d.id, acqProspectId: d.acqProspectId, prospectName: a ? nameOf.get(a.prospectId) ?? '(unknown)' : '(unknown)', prospectState: a?.state ?? null,
      status: d.status, statusReason: d.statusReason, version: d.version, offerId: d.offerId, subject: d.subject, updatedAt: d.updatedAt,
      valid: validity?.valid ?? null, invalidReasons: validity?.reasons ?? [],
    });
  }
  return { items };
}

export async function getDraftDetail(userId: string, draftId: string) {
  const d = await prisma.acquisitionDraft.findFirst({ where: { id: draftId, userId } }) as DraftRow | null;
  if (!d) return null;
  const { acq, industry, businessName } = await loadProspect(userId, d.acqProspectId);
  const offer = getOffer(industry, d.offerId);
  const meta = (d.riskFlags ?? {}) as { cited?: CitedEvidence[]; inferred?: ReviewerNote[]; unknown?: ReviewerNote[]; warnings?: string[] };
  const cited = strings(d.evidenceSignalIds);
  const [signals, approvals, recipient, events] = await Promise.all([
    cited.length ? prisma.acquisitionSignal.findMany({ where: { userId, acqProspectId: acq.id, id: { in: cited } } }) : Promise.resolve([]),
    prisma.acquisitionApproval.findMany({ where: { userId, draftId: d.id }, orderBy: { createdAt: 'asc' } }),
    d.recipientDmId ? prisma.acquisitionDecisionMaker.findFirst({ where: { id: d.recipientDmId, userId } }) : Promise.resolve(null),
    prisma.acquisitionOutcome.findMany({ where: { userId, acqProspectId: acq.id }, orderBy: { occurredAt: 'asc' } }),
  ]);
  const validity = ACTIVE_DRAFT.includes(d.status) ? await draftValidity(userId, d, industry) : null;
  return {
    draft: {
      id: d.id, status: d.status, statusReason: d.statusReason, version: d.version, channel: d.channel,
      subject: d.subject, body: d.body, offerId: d.offerId, createdAt: d.createdAt, updatedAt: d.updatedAt,
      evidenceHash: d.evidenceHash, offerHash: d.offerHash, offerConfigVersion: d.offerConfigVersion, industryConfigVersion: d.industryConfigVersion,
      readiness: d.readiness, bodyHash: draftHash(d.subject, d.body), wordCount: d.body.trim().split(/\s+/).filter(Boolean).length,
    },
    prospect: { id: acq.id, name: businessName, state: acq.state, domain: acq.orgDomain },
    offer: offer ? {
      id: offer.id, name: offer.name, status: offer.status, approvalState: offer.proposal?.approvalState ?? null,
      pricingStatus: offer.proposal?.pricing.status ?? null, sellable: offer.status === 'approved',
    } : null,
    recipient: recipient ? { id: recipient.id, kind: recipient.kind, name: recipient.name, email: recipient.email } : null,
    evidence: {
      observed: (meta.cited ?? []).map((c) => {
        const live = (signals as Array<{ id: string; supersededAt: Date | null; lastVerifiedAt: Date }>).find((s) => s.id === c.signalId);
        return { ...c, current: !!live && !live.supersededAt, lastVerifiedAt: live?.lastVerifiedAt ?? null };
      }),
      inferred: meta.inferred ?? [],
      unknown: meta.unknown ?? [],
    },
    warnings: meta.warnings ?? [],
    history: approvals.map((a: { id: string; action: string; actorEmail: string; note: string | null; bodyHashBefore: string | null; bodyHashAfter: string | null; evidenceHash: string | null; offerHash: string | null; createdAt: Date }) => ({
      id: a.id, action: a.action, actor: a.actorEmail, note: a.note, at: a.createdAt,
      bodyHashBefore: a.bodyHashBefore, bodyHashAfter: a.bodyHashAfter, evidenceHash: a.evidenceHash, offerHash: a.offerHash,
    })),
    outcomes: events,
    validity,
  };
}

// ─── Review actions ─────────────────────────────────────────────────────────

export const DraftActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('edit'), subject: z.string().trim().min(3).max(200), body: z.string().trim().min(20).max(4000), note: z.string().trim().max(500).optional() }),
  z.strictObject({ action: z.literal('approve'), note: z.string().trim().max(500).optional() }),
  z.strictObject({ action: z.literal('reject'), reason: z.string().trim().min(3).max(500) }),
  z.strictObject({ action: z.literal('mark_ready') }),
  z.strictObject({ action: z.literal('regenerate'), reason: z.string().trim().max(500).optional() }),
]);

export type DraftActionResult =
  | { ok: true; status: string; draftId: string; warnings?: string[] }
  | { ok: false; blockers: Reason[] };

async function contentBlocks(userId: string, d: DraftRow): Promise<GateBlock[]> {
  const { acq, industry, businessName } = await loadProspect(userId, d.acqProspectId);
  const [findings, recipient] = await Promise.all([
    prisma.acquisitionFinding.findMany({ where: { userId, acqProspectId: acq.id }, select: { id: true } }),
    d.recipientDmId ? prisma.acquisitionDecisionMaker.findFirst({ where: { id: d.recipientDmId, userId, acqProspectId: acq.id } }) : Promise.resolve(null),
  ]);
  const hits = await findSuppressionHits(userId, { email: recipient?.email ?? undefined, domain: acq.orgDomain ?? undefined });
  const res = evaluateDraftGate({
    industry, businessName, prospectState: acq.state,
    draft: { ...d, status: 'approved' },
    latestApproval: { action: 'approve', bodyHashAfter: draftHash(d.subject, d.body) },
    recipient: recipient ? { email: recipient.email, verification: recipient.verification } : null,
    prospectFindingIds: findings.map((f: { id: string }) => f.id),
    suppressionHits: hits, senderIdentity: null, sentToday: 0,
  });
  return res.blocks.filter((b) => !NOT_AT_APPROVAL.includes(b.code));
}

async function refuseIfInvalid(userId: string, d: DraftRow): Promise<Validity | DraftActionResult> {
  const v = await draftValidity(userId, d);
  if (v.valid) return v;
  await invalidateStaleDrafts(userId, d.acqProspectId, 'review check');
  return { ok: false, blockers: v.reasons };
}

export async function actOnDraft(userId: string, actor: string, draftId: string, body: unknown): Promise<DraftActionResult> {
  const a = DraftActionSchema.parse(body);
  const d = await prisma.acquisitionDraft.findFirst({ where: { id: draftId, userId } }) as DraftRow | null;
  if (!d) throw new DraftError('Draft not found');
  const hash = draftHash(d.subject, d.body);

  switch (a.action) {
    case 'edit': {
      if (!ACTIVE_DRAFT.includes(d.status)) throw new DraftError(`A ${d.status} draft cannot be edited; regenerate it instead`);
      const after = draftHash(a.subject, a.body);
      if (after === hash) throw new DraftError('No change to the text');
      await setStatus(userId, d.id, [d.status], { subject: a.subject, body: a.body, version: d.version + 1, status: 'pending_approval', readiness: Prisma.DbNull, gateResult: Prisma.DbNull, statusReason: 'Edited — needs approval' }, d.version);
      await record(userId, d.id, 'edit', actor, { note: a.note, bodyHashBefore: hash, bodyHashAfter: after });
      const acq = await prisma.acquisitionProspect.findFirst({ where: { id: d.acqProspectId, userId }, select: { state: true } });
      if (acq?.state === 'approved') await transitionProspect({ userId, acqProspectId: d.acqProspectId, to: 'draft_pending_approval', reason: 'Approved draft was edited', actor });
      return { ok: true, status: 'pending_approval', draftId: d.id };
    }
    case 'approve': {
      if (d.status !== 'pending_approval') throw new DraftError(`Only a draft pending approval can be approved (this one is ${d.status})`);
      const v = await refuseIfInvalid(userId, d);
      if ('ok' in v) return v;
      const blocks = await contentBlocks(userId, d);
      if (blocks.length) return { ok: false, blockers: blocks };
      await setStatus(userId, d.id, ['pending_approval'], { status: 'approved', statusReason: null }, d.version);
      await record(userId, d.id, 'approve', actor, { note: a.note, bodyHashBefore: hash, bodyHashAfter: hash, evidenceHash: v.evidenceHash, offerHash: v.offerHash });
      const acq = await prisma.acquisitionProspect.findFirst({ where: { id: d.acqProspectId, userId }, select: { state: true } });
      if (acq && canTransition(acq.state, 'approved')) await transitionProspect({ userId, acqProspectId: d.acqProspectId, to: 'approved', reason: `Draft v${d.version} approved`, actor });
      const { industry } = await loadProspect(userId, d.acqProspectId);
      const offerApproved = getOffer(industry, d.offerId)?.status === 'approved';
      return { ok: true, status: 'approved', draftId: d.id, warnings: offerApproved ? [] : ['Wording approved, but the offer is not approved for sale: this draft cannot be marked ready'] };
    }
    case 'reject': {
      if (!ACTIVE_DRAFT.includes(d.status)) throw new DraftError(`A ${d.status} draft cannot be rejected`);
      await setStatus(userId, d.id, [d.status], { status: 'rejected', statusReason: a.reason, readiness: Prisma.DbNull }, d.version);
      await record(userId, d.id, 'reject', actor, { note: a.reason, bodyHashBefore: hash });
      await rewindProspect(userId, d.acqProspectId, `Draft v${d.version} rejected`, actor);
      return { ok: true, status: 'rejected', draftId: d.id };
    }
    case 'mark_ready': {
      if (d.status !== 'approved') throw new DraftError(`Only an approved draft can be marked ready (this one is ${d.status})`);
      const v = await refuseIfInvalid(userId, d);
      if ('ok' in v) return v;
      // The same gate the (future) delivery path uses, bound to the current
      // evidence and offer versions; only delivery-time rules are deferred.
      const gate = await checkDraftForDelivery(userId, d.id);
      const blockers = gate.blocks.filter((b) => !DELIVERY_TIME_CODES.includes(b.code));
      const deferred = gate.blocks.filter((b) => DELIVERY_TIME_CODES.includes(b.code)).map((b) => b.code);
      const checkedAt = new Date().toISOString();
      if (blockers.length) {
        await prisma.acquisitionDraft.updateMany({ where: { id: d.id, userId }, data: { readiness: { ready: false, blockers, deferred, checkedAt } as unknown as Prisma.InputJsonValue } });
        return { ok: false, blockers };
      }
      await setStatus(userId, d.id, ['approved'], { status: 'ready', statusReason: null, readiness: { ready: true, blockers: [], deferred, checkedAt } as unknown as Prisma.InputJsonValue }, d.version);
      await record(userId, d.id, 'mark_ready', actor, { bodyHashAfter: hash, evidenceHash: v.evidenceHash, offerHash: v.offerHash });
      return { ok: true, status: 'ready', draftId: d.id, warnings: deferred.length ? [`Still required before any delivery: ${deferred.join(', ')}`] : [] };
    }
    case 'regenerate': {
      if (d.status === 'sent' || d.status === 'blocked' || d.status === 'invalidated') throw new DraftError(`A ${d.status} draft cannot be regenerated`);
      const r = await generateDraft(userId, actor, d.acqProspectId, { recipientDmId: d.recipientDmId ?? undefined });
      if (!r.ok) return { ok: false, blockers: r.reasons };
      return { ok: true, status: 'pending_approval', draftId: r.draftId, warnings: r.warnings };
    }
  }
}
