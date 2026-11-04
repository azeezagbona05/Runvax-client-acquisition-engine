import crypto from 'node:crypto';
import type { IndustryConfig, Contactability } from './config/schema';
import { CONTACTABILITY_ORDER } from './config/schema';

/**
 * Deterministic, explainable opportunity scoring (docs/phase-2-plan.md §6).
 * No AI and no Google Places input: only stored signals from independent
 * sources plus our own industry assumptions. The breakdown records every
 * rule's inputs and contribution; summing the category points gives the
 * total exactly (before the final rounding, which is the last step).
 */

export const SCORE_VERSION = 'acq-score-v1';
export const BASIS_FACTOR = { observed: 1, inferred: 0.4, unknown: 0 } as const;
export const CONFIDENCE_FACTOR = { high: 1, medium: 0.7, low: 0.4 } as const;

export interface ScoringSignal {
  id: string;
  code: string;
  value: unknown;
  basis: keyof typeof BASIS_FACTOR;
  confidence: keyof typeof CONFIDENCE_FACTOR;
  lastVerifiedAt: Date;
  sourceUrl: string | null;
  evidenceQuote: string | null;
}

export interface ScoringContact { kind: string; flags: unknown }

export interface EligibilityCheck { check: string; pass: boolean; detail: string }

export interface RuleBreakdown {
  signal: string; when: boolean; weight: number;
  signalId: string | null; value: unknown; basis: string | null; confidence: string | null;
  freshness: number; fired: boolean; contribution: number; sourceUrl: string | null; quote: string | null;
}

export interface CategoryBreakdown {
  id: string; label: string; weight: number; provisional: boolean;
  raw: number; score: number; points: number; covered: boolean; rules: RuleBreakdown[];
}

