/**
 * Lead scoring for every industry template: one engine, 100 points.
 *
 *   Industry and business fit 20 · Business activity 15 · Identified opportunity 25 · Buying/growth signals 15 ·
 *   Decision-maker availability 15 · Contactability 10
 *
 * Two rules keep the score honest:
 *  1. Missing information is never proof of a problem. An opportunity or growth signal only scores when it was observed, and how
 *     firmly it was observed ("verified", "listed" or "inferred") sets how much it is worth.
 *  2. A found email is not a decision-maker. The decision-maker points need an identified person; an email only adds to contactability.
 * Evidence quality is reported separately, and Priority A needs both enough evidence quality and at least one opportunity that was
 * actually observed ("verified" or "listed"), so a high score resting on guesses is held at Priority B.
 */
import type { IndustryId, OpportunityId } from './industryIntel';
import { OPPORTUNITY_LABEL, industryById, recommendOffers } from './industryIntel';

export type Evidence = 'verified' | 'listed' | 'inferred';
export type Priority = 'A' | 'B' | 'C' | 'Low';

export const WEIGHTS = { fit: 20, activity: 15, opportunity: 25, growth: 15, decisionMaker: 15, contactability: 10 } as const;
export type FactorId = keyof typeof WEIGHTS;
export const FACTOR_LABEL: Record<FactorId, string> = {
  fit: 'Industry and business fit', activity: 'Business activity', opportunity: 'Identified business opportunity',
  growth: 'Buying and growth signals', decisionMaker: 'Decision-maker availability', contactability: 'Contactability',
};
/** How much each way of knowing something is worth: seen directly, shown on a public listing, or worked out from other facts. */
const EVIDENCE_VALUE: Record<Evidence, number> = { verified: 1, listed: 0.7, inferred: 0.4 };

/** Everything is optional. `undefined` means "not known", which never counts against a business. */
export interface LeadEvidence {
  fit?: 'strong' | 'partial' | 'none';
  activity?: { reviews?: number; rating?: number; hasPhone?: boolean; recentSignals?: number };
  opportunities?: Array<{ id: OpportunityId; evidence: Evidence }>;
  growth?: Array<{ label: string; evidence: Evidence }>;
  decisionMaker?: { identified: boolean; role?: 'primary' | 'secondary' | 'other'; verified?: boolean };
  contact?: { verifiedEmail?: boolean; unverifiedEmail?: boolean; genericOnly?: boolean; phone?: boolean; form?: boolean };
}

export interface FactorScore { id: FactorId; label: string; points: number; max: number; known: boolean; note: string }
export interface LeadScore {
  total: number;
  priority: Priority;
  priorityLabel: string;
  factors: FactorScore[];
  /** 0 to 100: how much of the score rests on things actually seen. Separate from the score itself. */
  evidenceQuality: number;
  /** What is not known yet. Unknown is not the same as absent. */
  unknown: string[];
  /** True when the score would have reached A but the evidence is too thin (or no opportunity was actually observed), so it is held at B. */
  heldForEvidence: boolean;
  offers: string[];
}

export const PRIORITY_LABEL: Record<Priority, string> = { A: 'Priority A: high potential', B: 'Priority B: good potential', C: 'Priority C: needs review', Low: 'Low priority' };
export const priorityOf = (total: number): Priority => (total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'Low');
/** Below this evidence quality a lead cannot be Priority A. */
export const MIN_EVIDENCE_FOR_A = 50;

const cap = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n * 10) / 10));

