import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ACTIVATION } from '../activation';
import { getIndustry } from '../config/registry';
import type { IndustryConfig } from '../config/schema';
import { fetchSite, type FetchDeps, type SiteFetchResult } from '../web/fetcher';
import { extractSite } from '../web/extract';
import { registrableDomain } from '../web/url';
import { recordSignal, activeSignals } from '../signals';
import { storeContact } from '../contacts';
import { findSuppressionHits } from '../suppression';
import { canTransition, transitionProspect, type AcqState } from '../lifecycle';
import { computeScore, mapOffers, type EligibilityCheck } from '../scoring';
import { lagosDay } from '../time';
import type { AcqTaskHandler, AcqTaskOutcome } from '../tasks/types';
import { invalidateStaleDrafts } from '../drafts';

/**
 * Phase 2 research chain: research_contacts → audit → strategize.
 * Ends at `strategized` (or `needs_review`). Nothing here drafts, sends or
 * contacts anyone, and nothing calls a model.
 */

export interface ResearchDeps {
  fetchDeps?: FetchDeps;                                     // undefined → live transport (refuses unless activated)
  mx: (domain: string) => Promise<boolean | null>;          // null = not checked
  pagespeed: (url: string) => Promise<number | null>;       // null = not checked
}

// Live DNS / PageSpeed are not activated in Phase 2: report "not checked".
const LIVE: ResearchDeps = {
  fetchDeps: undefined,
  mx: async () => (ACTIVATION.liveDns ? null : null),
  pagespeed: async () => (ACTIVATION.pagespeedApi ? null : null),
};
let deps: ResearchDeps = LIVE;

/** Tests only: inject fixture transports. */
export function __setResearchDeps(d: Partial<ResearchDeps> | null) {
  deps = d ? { ...LIVE, ...d } : LIVE;
}

const INACTIVE: AcqState[] = ['suppressed', 'cancelled', 'disqualified', 'won', 'lost'];
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

async function load(userId: string, acqProspectId: string | null) {
  if (!acqProspectId) return null;
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  if (!acq) return null;
  const prospect = await prisma.prospect.findFirst({ where: { id: acq.prospectId, userId }, select: { businessName: true, businessData: true } });
  const industry = getIndustry(acq.industryKey);
  if (!industry || !prospect) return null;
  const website = ((prospect.businessData ?? {}) as { website?: string }).website ?? null;
  return { acq, industry, businessName: prospect.businessName, website };
}

async function advance(userId: string, acqProspectId: string, from: AcqState, to: AcqState, reason: string, actor: string) {
  const cur = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId }, select: { state: true } });
  // Re-runs of an earlier step must not move a prospect backwards or fail.
  if (!cur || cur.state !== from || !canTransition(from, to)) return false;
  await transitionProspect({ userId, acqProspectId, to, reason, actor });
  return true;
}

async function siteFor(userId: string, industry: IndustryConfig, website: string | null): Promise<SiteFetchResult | null> {
  if (!website) return null;
  return fetchSite({
    userId, siteUrl: website, maxPages: industry.research.maxPagesPerSite,
    contactPathHints: industry.research.contactPathHints, ttlHours: industry.retention.pageCacheHours, deps: deps.fetchDeps,
  });
}

async function recordSiteSources(userId: string, acqProspectId: string, site: SiteFetchResult) {
  const ids: Record<string, string> = {};
  for (const p of site.pages) {
    const contentHash = hash(p.html ?? `${p.status}:${p.httpStatus ?? ''}`);
    const existing = await prisma.acquisitionSource.findFirst({ where: { acqProspectId, kind: 'website', contentHash }, select: { id: true } });
    const row = existing ?? await prisma.acquisitionSource.create({
      data: { userId, acqProspectId, kind: 'website', url: p.finalUrl ?? p.url, contentHash, method: 'fetcher', httpStatus: p.httpStatus, robotsAllowed: p.status !== 'robots_disallowed' },
    });
    ids[p.url] = row.id;
  }
  return ids;
}

function defer(site: SiteFetchResult): AcqTaskOutcome {
  return { status: 'skipped', output: { reason: 'budget_exhausted' }, deferUntil: site.retryAt ?? new Date(Date.now() + 3_600_000) };
}

// ─── Agent 2: contacts (role inboxes + business phones only) ────────────────

