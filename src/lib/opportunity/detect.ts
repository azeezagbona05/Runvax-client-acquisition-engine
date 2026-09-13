/**
 * Opportunity detection — interpretation of signals.
 *
 * Two rules govern this file:
 *
 * 1. No AI. Detection is deterministic so that "which reason closed a deal" is a
 *    query rather than a guess. The model writes the message, not the decision.
 * 2. Category sets the ceiling; business-specific signals decide where in the
 *    range a business lands. Without the second half every dental clinic in the
 *    city scores identically and the daily list is just an industry filter.
 */

import type { Business } from '@/types';
import { estimatePrice } from '@/lib/scoring';
import { extractSignals, hasSignal, specificSignals } from './signals';
import type { Signal, SignalCode } from './signals';
import { angleFor } from './industryAngles';
import type {
  Confidence, Opportunity, OpportunityBand, OpportunityResult, PrimaryAngle,
  SellerOffer, SolutionPattern, SolutionPatternId,
} from './types';

// ─── Solution patterns ────────────────────────────────────────────────────────
// Deliberately few. The builder customises per client; RUNVAX only needs to name
// the shape of the sale.

const PATTERNS: Record<SolutionPatternId, SolutionPattern> = {
  support: {
    id: 'support',
    name: 'AI Customer Enquiry System',
    components: ['AI enquiry agent', 'Knowledge base', 'CRM', 'Automated follow-up'],
  },
  qualification: {
    id: 'qualification',
    name: 'AI Lead Qualification System',
    components: ['AI enquiry agent', 'Lead qualification', 'CRM', 'Automated follow-up'],
  },
  booking: {
    id: 'booking',
    name: 'AI Enquiry & Booking System',
    components: ['AI enquiry agent', 'Booking workflow', 'CRM', 'Reminders & follow-up'],
  },
  sales: {
    id: 'sales',
    name: 'AI Sales & Follow-up System',
    components: ['AI enquiry agent', 'Lead capture', 'CRM', 'Automated follow-up'],
  },
  operations: {
    id: 'operations',
    name: 'AI Business Operations System',
    components: ['AI enquiry agent', 'Knowledge base', 'CRM', 'Workflow automation'],
  },
  website_build: {
    id: 'website_build',
    name: 'Business Website',
    components: ['Mobile-first website', 'Contact & enquiry capture', 'Google visibility', 'WhatsApp click-through'],
  },
};

// Industry knowledge lives in one place — see industryAngles.ts. The ceiling is
// the *most* a business of this kind can score; evidence moves it down as well as up.

// ─── Evidence weighting ───────────────────────────────────────────────────────
// Only business-specific signals appear here. Category signals already had their
// say in the ceiling; letting them score twice is the trap that flattens the list.

const AI_EVIDENCE_WEIGHTS: Partial<Record<SignalCode, number>> = {
  missed_enquiries: 0.16,     // a customer said out loud that enquiries are dropped
  booking_friction: 0.12,
  slow_response: 0.10,
  staff_stretched: 0.08,
  high_review_volume: 0.07,   // real inbound volume to handle
  strong_rating: 0.04,        // good service under strain, not a turnaround job
  has_website: 0.05,          // already bought digital once — budget is proven
  incomplete_hours: 0.03,
  phone_only: 0.03,
  stale_listing: -0.12,       // may be dormant; do not push it up the list
};

const WEB_EVIDENCE_WEIGHTS: Partial<Record<SignalCode, number>> = {
  info_gap: 0.14,             // a customer said out loud they could not find the details
  high_review_volume: 0.10,   // proven demand with nowhere to land
  strong_rating: 0.07,
  social_only: 0.05,
  phone_only: 0.04,
  slow_website: 0.08,
  incomplete_hours: 0.02,
  stale_listing: -0.15,
};