export function scoreLead(industry: IndustryId, e: LeadEvidence): LeadScore {
  const ind = industryById(industry);
  const f: FactorScore[] = [];
  const unknown: string[] = [];
  const add = (id: FactorId, points: number, known: boolean, note: string, evidenceShare = known ? 1 : 0) => {
    f.push({ id, label: FACTOR_LABEL[id], points: cap(points, WEIGHTS[id]), max: WEIGHTS[id], known, note });
    shares[id] = evidenceShare;
    if (!known) unknown.push(FACTOR_LABEL[id]);
  };
  const shares: Partial<Record<FactorId, number>> = {};

  // Fit
  const fit = e.fit === 'strong' ? 20 : e.fit === 'partial' ? 10 : 0;
  add('fit', fit, e.fit !== undefined, e.fit === undefined ? 'Fit with the industry is not confirmed yet.' : e.fit === 'none' ? 'Does not look like this industry.' : `${e.fit === 'strong' ? 'Clearly' : 'Partly'} a ${ind?.label ?? 'target'} business.`, e.fit === undefined ? 0 : 0.8);

  // Activity: public signs the business is open and trading.
  const a = e.activity;
  let act = 0;
  if (a) {
    const r = a.reviews ?? 0;
    act += r >= 100 ? 8 : r >= 20 ? 5 : r >= 5 ? 2 : 0;
    act += typeof a.rating === 'number' ? (a.rating >= 4 ? 4 : a.rating >= 3.5 ? 2 : 0) : 0;
    act += a.hasPhone ? 1.5 : 0;
    act += (a.recentSignals ?? 0) > 0 ? 2 : 0;
  }
  add('activity', act, !!a && (a.reviews !== undefined || a.rating !== undefined || a.hasPhone !== undefined || a.recentSignals !== undefined),
    a ? 'Public reviews, rating and contact details.' : 'No activity information yet.', a ? 0.7 : 0);

  // Opportunity: only what was actually observed, weighted by how firmly.
  const opps = e.opportunities ?? [];
  const oppPts = opps.reduce((s, x) => s + 12 * EVIDENCE_VALUE[x.evidence], 0);
  const oppShare = opps.length ? opps.reduce((s, x) => s + EVIDENCE_VALUE[x.evidence], 0) / opps.length : 0;
  add('opportunity', oppPts, e.opportunities !== undefined && opps.length > 0,
    opps.length ? opps.map((x) => `${OPPORTUNITY_LABEL[x.id]} (${x.evidence})`).join(', ') : 'No opportunity has been observed yet. That is not proof there is none.', oppShare);

  // Growth
  const growth = e.growth ?? [];
  const growPts = growth.reduce((s, x) => s + 8 * EVIDENCE_VALUE[x.evidence], 0);
  const growShare = growth.length ? growth.reduce((s, x) => s + EVIDENCE_VALUE[x.evidence], 0) / growth.length : 0;
  add('growth', growPts, e.growth !== undefined && growth.length > 0, growth.length ? growth.map((x) => `${x.label} (${x.evidence})`).join(', ') : 'No growth signal observed yet.', growShare);

  // Decision-maker: needs an identified person. An email alone adds nothing here.
  const dm = e.decisionMaker;
  const dmBase = !dm?.identified ? 0 : dm.role === 'primary' ? 15 : dm.role === 'secondary' ? 9 : 4;
  add('decisionMaker', dm?.identified ? dmBase * (dm.verified === false ? 0.8 : 1) : 0, dm !== undefined,
    !dm ? 'No decision-maker search yet.' : !dm.identified ? 'No decision-maker identified. A general email does not count.' : `${dm.role ?? 'other'} decision-maker identified${dm.verified === false ? ' (not verified)' : ''}.`,
    !dm ? 0 : dm.identified ? (dm.verified === false ? 0.6 : 1) : 0.5);

  // Contactability: separate from who the person is.
  const c = e.contact;
  let con = 0;
  if (c) {
    con += c.verifiedEmail ? 7 : c.unverifiedEmail ? 4 : c.genericOnly ? 2.5 : 0;
    con += c.phone ? 2 : 0;
    con += c.form ? 1.5 : 0;
  }
  add('contactability', con, c !== undefined, !c ? 'No contact route checked yet.' : c.verifiedEmail ? 'A verified email is available.' : 'No verified email yet.', c ? (c.verifiedEmail ? 1 : 0.6) : 0);

  const total = Math.round(f.reduce((s, x) => s + x.points, 0));
  // Evidence quality: each factor's weight times how firmly its inputs are known.
  const evidenceQuality = Math.round(f.reduce((s, x) => s + (shares[x.id] ?? 0) * WEIGHTS[x.id], 0));
  let priority = priorityOf(total);
  const observedOpportunity = opps.some((x) => x.evidence !== 'inferred');
  const heldForEvidence = priority === 'A' && (evidenceQuality < MIN_EVIDENCE_FOR_A || !observedOpportunity);
  if (heldForEvidence) priority = 'B';
  return {
    total, priority, priorityLabel: PRIORITY_LABEL[priority], factors: f, evidenceQuality, unknown, heldForEvidence,
    offers: recommendOffers(industry, opps.map((x) => x.id)),
  };
}