export const researchContacts: AcqTaskHandler = async ({ userId, acqProspectId }) => {
  const p = await load(userId, acqProspectId);
  if (!p) return { status: 'skipped', output: { reason: 'prospect_missing' } };
  if (INACTIVE.includes(p.acq.state as AcqState)) return { status: 'skipped', output: { reason: `prospect_${p.acq.state}` } };

  const domain = p.website ? safeDomain(p.website) : null;
  if (domain && (await findSuppressionHits(userId, { domain })).length > 0) {
    return { status: 'skipped', output: { reason: 'domain_suppressed' } };
  }

  const site = await siteFor(userId, p.industry, p.website);
  if (site?.status === 'budget_exhausted') return defer(site);

  let stored = 0;
  let suppressed = 0;
  let namedNotStored = 0;
  let fetchStatus = site ? site.status : 'no_website';
  if (site && site.status === 'ok') {
    const sources = await recordSiteSources(userId, p.acq.id, site);
    const pages = site.pages.filter((x) => x.status === 'ok' && x.html).map((x) => ({ url: x.finalUrl ?? x.url, html: x.html! }));
    const ex = extractSite(pages, p.industry, site.pages[0]?.finalUrl);
    namedNotStored = ex.namedEmailCount;
    for (const r of ex.roleInboxes) {
      const res = await storeContact({ userId, acqProspectId: p.acq.id, kind: 'role_inbox', email: r.email, sourceUrl: r.sourceUrl, sourceId: sources[r.sourceUrl] ?? null, evidenceQuote: r.quote, confidence: 'high' });
      if (res.stored) stored++; else if (res.reason === 'suppressed') suppressed++;
    }
    for (const ph of ex.phones) {
      const res = await storeContact({ userId, acqProspectId: p.acq.id, kind: 'business_phone', phone: ph.phone, sourceUrl: ph.sourceUrl, sourceId: sources[ph.sourceUrl] ?? null, evidenceQuote: ph.quote, confidence: ph.whatsapp ? 'high' : 'medium' });
      if (res.stored) stored++; else if (res.reason === 'suppressed') suppressed++;
    }
    // MX: "can this domain receive mail" — not checked while live DNS is off.
    if (domain) {
      const mx = await deps.mx(domain);
      if (mx !== null) await prisma.acquisitionDecisionMaker.updateMany({ where: { userId, acqProspectId: p.acq.id, kind: 'role_inbox' }, data: { mxValid: mx } });
    }
    fetchStatus = 'ok';
  }

  await advance(userId, p.acq.id, 'discovered', 'contacts_researched',
    `Contact research: website ${fetchStatus}; ${stored} new contact point(s)${suppressed ? `, ${suppressed} suppressed value(s) dropped` : ''}${namedNotStored ? `, ${namedNotStored} named address(es) seen but not stored` : ''}`, 'contacts');
  return {
    status: 'completed',
    output: { fetchStatus, stored, suppressed, namedNotStored },
    next: [{ type: 'acq.audit', acqProspectId: p.acq.id, input: { industryKey: p.industry.id } }],
  };
};

// ─── Agent 3: website audit → signals → findings ────────────────────────────

const IMPACT: Record<string, string> = {
  search_visibility: 'Patients searching online may find the clinic less easily.',
  enquiry_conversion: 'Visitors may leave without getting in touch.',
  booking_friction: 'Booking may take more effort than patients expect.',
  enquiry_handling: 'Enquiries outside staffed hours may go unanswered.',
  voice_handling: 'Phone demand may exceed the team\'s capacity to answer.',
  lead_follow_up: 'Enquiries and past patients may not be followed up consistently.',
};