function multiplier(signals: Signal[], weights: Partial<Record<SignalCode, number>>): number {
  let m = 0.78;   // a business with no specific evidence sits well below its ceiling
  for (const s of specificSignals(signals)) m += weights[s.code] ?? 0;
  return Math.max(0.5, Math.min(1.0, m));
}

const BAND_ORDER: OpportunityBand[] = ['low', 'possible', 'good', 'strong', 'high'];

/**
 * The band is capped by confidence. A business we only understand through its
 * category can never be shown as a "high" opportunity, however favourable the
 * category is — that is exactly the overpromise the confidence field exists to
 * prevent.
 */
function bandFor(score: number, confidence: Confidence): OpportunityBand {
  const raw: OpportunityBand =
    score >= 90 ? 'high'
    : score >= 75 ? 'strong'
    : score >= 60 ? 'good'
    : score >= 40 ? 'possible'
    : 'low';

  const ceiling: OpportunityBand = confidence === 'high' ? 'high' : confidence === 'medium' ? 'strong' : 'good';
  return BAND_ORDER.indexOf(raw) > BAND_ORDER.indexOf(ceiling) ? ceiling : raw;
}

/** Confidence tracks how much of the case is observed rather than assumed. */
function confidenceFrom(count: number): Confidence {
  if (count >= 3) return 'high';
  if (count >= 1) return 'medium';
  return 'low';
}

// ─── Website opportunity ──────────────────────────────────────────────────────

function detectWebsite(business: Business, signals: Signal[]): Opportunity | null {
  const missing = hasSignal(signals, 'no_website');
  const slow = hasSignal(signals, 'slow_website');
  if (!missing && !slow) return null;

  // Absence of a website is directly observable, so the ceiling is high and the
  // confidence is not in question. A slow existing site is a weaker, rebuild case.
  const ceiling = missing ? 96 : 70;
  const score = Math.round(ceiling * multiplier(signals, WEB_EVIDENCE_WEIGHTS));
  const price = estimatePrice(business.category, business.categoryTypes);

  const evidence = signals
    .filter((s) => s.specific && (WEB_EVIDENCE_WEIGHTS[s.code] !== undefined || s.code === 'no_website'))
    .map((s) => s.evidence);

  const reason = missing
    ? hasSignal(signals, 'high_review_volume')
      ? `Established ${lower(business.category)} with real customer demand and nowhere for that demand to land online.`
      : `${short(business.name)} has no website, so anyone searching online cannot find or contact them properly.`
    : `Their existing site is slow enough that visitors are likely leaving before it loads.`;

  return {
    type: 'website',
    score,
    band: bandFor(score, 'high'),
    confidence: 'high',
    title: missing ? 'Business Website' : 'Website Rebuild',
    reason,
    evidence,
    signalCodes: signals.filter((s) => s.specific).map((s) => s.code),
    pattern: PATTERNS.website_build,
    outreachAngle: missing
      ? 'Customers searching online cannot find them or see what they offer'
      : 'Their current site is slow and losing visitors before it loads',
    buyer: angleFor(business.category, business.categoryTypes).buyer,
    value: { setupMin: price.min, setupMax: price.max },
  };
}

// ─── AI business system opportunity ───────────────────────────────────────────

