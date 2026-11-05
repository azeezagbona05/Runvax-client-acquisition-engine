/**
 * Prospect finder options for Client Acquisition. The category and country lists mirror the Google Maps search
 * form on the RUNVAX 1.0 home page (same wording, so the same V1 search endpoint understands them). V1 is not edited.
 */

import { AREAS, STATES } from '@/lib/areas';

export const FINDER_INDUSTRIES = [
  'Restaurants & Eateries', 'Beauty Salons & Spas', 'Barbers & Hair Salons', 'Schools & Private Tutors', 'Clinics & Hospitals',
  'Dental Clinics', 'Pharmacies & Chemists', 'Pharmaceutical Companies', 'Real Estate Agencies', 'Hotels & Guesthouses',
  'Event Centers & Halls', 'Law Firms', 'Auto Workshops & Mechanics', 'Fashion & Boutiques', 'Photography Studios',
  'Gyms & Fitness Centers', 'Construction & Contractors', 'Catering Services', 'Churches & Ministries', 'Travel & Tour Agencies',
  'Supermarkets & Stores', 'Laundry & Dry Cleaning', 'Printing & Design Shops', 'Accounting & Tax Firms',
];

export const FINDER_COUNTRIES = [
  { code: 'NG', name: 'Nigeria' }, { code: 'GH', name: 'Ghana' }, { code: 'KE', name: 'Kenya' }, { code: 'ZA', name: 'South Africa' },
  { code: 'UG', name: 'Uganda' }, { code: 'TZ', name: 'Tanzania' }, { code: 'RW', name: 'Rwanda' }, { code: 'SN', name: 'Senegal' },
  { code: 'CM', name: 'Cameroon' }, { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }, { code: 'CA', name: 'Canada' },
  { code: 'OTHER', name: 'Other' },
];

/** The search sentence V1 sends to Google Places: "Dental Clinics in Lekki". */
export const finderQuery = (industry: string, location: string): string => `${industry.trim()} in ${location.trim()}`;

export interface FinderBusiness {
  id: string; name: string; address: string; phone?: string; website?: string; category?: string; rating?: number; reviewCount?: number;
  location?: { latitude: number; longitude: number };
  /** Which search found it: the first one, or the label of the load-more step. */
  foundBy?: string;
}

// ── Filtering and sorting the results table ─────────────────────────────────

export type WebsiteFilter = 'any' | 'with' | 'without';
export type RatingFilter = 'any' | '4.5+' | '4+' | '3.5+' | '3+' | 'under4' | 'under3.5' | 'unrated';
export type SortKey = 'found' | 'no-website-first' | 'website-first' | 'rating-high' | 'rating-low' | 'reviews-high';

