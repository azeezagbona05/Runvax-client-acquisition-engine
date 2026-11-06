/**
 * Signal extraction — facts only.
 *
 * A signal is something we can point at in the business record. It is never an
 * interpretation ("they need a booking system") and never a guess ("they get 200
 * messages a week"). Interpretation happens one layer up, in detect.ts.
 *
 * Every signal carries the evidence string shown to the user, so the opportunity
 * card can always answer "why do you think that?" with a fact rather than a claim.
 *
 * Pure functions over Business — no I/O, no AI, cheap enough to run on every
 * search result.
 */

import type { Business } from '@/types';

export type SignalCode =
  // ── Digital presence ──
  | 'no_website'
  | 'social_only'
  | 'has_website'
  | 'slow_website'
  | 'phone_only'
  // ── Category-derived (the ceiling, not the ranking) ──
  | 'appointment_driven'
  | 'enquiry_heavy'
  | 'high_ticket'
  | 'multi_service'
  // ── Demand ──
  | 'high_review_volume'
  | 'strong_rating'
  // ── Customer-reported friction (business-specific, the good stuff) ──
  | 'missed_enquiries'
  | 'slow_response'
  | 'booking_friction'
  | 'staff_stretched'
  | 'info_gap'
  // ── Listing hygiene ──
  | 'incomplete_hours'
  | 'stale_listing';

export interface Signal {
  code: SignalCode;
  /** Shown verbatim on the opportunity card. Must be a fact, not an inference. */
  evidence: string;
  /** True when this signal describes THIS business rather than its category.
   *  Only these move a business up or down within its category band, and only
   *  these raise confidence. */
  specific: boolean;
}

// ─── Category tables ──────────────────────────────────────────────────────────
// These give a business its ceiling. They deliberately do NOT rank two businesses
// in the same category — that is what the `specific` signals are for.

const APPOINTMENT_CATEGORIES = [
  'clinic', 'hospital', 'medical', 'doctor', 'dentist', 'dental', 'optician',
  'salon', 'spa', 'barber', 'hair', 'nail', 'beauty',
  'gym', 'fitness', 'yoga', 'physio',
  'law', 'legal', 'solicitor', 'barrister',
  'consultant', 'accounting', 'audit', 'finance',
  'photography', 'studio',
  'auto', 'mechanic', 'workshop', 'repair',
  'school', 'academy', 'tutor', 'lesson',
];

const ENQUIRY_CATEGORIES = [
  'real estate', 'property', 'estate agent', 'realty',
  'hotel', 'motel', 'resort', 'guesthouse', 'lodge',
  'event', 'catering', 'wedding', 'venue',
  'travel', 'tour', 'logistics', 'courier', 'shipping', 'transport',
  'construction', 'contractor', 'builder', 'interior',
  'school', 'college', 'university', 'academy',
  'clinic', 'hospital', 'medical', 'dentist', 'dental',
  'law', 'legal', 'consultant',
];

const HIGH_TICKET_CATEGORIES = [
  'real estate', 'property', 'estate agent', 'realty',
  'hotel', 'motel', 'resort',
  'law', 'legal', 'solicitor',
  'hospital', 'clinic', 'medical', 'dentist', 'dental',
  'construction', 'contractor', 'builder',
  'school', 'college', 'university', 'academy',
  'accounting', 'finance', 'audit', 'consultant',
  'event', 'catering', 'wedding', 'venue',
  'auto', 'car dealer', 'automobile',
];

const MULTI_SERVICE_CATEGORIES = [
  'clinic', 'hospital', 'medical', 'dentist', 'dental',
  'salon', 'spa', 'beauty',
  'gym', 'fitness',
  'law', 'legal', 'consultant', 'accounting',
  'construction', 'contractor',
  'auto', 'mechanic', 'workshop',
  'event', 'catering',
  'school', 'academy',
];

function categoryText(business: Business): string {
  return `${business.category ?? ''} ${(business.categoryTypes ?? []).join(' ')}`.toLowerCase();
}

function matches(business: Business, keys: string[]): boolean {
  const text = categoryText(business);
  return keys.some((k) => text.includes(k));
}

// ─── Review-text patterns ─────────────────────────────────────────────────────
// The richest business-specific evidence we hold, and the only place a customer
// tells us directly that enquiries are being dropped. Phrasing is deliberately
// conservative: we would rather miss a match than manufacture one.