export const audit: AcqTaskHandler = async ({ userId, acqProspectId, input }) => {
  const p = await load(userId, acqProspectId);
  if (!p) return { status: 'skipped', output: { reason: 'prospect_missing' } };
  if (INACTIVE.includes(p.acq.state as AcqState)) return { status: 'skipped', output: { reason: `prospect_${p.acq.state}` } };

  const site = await siteFor(userId, p.industry, p.website);
  if (site?.status === 'budget_exhausted') return defer(site);

  const evidenceRefs: string[] = [];
  if (site && site.status === 'ok') {
    const sources = await recordSiteSources(userId, p.acq.id, site);
    const pages = site.pages.filter((x) => x.status === 'ok' && x.html).map((x) => ({ url: x.finalUrl ?? x.url, html: x.html! }));
    const ex = extractSite(pages, p.industry, site.pages[0]?.finalUrl);
    await recordSignal({ userId, acqProspectId: p.acq.id, code: 'website_present', value: true, basis: 'observed', method: 'html_rule', confidence: 'high', sourceUrl: site.pages[0]?.finalUrl ?? site.siteUrl, quote: `fetched ${pages.length} page(s)` });
    for (const s of ex.signals) {
      const r = await recordSignal({ userId, acqProspectId: p.acq.id, code: s.code, value: s.value, basis: s.basis, method: 'html_rule', confidence: s.confidence, sourceUrl: s.sourceUrl, sourceId: sources[s.sourceUrl] ?? null, quote: s.quote });
      evidenceRefs.push(r.id);
    }
    const psi = await deps.pagespeed(site.pages[0]?.finalUrl ?? site.siteUrl!);
    await recordSignal(psi === null
      ? { userId, acqProspectId: p.acq.id, code: 'pagespeed_mobile_poor', value: null, basis: 'unknown', method: 'psi_api', confidence: 'low', quote: 'PageSpeed not checked (pagespeedApi not activated; storage terms under review)' }
      : { userId, acqProspectId: p.acq.id, code: 'pagespeed_mobile_poor', value: psi < 50, basis: 'observed', method: 'psi_api', confidence: 'high', sourceUrl: site.siteUrl, quote: `PageSpeed mobile score ${psi}` });
  }

  // Findings: one per fired rule, keyed so re-audits update rather than duplicate.
  const signals = await activeSignals(userId, p.acq.id);
  const byCode = new Map(signals.map((s: { code: string }) => [s.code, s] as const));
  const keep: string[] = [];
  for (const c of p.industry.opportunityCategories) {
    const qIdx = { search_visibility: 1, enquiry_conversion: 1, booking_friction: 0, enquiry_handling: 2, voice_handling: 3, lead_follow_up: 1 }[c.id] ?? 0;
    for (const rule of c.signalRules) {
      const s = byCode.get(rule.signal) as { id: string; value: unknown; basis: string; confidence: string; sourceId: string | null; sourceUrl: string | null; evidenceQuote: string | null; observedAt: Date } | undefined;
      if (!s || s.basis === 'unknown' || s.value !== rule.when) continue;
      const findingKey = `${c.id}:${rule.signal}:${rule.when}`;
      keep.push(findingKey);
      const data = {
        userId, acqProspectId: p.acq.id, findingKey, category: c.id,
        polarity: rule.weight >= 0 ? 'weakness' : 'strength',
        basis: s.basis, finding: `${rule.signal} = ${String(rule.when)}`,
        evidence: s.evidenceQuote ?? '(no quote)', sourceId: s.sourceId, observedAt: s.observedAt,
        impactHypothesis: rule.weight >= 0 ? IMPACT[c.id] ?? null : null,
        confidence: s.confidence, validationQuestion: p.industry.qualificationQuestions[qIdx] ?? null,
        solutionCategory: c.id, signalIds: [s.id] as Prisma.InputJsonValue,
      };
      const existing = await prisma.acquisitionFinding.findFirst({ where: { acqProspectId: p.acq.id, findingKey }, select: { id: true } });
      if (existing) await prisma.acquisitionFinding.update({ where: { id: existing.id }, data });
      else await prisma.acquisitionFinding.create({ data });
    }
  }
  await prisma.acquisitionFinding.deleteMany({ where: { acqProspectId: p.acq.id, findingKey: { notIn: keep } } });

  await advance(userId, p.acq.id, 'contacts_researched', 'audited', `Audit: website ${site ? site.status : 'none'}; ${keep.length} finding(s)`, 'audit');
  // Drafts are bound to the evidence they cite; re-auditing may change it.
  await invalidateStaleDrafts(userId, p.acq.id, 'audit re-run');
  return {
    status: 'completed',
    output: { fetchStatus: site ? site.status : 'no_website', findings: keep.length },
    evidenceRefs,
    // A re-audit (manual evidence, "Re-audit") carries its runKey on to the rescore. Without it the
    // rescore has the same input as the first one and the queue's idempotency key drops it.
    next: [{ type: 'acq.strategize', acqProspectId: p.acq.id, input: { industryKey: p.industry.id, ...(typeof input?.runKey === 'string' ? { runKey: input.runKey } : {}) } }],
  };
};

// ─── Agent 4 (deterministic): score + offer mapping ─────────────────────────