export interface ScoreResult {
  scoreVersion: string;
  configVersion: number;
  total: number;
  band: string;
  coverage: number;
  contactability: Contactability;
  eligible: boolean;
  eligibility: EligibilityCheck[];
  categories: CategoryBreakdown[];
  staleSignalIds: string[];
  inputHash: string;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function freshnessFactor(lastVerifiedAt: Date, now: Date, retention: IndustryConfig['retention']): number {
  const days = (now.getTime() - lastVerifiedAt.getTime()) / 86_400_000;
  if (days <= retention.signalReverifyDays) return 1;
  if (days <= retention.signalStaleDays) return 0.5;
  return 0;
}

export function contactabilityOf(contacts: ScoringContact[]): Contactability {
  const usable = contacts.filter((c) => !(c.flags && typeof c.flags === 'object' && 'duplicateOf' in (c.flags as object)));
  if (usable.some((c) => c.kind === 'manual_named')) return 'named_manual';
  if (usable.some((c) => c.kind === 'role_inbox')) return 'role_inbox';
  if (usable.some((c) => c.kind === 'business_phone')) return 'business_phone';
  return 'none';
}

function bandFor(industry: IndustryConfig, total: number, coverage: number, contactability: Contactability): string {
  const rank = (c: Contactability) => CONTACTABILITY_ORDER.indexOf(c);
  for (const b of industry.bands) {
    if (b.maxCoverageExclusive !== undefined && !(coverage < b.maxCoverageExclusive)) continue;
    if (b.minScore !== undefined && total < b.minScore) continue;
    if (b.minCoverage !== undefined && coverage < b.minCoverage) continue;
    if (b.minContactability !== undefined && rank(contactability) < rank(b.minContactability)) continue;
    return b.band;
  }
  return 'low';
}

export function computeScore(params: {
  industry: IndustryConfig;
  signals: ScoringSignal[];
  contacts: ScoringContact[];
  eligibility: EligibilityCheck[];
  now: Date;
}): ScoreResult {
  const { industry, now } = params;
  // Latest active signal per code. An "unknown" (could not check) never shadows
  // an observation or inference for the same code, however recently it was
  // refreshed: otherwise a re-audit of a site that can't be read would hide
  // evidence an admin entered by hand.
  const byCode = new Map<string, ScoringSignal>();
  for (const s of params.signals) {
    const prev = byCode.get(s.code);
    if (!prev) { byCode.set(s.code, s); continue; }
    const prevUnknown = prev.basis === 'unknown';
    const nextUnknown = s.basis === 'unknown';
    if (prevUnknown !== nextUnknown ? prevUnknown : prev.lastVerifiedAt < s.lastVerifiedAt) byCode.set(s.code, s);
  }

  const stale = new Set<string>();
  const categories: CategoryBreakdown[] = industry.opportunityCategories.map((c) => {
    let raw = 0;
    let covered = false;
    const rules: RuleBreakdown[] = c.signalRules.map((rule) => {
      const s = byCode.get(rule.signal) ?? null;
      const fresh = s ? freshnessFactor(s.lastVerifiedAt, now, industry.retention) : 0;
      if (s && fresh === 0) stale.add(s.id);
      if (s && s.basis === 'observed' && fresh > 0) covered = true;
      const fired = !!s && s.basis !== 'unknown' && fresh > 0 && s.value === rule.when;
      const contribution = fired ? round4(rule.weight * BASIS_FACTOR[s!.basis] * CONFIDENCE_FACTOR[s!.confidence] * fresh) : 0;
      raw += contribution;
      return {
        signal: rule.signal, when: rule.when, weight: rule.weight,
        signalId: s?.id ?? null, value: s?.value ?? null, basis: s?.basis ?? null, confidence: s?.confidence ?? null,
        freshness: fresh, fired, contribution, sourceUrl: s?.sourceUrl ?? null, quote: s?.evidenceQuote ?? null,
      };
    });
    const score = round4(Math.min(1, Math.max(0, raw)));
    return { id: c.id, label: c.label, weight: c.weight, provisional: c.weightIsProvisional, raw: round4(raw), score, points: round4(100 * c.weight * score), covered, rules };
  });

  const total = Math.round(categories.reduce((sum, c) => sum + c.points, 0));
  const coverage = round4(categories.filter((c) => c.covered).length / categories.length);
  const contactability = contactabilityOf(params.contacts);
  const eligible = params.eligibility.every((e) => e.pass);
  const band = bandFor(industry, total, coverage, contactability);

  const inputHash = crypto.createHash('sha256').update(JSON.stringify([
    SCORE_VERSION, industry.id, industry.version,
    Array.from(byCode.values()).map((s) => [s.id, s.code, s.value, s.basis, s.confidence, freshnessFactor(s.lastVerifiedAt, now, industry.retention)]).sort(),
    contactability, params.eligibility,
  ])).digest('hex');

  return { scoreVersion: SCORE_VERSION, configVersion: industry.version, total, band, coverage, contactability, eligible, eligibility: params.eligibility, categories, staleSignalIds: Array.from(stale), inputHash };
}

// ─── offer mapping ─────────────────────────────────────────────────────────

export const NOMINATION_THRESHOLD = 0.3;
export const SECONDARY_RATIO = 0.6;

// Which configured qualification questions validate each category (by index).
const VALIDATION_QUESTIONS: Record<string, number[]> = {
  search_visibility: [1],
  enquiry_conversion: [1, 3],
  booking_friction: [0, 4],
  enquiry_handling: [2, 3],
  voice_handling: [3],
  lead_follow_up: [1, 4],
};

export interface OfferRecommendation {
  primaryOfferId: string;            // 'none' when nothing reaches the threshold
  secondaryOfferId: string | null;
  offerStatus: string;               // the primary offer's catalogue status at the time
  label: string;
  rationale: string;
  nominatedCategories: string[];
  validationQuestions: string[];
  missingInfo: string[];
  confidence: 'low' | 'medium' | 'high';
  offerValues: Record<string, number>;
}

export function mapOffers(industry: IndustryConfig, score: ScoreResult): OfferRecommendation {
  const nominated = score.categories.filter((c) => c.score >= NOMINATION_THRESHOLD);
  const values: Record<string, number> = {};
  for (const c of nominated) {
    const cfg = industry.opportunityCategories.find((x) => x.id === c.id)!;
    for (const o of cfg.offerIds) values[o] = round4((values[o] ?? 0) + c.weight * c.score);
  }
  const ranked = Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const primary = ranked[0];
  const secondary = ranked[1] && primary && ranked[1][1] >= SECONDARY_RATIO * primary[1] ? ranked[1] : null;
  const offer = primary ? industry.offers.find((o) => o.id === primary[0]) : undefined;

  const lines: string[] = [];
  for (const c of nominated.sort((a, b) => b.points - a.points)) {
    const evidence = c.rules.filter((r) => r.fired && r.weight > 0)
      .map((r) => `${r.signal}=${String(r.value)} (${r.basis}, ${r.confidence}${r.sourceUrl ? `, ${r.sourceUrl}` : ''})`);
    lines.push(`${c.label}: category score ${c.score} → ${c.points} pts. Evidence: ${evidence.join('; ') || 'none'}.`);
  }
  const missingInfo = score.categories.filter((c) => !c.covered).map((c) => `No observed evidence for "${c.label}"`);
  if (score.contactability === 'none') missingInfo.push('No contact point found');
  const qs = Array.from(new Set(nominated.flatMap((c) => VALIDATION_QUESTIONS[c.id] ?? []))).map((i) => industry.qualificationQuestions[i]).filter(Boolean);

  return {
    primaryOfferId: primary ? primary[0] : 'none',
    secondaryOfferId: secondary ? secondary[0] : null,
    offerStatus: offer?.status ?? 'n/a',
    label: offer?.status === 'approved' ? 'Internal recommendation' : 'Internal: offer not yet approved for sale',
    rationale: lines.length ? lines.join('\n') : 'No category reached the nomination threshold; no strong opportunity found from the available evidence.',
    nominatedCategories: nominated.map((c) => c.id),
    validationQuestions: qs,
    missingInfo,
    confidence: score.coverage >= 0.67 ? 'high' : score.coverage >= 0.34 ? 'medium' : 'low',
    offerValues: values,
  };
}