const REVIEW_PATTERNS: Array<{
  code: SignalCode;
  label: string;
  patterns: RegExp[];
}> = [
  {
    code: 'missed_enquiries',
    label: 'unanswered calls or messages',
    patterns: [
      /\bno(?:body)?\s+(?:one\s+)?(?:answer|pick|respond)/i,
      /\b(?:didn'?t|did not|never)\s+(?:answer|pick up|respond|reply|call back|get back)/i,
      /\bcalled\s+(?:several|many|multiple|three|four|five|\d+)\s+times/i,
      /\bunable to reach\b|\bcouldn'?t reach\b|\bcan'?t get (?:hold of|through)/i,
      /\bphone (?:is )?(?:always )?(?:off|busy|unreachable)/i,
    ],
  },
  {
    code: 'slow_response',
    label: 'slow replies',
    patterns: [
      /\b(?:took|waited)\s+(?:days|a week|weeks|forever|ages)\b/i,
      /\bslow (?:to )?(?:respond|reply|response)/i,
      /\bstill waiting\b|\bno (?:reply|response) (?:yet|after)/i,
      /\bhad to (?:chase|follow up|keep calling)/i,
    ],
  },
  {
    code: 'booking_friction',
    label: 'difficulty booking',
    patterns: [
      /\b(?:hard|difficult|impossible)\s+to\s+(?:book|get an appointment|schedule|reserve)/i,
      /\b(?:booking|appointment)\s+(?:was\s+)?(?:a\s+)?(?:hassle|nightmare|stress|problem)/i,
      /\bno (?:online )?booking\b/i,
      /\b(?:long|endless)\s+(?:wait|queue|line)\b/i,
      /\bwaited\s+(?:over\s+)?(?:an? )?(?:hour|\d+\s*(?:hours|minutes|hrs|mins))/i,
    ],
  },
  {
    // Customers asking in a review what should have been on a page. This is the
    // one review signal that argues for a website rather than a system.
    code: 'info_gap',
    label: 'not being able to find prices or service details',
    patterns: [
      /\bno (?:price|prices|pricing|menu|rates?)\s+(?:list|listed|shown|anywhere|online)/i,
      /\b(?:couldn'?t|can'?t|hard to)\s+find\s+(?:their|the)?\s*(?:price|prices|menu|rates?|address|location|opening|hours)/i,
      /\b(?:had to|have to)\s+call\s+(?:to|just to)\s+(?:find out|ask|know|check)/i,
      /\bwish (?:they|there) (?:had|was)\s+(?:a\s+)?(?:website|online|price list|menu online)/i,
      /\bnothing online\b|\bno (?:online )?information\b/i,
    ],
  },
  {
    code: 'staff_stretched',
    label: 'staff stretched thin',
    patterns: [
      /\b(?:under|short)[-\s]?staffed\b/i,
      /\bonly one (?:person|staff|attendant|receptionist)/i,
      /\b(?:too|very)\s+busy\s+to\s+(?:help|attend|answer)/i,
      /\bovercrowded\b|\balways (?:packed|crowded|full)/i,
    ],
  },
];

function reviewText(business: Business): string {
  return (business.reviews ?? []).map((r) => r.text ?? '').join(' \n ');
}

// ─── Extraction ───────────────────────────────────────────────────────────────

export function extractSignals(business: Business): Signal[] {
  const signals: Signal[] = [];
  const push = (code: SignalCode, evidence: string, specific: boolean) =>
    signals.push({ code, evidence, specific });

  // ── Digital presence ──
  const site = business.website ?? '';
  const isSocial = /facebook\.com|instagram\.com|linktr\.ee|wa\.me/i.test(site);

  if (!business.hasWebsite) {
    push('no_website', 'No website found on their public business listing', true);
    if (isSocial) push('social_only', 'Only a social media page is linked, not a website', true);
  } else {
    const domain = site.replace(/^https?:\/\//, '').split('/')[0];
    push('has_website', domain ? `Has a website (${domain})` : 'Already has a website', true);
    if (typeof business.psiScore === 'number' && business.psiScore < 50) {
      push('slow_website', `Their site scores ${business.psiScore}/100 on Google PageSpeed`, true);
    }
  }

  if (business.phone && !business.email && !business.hasWebsite) {
    push('phone_only', 'Phone is the only way to reach them', true);
  }

  // ── Category-derived ceiling ──
  if (matches(business, APPOINTMENT_CATEGORIES)) {
    push('appointment_driven', `${business.category} is an appointment-based business`, false);
  }
  if (matches(business, ENQUIRY_CATEGORIES)) {
    push('enquiry_heavy', `${business.category} typically fields pricing and availability questions`, false);
  }
  if (matches(business, HIGH_TICKET_CATEGORIES)) {
    push('high_ticket', 'Each customer is potentially high value in this category', false);
  }
  if (matches(business, MULTI_SERVICE_CATEGORIES)) {
    push('multi_service', 'Businesses of this type usually offer several distinct services', false);
  }

  // ── Demand ──
  if ((business.reviewCount ?? 0) >= 50) {
    push('high_review_volume', `${business.reviewCount} Google reviews`, true);
  }
  if ((business.rating ?? 0) >= 4.3 && (business.reviewCount ?? 0) >= 10) {
    push('strong_rating', `Rated ${business.rating} from ${business.reviewCount} reviews`, true);
  }

  // ── Customer-reported friction ──
  const text = reviewText(business);
  if (text.trim()) {
    for (const { code, label, patterns } of REVIEW_PATTERNS) {
      const hit = patterns.find((p) => p.test(text));
      if (hit) {
        const sentence = firstMatchingSentence(text, hit);
        push(code, sentence ? `A review mentions ${label}: "${sentence}"` : `A review mentions ${label}`, true);
      }
    }
  }

  // ── Listing hygiene ──
  if (business.hoursComplete === false) {
    push('incomplete_hours', 'Opening hours are not listed on Google', true);
  }
  if (business.lastReviewDate && monthsSince(business.lastReviewDate) >= 12) {
    push('stale_listing', 'No new Google review in over a year', true);
  }

  return signals;
}

/** Pull the sentence a pattern matched, trimmed for display on a card. */
function firstMatchingSentence(text: string, pattern: RegExp): string | null {
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    if (sentence && pattern.test(sentence)) {
      return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
    }
  }
  return null;
}

function monthsSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return (Date.now() - then) / (1000 * 60 * 60 * 24 * 30);
}

export function hasSignal(signals: Signal[], code: SignalCode): boolean {
  return signals.some((s) => s.code === code);
}

/** Signals that describe this business rather than its category. Drives both
 *  intra-category ranking and confidence. */
export function specificSignals(signals: Signal[]): Signal[] {
  return signals.filter((s) => s.specific);
}