export const strategize: AcqTaskHandler = async ({ userId, acqProspectId }) => {
  const p = await load(userId, acqProspectId);
  if (!p) return { status: 'skipped', output: { reason: 'prospect_missing' } };
  if (INACTIVE.includes(p.acq.state as AcqState)) return { status: 'skipped', output: { reason: `prospect_${p.acq.state}` } };
  const now = new Date();

  const [signals, contacts, events] = await Promise.all([
    activeSignals(userId, p.acq.id),
    prisma.acquisitionDecisionMaker.findMany({ where: { userId, acqProspectId: p.acq.id }, select: { kind: true, flags: true, email: true, phone: true } }),
    prisma.acquisitionPipelineEvent.findMany({ where: { userId, acqProspectId: p.acq.id }, select: { reason: true } }),
  ]);

  const domain = p.website ? safeDomain(p.website) : null;
  const suppressedHits = domain ? await findSuppressionHits(userId, { domain }) : [];
  const lowerName = p.businessName.toLowerCase();
  const city = p.industry.geography.city.toLowerCase();
  const area = (p.acq.area ?? '').toLowerCase();
  const inGeo = !area || area === city || p.industry.geography.priorityAreas.some((a) => a.toLowerCase() === area);
  const possibleDup = events.some((e: { reason: string }) => /possible duplicate/i.test(e.reason));
  const eligibility: EligibilityCheck[] = [
    { check: 'geography', pass: inGeo, detail: area ? `area "${p.acq.area}"` : 'area not stated (assumed in configured city)' },
    { check: 'not_excluded_type', pass: !p.industry.discovery.excludeKeywords.some((k) => lowerName.includes(k.toLowerCase())), detail: p.businessName },
    { check: 'not_suppressed', pass: suppressedHits.length === 0, detail: suppressedHits.join(', ') || 'none' },
    { check: 'no_crm_conflict', pass: !p.acq.crmConflict, detail: p.acq.crmConflict ?? 'none' },
    { check: 'not_possible_duplicate', pass: !possibleDup, detail: possibleDup ? 'same name and area as another prospect — admin review' : 'none' },
    { check: 'independent_source', pass: true, detail: 'created from an import / manual entry' },
  ];

  const score = computeScore({
    industry: p.industry,
    signals: signals.map((s: { id: string; code: string; value: unknown; basis: string; confidence: string; lastVerifiedAt: Date; sourceUrl: string | null; evidenceQuote: string | null }) => ({
      id: s.id, code: s.code, value: s.value, basis: s.basis as 'observed', confidence: s.confidence as 'high', lastVerifiedAt: s.lastVerifiedAt, sourceUrl: s.sourceUrl, evidenceQuote: s.evidenceQuote,
    })),
    contacts,
    eligibility,
    now,
  });
  const rec = mapOffers(p.industry, score);

  let scoreRow = await prisma.acquisitionScore.findFirst({ where: { acqProspectId: p.acq.id, inputHash: score.inputHash } });
  if (!scoreRow) {
    scoreRow = await prisma.acquisitionScore.create({
      data: {
        userId, acqProspectId: p.acq.id, industryKey: p.industry.id, configVersion: score.configVersion, scoreVersion: score.scoreVersion,
        total: score.total, band: score.band, coverage: score.coverage, contactability: score.contactability,
        eligible: score.eligible, eligibility: score.eligibility as unknown as Prisma.InputJsonValue,
        breakdown: score.categories as unknown as Prisma.InputJsonValue, inputHash: score.inputHash, computedAt: now,
      },
    });
  }
  const findings = await prisma.acquisitionFinding.findMany({ where: { acqProspectId: p.acq.id, category: { in: rec.nominatedCategories }, polarity: 'weakness' }, select: { id: true } });
  const existingRec = await prisma.acquisitionRecommendation.findFirst({ where: { acqProspectId: p.acq.id, scoreId: scoreRow.id }, select: { id: true } });
  if (!existingRec) {
    await prisma.acquisitionRecommendation.create({
      data: {
        userId, acqProspectId: p.acq.id, scoreId: scoreRow.id,
        primaryOfferId: rec.primaryOfferId, secondaryOfferId: rec.secondaryOfferId, offerStatusAtTime: rec.offerStatus,
        rationale: `${rec.label}.\n${rec.rationale}`,
        findingIds: findings.map((f: { id: string }) => f.id) as Prisma.InputJsonValue,
        targetRole: p.industry.decisionMakerRoles[0], angle: rec.nominatedCategories[0] ?? null, cta: null,
        confidence: rec.confidence,
        missingInfo: [...rec.missingInfo, ...rec.validationQuestions.map((q) => `Validate: ${q}`)] as Prisma.InputJsonValue,
      },
    });
  }
  await prisma.acquisitionProspect.update({ where: { id: p.acq.id }, data: { fitScore: score.total, scoreIsEstimate: true, lastScoredAt: now } });

  const target: AcqState = score.eligible ? 'strategized' : 'needs_review';
  const failed = score.eligibility.filter((e) => !e.pass).map((e) => e.check);
  await advance(userId, p.acq.id, 'audited', target,
    `Scored ${score.total} (estimate, ${score.band}); ${rec.primaryOfferId === 'none' ? 'no offer nominated' : `primary ${rec.primaryOfferId}`}${failed.length ? `; needs review: ${failed.join(', ')}` : ''}`, 'strategy');

  await invalidateStaleDrafts(userId, p.acq.id, 'rescored');

  // Stale evidence: queue a re-verification (it will not refetch while the crawler is off).
  const next = score.staleSignalIds.length > 0
    ? [{ type: 'acq.audit' as const, acqProspectId: p.acq.id, input: { industryKey: p.industry.id, runKey: `reverify-${lagosDay(now)}` } }]
    : [];
  return { status: 'completed', output: { scoreId: scoreRow.id, total: score.total, band: score.band, eligible: score.eligible, primaryOfferId: rec.primaryOfferId }, next };
};

function safeDomain(website: string): string | null {
  try { return registrableDomain(new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname); } catch { return null; }
}