function detectAiSystem(business: Business, signals: Signal[]): Opportunity | null {
  const angle = angleFor(business.category, business.categoryTypes);
  const { ceiling, pattern } = angle;

  // Category alone is not an opportunity, and neither is merely having a phone or
  // a website — nearly every business has one of those. Qualification takes one of
  // two routes: a customer said something went wrong, or there is enough demand in
  // a category where enquiries genuinely pile up.
  const FRICTION: SignalCode[] = ['missed_enquiries', 'slow_response', 'booking_friction', 'staff_stretched'];

  const friction = signals.filter((s) => FRICTION.includes(s.code));
  const volumeRoute =
    hasSignal(signals, 'high_review_volume') &&
    (hasSignal(signals, 'appointment_driven') || hasSignal(signals, 'enquiry_heavy'));

  if (friction.length === 0 && !volumeRoute) return null;

  const score = Math.round(ceiling * multiplier(signals, AI_EVIDENCE_WEIGHTS));
  if (score < 55) return null;

  // The reason is built from the trade's workflow, which is true of every business
  // in it. A review quote sharpens the wording when one exists — it is never the
  // thing the case rests on.
  const reason = friction.length > 0
    ? `${short(business.name)} runs on enquiries that ${angle.manualProcess}, and customers have publicly mentioned struggling to reach or book with them.`
    : `In a ${angle.label}, ${angle.characteristic} — and right now that means ${angle.manualProcess}.`;

  const evidence = signals
    .filter((s) => s.specific && AI_EVIDENCE_WEIGHTS[s.code] !== undefined)
    .map((s) => s.evidence);

  // Category facts are inference, so they are labelled as such on the card.
  const inferred = signals.filter((s) => !s.specific).map((s) => s.evidence);

  const price = estimatePrice(business.category, business.categoryTypes);

  // Confidence rests on customer-reported friction. Volume alone is inference:
  // busy does not prove enquiries are being dropped.
  const confidence = confidenceFrom(friction.length);

  return {
    type: 'ai_system',
    score,
    band: bandFor(score, confidence),
    confidence,
    title: `AI ${angle.system} System`,
    reason,
    evidence: [...evidence, ...inferred],
    signalCodes: signals.filter((s) => s.specific).map((s) => s.code),
    pattern: PATTERNS[pattern],
    outreachAngle: `${angle.characteristic} — today that means ${angle.manualProcess}`,
    buyer: angle.buyer,
    angle: {
      label: angle.label,
      primaryAngle: pickAngle(signals, friction.length > 0),
      characteristic: angle.characteristic,
      scenario: angle.scenario,
      manualProcess: angle.manualProcess,
      outcome: angle.outcome,
      guardrail: angle.guardrail,
    },
    // AI systems price as setup plus a retainer — the recurring half is the point.
    value: {
      setupMin: Math.round(price.min * 1.2),
      setupMax: Math.round(price.max * 1.6),
      monthly: Math.round((price.min * 0.18) / 5000) * 5000,
    },
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * A business can qualify for both. That pairing is the largest sale available —
 * website first, then the system on top — so it is never collapsed to one.
 */
export function detectOpportunities(
  business: Business,
  seller: SellerOffer = 'both',
): OpportunityResult {
  const signals = extractSignals(business);

  const all = [detectWebsite(business, signals), detectAiSystem(business, signals)]
    .filter((o): o is Opportunity => o !== null);

  // The seller's own offer outranks raw score — a website builder should not be
  // handed a list topped by systems they cannot deliver.
  const ranked = [...all].sort((a, b) => {
    if (seller !== 'both') {
      const aMatch = a.type === seller ? 1 : 0;
      const bMatch = b.type === seller ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
    }
    return b.score - a.score;
  });

  return { primary: ranked[0] ?? null, all: ranked, signals };
}

/**
 * One lens per message. Derived from signals rather than left to the model, so that
 * "which angle closes deals" stays a query rather than a guess.
 */
function pickAngle(signals: Signal[], hasFriction: boolean): PrimaryAngle {
  if (hasFriction) {
    if (hasSignal(signals, 'booking_friction')) return 'customer_experience';
    if (hasSignal(signals, 'staff_stretched')) return 'staff_workload';
    if (hasSignal(signals, 'slow_response')) return 'speed_of_response';
    return 'missed_enquiry';
  }
  if (hasSignal(signals, 'high_review_volume')) return 'staff_workload';
  return 'missed_enquiry';
}

function short(name: string): string {
  return name.includes('(') ? name.split('(')[0].trim() : name;
}

function lower(category?: string): string {
  return (category ?? 'business').toLowerCase();
}