export interface ResultFilters {
  website: WebsiteFilter;
  rating: RatingFilter;
  /** Fewest reviews to keep (0 = no minimum). */
  minReviews: number;
  phoneOnly: boolean;
  /** Only businesses whose email has been found (the caller supplies who). */
  emailOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: ResultFilters = { website: 'any', rating: 'any', minReviews: 0, phoneOnly: false, emailOnly: false, sort: 'found' };

const hasSite = (b: FinderBusiness) => !!b.website?.trim();

function ratingOk(b: FinderBusiness, f: RatingFilter): boolean {
  const r = b.rating;
  if (f === 'any') return true;
  if (f === 'unrated') return typeof r !== 'number';
  if (typeof r !== 'number') return false;
  switch (f) {
    case '4.5+': return r >= 4.5;
    case '4+': return r >= 4;
    case '3.5+': return r >= 3.5;
    case '3+': return r >= 3;
    case 'under4': return r < 4;
    case 'under3.5': return r < 3.5;
  }
}

/** The results that pass the filters, in the chosen order. Sorting is stable, so the original order breaks ties. */
export function filterResults(all: FinderBusiness[], f: ResultFilters, hasEmail: (b: FinderBusiness) => boolean = () => false): FinderBusiness[] {
  const kept = all.filter((b) =>
    (f.website === 'any' || (f.website === 'with') === hasSite(b))
    && ratingOk(b, f.rating)
    && (f.minReviews <= 0 || (b.reviewCount ?? 0) >= f.minReviews)
    && (!f.phoneOnly || !!b.phone?.trim())
    && (!f.emailOnly || hasEmail(b)));
  const idx = new Map(all.map((b, i) => [b.id, i]));
  const num = (v: number | undefined, missing: number) => (typeof v === 'number' ? v : missing);
  const cmp: Record<SortKey, (a: FinderBusiness, b: FinderBusiness) => number> = {
    found: () => 0,
    'no-website-first': (a, b) => Number(hasSite(a)) - Number(hasSite(b)),
    'website-first': (a, b) => Number(hasSite(b)) - Number(hasSite(a)),
    // Unrated businesses go last whichever way the rating is sorted.
    'rating-high': (a, b) => num(b.rating, -1) - num(a.rating, -1),
    'rating-low': (a, b) => num(a.rating, 99) - num(b.rating, 99),
    'reviews-high': (a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
  };
  return kept.sort((a, b) => cmp[f.sort](a, b) || (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
}

export function filtersActive(f: ResultFilters): boolean {
  return f.website !== 'any' || f.rating !== 'any' || f.minReviews > 0 || f.phoneOnly || f.emailOnly;
}

// ── Contact discovery: where each business is in the workflow ───────────────
//   business → decision-maker → email → verified → ready for a campaign

export type ContactState = 'untouched' | 'verified' | 'unverified' | 'person_no_email' | 'business_only' | 'none';
export type Verdict = 'valid' | 'invalid' | 'unknown';
export type ContactAction = 'find_dm' | 'find_email' | 'verify' | 'retry';

export interface ContactPerson { name: string; title: string; email?: string; emailStatus?: string }

export const CONTACT_LABEL: Record<ContactState, string> = {
  untouched: 'Not searched yet',
  verified: 'Verified contact',
  unverified: 'Email found, not verified',
  person_no_email: 'Person found, email missing',
  business_only: 'Business contact only',
  none: 'No decision-maker found',
};

export const CONTACT_ACTION: Record<ContactState, ContactAction | null> = {
  untouched: 'find_dm', business_only: 'find_dm', person_no_email: 'find_email', unverified: 'verify', none: 'retry', verified: null,
};

export const ACTION_LABEL: Record<ContactAction, string> = {
  find_dm: 'Find decision-maker', find_email: 'Find email', verify: 'Verify email', retry: 'Retry discovery',
};

/** Did the source that found this address already confirm it exists? ("Snov.io: valid", "verified", "deliverable"; never "not_valid"/"invalid"). */
export function isVerifiedStatus(status?: string): boolean {
  if (!status) return false;
  if (/not[\s_-]?valid|invalid|undeliverable|unknown|catch/i.test(status)) return false;
  return /\b(valid|verified|deliverable|exists)\b/i.test(status);
}

/**
 * The state of one business.
 * `people` is null until the decision-maker search has run; `businessEmail` is undefined until the
 * business-email search has run. `verdicts` holds results of a verify run, keyed by lowercase email, and beats the finder's own note.
 */
export function contactState(input: { people: ContactPerson[] | null; businessEmail?: string | null; verdicts?: Record<string, Verdict> }): ContactState {
  const verdicts = input.verdicts ?? {};
  const usable = (input.people ?? []).filter((p) => p.email && verdicts[p.email.toLowerCase()] !== 'invalid');
  const isOk = (p: ContactPerson) => { const v = verdicts[p.email!.toLowerCase()]; return v ? v === 'valid' : isVerifiedStatus(p.emailStatus); };
  if (usable.some(isOk)) return 'verified';
  if (usable.length) return 'unverified';
  if ((input.people ?? []).length) return 'person_no_email';
  if (input.businessEmail) return 'business_only';
  return input.people === null ? 'untouched' : 'none';
}

/** Validates the form like V1 does: a category from the list and a location. Returns the error, or null. */
export function finderError(industry: string, location: string): string | null {
  if (!industry.trim()) return 'Choose a business category.';
  if (!FINDER_INDUSTRIES.some((i) => i.toLowerCase() === industry.trim().toLowerCase())) return 'Pick a category from the list.';
  if (!location.trim()) return 'Enter a location.';
  return null;
}

// ── Load more: same location first, then the next landmark, then V1's wider grid ──────────────────────────────


export type StepKind = 'same' | 'landmark' | 'grid';
export interface FinderCtx {
  industry: string; location: string; country: string; stateCode: string; radius: number;
  phase: StepKind; index: number; landmarks: string[]; centre?: { lat: number; lng: number }; done: boolean;
}
export interface FinderStep { kind: StepKind; label: string; location: string; query: string; lat?: number; lng?: number }

/** Other ways of asking Google Maps for the same place. Each can surface listings the first wording missed. */
export const sameLocationQueries = (industry: string, location: string): string[] => [
  `${industry.trim()} near ${location.trim()}`,
  `best ${industry.trim()} in ${location.trim()}`,
  `${industry.trim()} ${location.trim()} contact`,
];

const norm = (s: string) => s.trim().toLowerCase();

/** Nearby landmarks for a location, closest first: same local area, then same city, then other cities of the same state. */
export function landmarksFor(location: string, country: string, stateCode = '', max = 100): string[] {
  const here = AREAS.find((a) => a.country === country && norm(a.name) === norm(location));
  const stateCities = (here ? STATES.find((s) => s.country === country && s.cities.includes(here.city))?.cities : STATES.find((s) => s.code === stateCode)?.cities) ?? [];
  const pool = AREAS.filter((a) => a.country === country && norm(a.name) !== norm(location));
  const rank = (a: (typeof AREAS)[number]) => (here && a.lga && a.lga === here.lga ? 0 : here && a.city === here.city ? 1 : stateCities.includes(a.city) ? 2 : 9);
  return pool.map((a) => ({ a, r: rank(a) })).filter((x) => x.r < 9).sort((x, y) => x.r - y.r).slice(0, max).map((x) => x.a.name);
}

export function startFinder(industry: string, location: string, country: string, stateCode: string, centre?: { lat: number; lng: number }, radius = 5): FinderCtx {
  return { industry, location, country, stateCode, radius, phase: 'same', index: 0, landmarks: landmarksFor(location, country, stateCode), centre, done: false };
}

const RINGS = [0.5, 1.0, 1.5, 2.0];
const COMPASS: Array<[number, number]> = [[1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707]];
const DIR_NAME = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const GRID_STEPS = 32;
/** The most searches one Keep-finding run may use. */
export const MAX_RUN_SEARCHES = 100;

/** V1's grid shift: four rings (0.5x, 1x, 1.5x, 2x the radius) of eight compass directions around the centre. */
export function gridPoint(centre: { lat: number; lng: number }, radius: number, n: number) {
  const offset = radius * RINGS[Math.min(Math.floor(n / 8), RINGS.length - 1)];
  const [dLat, dLng] = COMPASS[n % 8];
  return { lat: centre.lat + (dLat * offset) / 111, lng: centre.lng + (dLng * offset) / (111 * Math.cos((centre.lat * Math.PI) / 180)), ring: Math.floor(n / 8) + 1, dir: DIR_NAME[n % 8] };
}

/** Skips phases that have nothing left, so the next step is always a real one. */
function settle(c: FinderCtx): FinderCtx {
  let x = c;
  if (x.phase === 'same' && x.index >= sameLocationQueries(x.industry, x.location).length) x = { ...x, phase: 'landmark', index: 0 };
  if (x.phase === 'landmark' && x.index >= x.landmarks.length) x = { ...x, phase: 'grid', index: 0 };
  if (x.phase === 'grid' && (x.index >= GRID_STEPS || !x.centre)) x = { ...x, done: true };
  return x;
}

/** The search the next "Load more" will run, or null when everything has been tried. */
export function planStep(c: FinderCtx): FinderStep | null {
  const x = settle(c);
  if (x.done) return null;
  if (x.phase === 'same') return { kind: 'same', label: `More from ${x.location}`, location: x.location, query: sameLocationQueries(x.industry, x.location)[x.index] };
  if (x.phase === 'landmark') { const name = x.landmarks[x.index]; return { kind: 'landmark', label: `Next area: ${name}`, location: name, query: finderQuery(x.industry, name) }; }
  const p = gridPoint(x.centre!, x.radius, x.index);
  return { kind: 'grid', label: `Wider area: ${['inner', 'middle', 'outer', 'far'][p.ring - 1]} ring, ${p.dir}`, location: x.location, query: finderQuery(x.industry, x.location), lat: p.lat, lng: p.lng };
}

/** Moves on after a step ran. A same-location search that found nothing new ends that phase early, and so does the first dry grid ring. */
export function advanceFinder(c: FinderCtx, fresh: number): FinderCtx {
  const x = settle(c);
  if (x.done) return x;
  if (x.phase === 'same') return settle({ ...x, index: fresh === 0 ? Infinity : x.index + 1 });
  return settle({ ...x, index: x.index + 1 });
}

/** How many steps remain, for the button label. */
export function stepsLeft(c: FinderCtx): number {
  const x = settle(c);
  if (x.done) return 0;
  const same = x.phase === 'same' ? sameLocationQueries(x.industry, x.location).length - x.index : 0;
  const land = x.phase === 'landmark' ? x.landmarks.length - x.index : x.phase === 'same' ? x.landmarks.length : 0;
  const grid = x.centre ? (x.phase === 'grid' ? GRID_STEPS - x.index : GRID_STEPS) : 0;
  return same + land + grid;
}

/** In keep-finding mode, this many steps in a row with nothing new means Google has nothing more to give here. */
export const MAX_DRY_STREAK = 6;

/** Whether a keep-finding run should stop, and why. Null means carry on. */
export function stopReason(ctx: FinderCtx, dryStreak: number): string | null {
  if (!planStep(ctx)) return 'Every nearby area and search has been tried. There is nothing more to find here.';
  if (dryStreak >= MAX_DRY_STREAK) return `The last ${MAX_DRY_STREAK} searches found nothing new, so this area looks exhausted.`;
  return null;
}
