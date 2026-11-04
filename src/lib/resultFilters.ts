/**
 * Filters and presets for the search results list. Pure functions over businesses that are
 * already on the page, so changing a filter costs nothing and never triggers a new search.
 */

import type { Business } from '@/types';
import type { OpportunityBand } from '@/lib/opportunity/types';

export type WebsiteFilter = 'any' | 'has' | 'none' | 'social';
export type SortKey = 'best' | 'ai_fit' | 'rating' | 'reviews';

export interface ResultFilters {
  website: WebsiteFilter;
  phone: boolean;
  email: boolean;
  namedOwner: boolean;
  minRating: number;
  minReviews: number;
  /** Lowest AI-system fit to keep. 'any' keeps everything. */
  aiFit: 'any' | 'possible' | 'good' | 'strong';
  openOnly: boolean;
  slowSite: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: ResultFilters = {
  website: 'any', phone: false, email: false, namedOwner: false,
  minRating: 0, minReviews: 0, aiFit: 'any', openOnly: false, slowSite: false, sort: 'best',
};

export interface AiFit { score: number; band: OpportunityBand }

const BAND_ORDER: OpportunityBand[] = ['low', 'possible', 'good', 'strong', 'high'];
const MIN_BAND: Record<Exclude<ResultFilters['aiFit'], 'any'>, OpportunityBand> = {
  possible: 'possible', good: 'good', strong: 'strong',
};

export function isSocialOnly(b: Pick<Business, 'website'>): boolean {
  return !!b.website && /instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|linktr\.ee|wa\.me/.test(b.website);
}

/** A real website of their own — not absent, and not just a social page. */
export function hasRealWebsite(b: Pick<Business, 'hasWebsite' | 'website'>): boolean {
  return b.hasWebsite && !isSocialOnly(b);
}

export function activeFilterCount(f: ResultFilters): number {
  return (Object.keys(DEFAULT_FILTERS) as (keyof ResultFilters)[])
    .filter((k) => k !== 'sort' && f[k] !== DEFAULT_FILTERS[k]).length;
}

export function matchesFilters(b: Business, f: ResultFilters, fit?: AiFit): boolean {
  if (f.website === 'has' && !hasRealWebsite(b)) return false;
  if (f.website === 'none' && b.hasWebsite) return false;
  if (f.website === 'social' && !isSocialOnly(b)) return false;
  if (f.phone && !b.phone) return false;
  if (f.email && !b.email) return false;
  if (f.namedOwner && !b.decisionMaker?.name) return false;
  if (f.minRating > 0 && (b.rating ?? 0) < f.minRating) return false;
  if (f.minReviews > 0 && (b.reviewCount ?? 0) < f.minReviews) return false;
  if (f.openOnly && b.status && b.status !== 'OPERATIONAL') return false;
  if (f.slowSite && !(typeof b.psiScore === 'number' && b.psiScore < 50)) return false;
  if (f.aiFit !== 'any') {
    if (!fit) return false;
    if (BAND_ORDER.indexOf(fit.band) < BAND_ORDER.indexOf(MIN_BAND[f.aiFit])) return false;
  }
  return true;
}

/**
 * Filters then orders. `best` keeps the caller's existing order (the default lead score);
 * the others are explicit and ties fall back to that order, so results never shuffle randomly.
 */
export function applyFilters(
  ordered: Business[], f: ResultFilters, fits: Map<string, AiFit>,
): Business[] {
  const kept = ordered.filter((b) => matchesFilters(b, f, fits.get(b.id)));
  const key: Record<Exclude<SortKey, 'best'>, (b: Business) => number> = {
    ai_fit: (b) => fits.get(b.id)?.score ?? -1,
    rating: (b) => b.rating ?? -1,
    reviews: (b) => b.reviewCount ?? -1,
  };
  if (f.sort === 'best') return kept;
  const k = key[f.sort];
  return kept
    .map((b, i) => ({ b, i }))
    .sort((a, c) => k(c.b) - k(a.b) || a.i - c.i)
    .map((x) => x.b);
}

export interface FilterPreset {
  id: string;
  label: string;
  hint: string;
  filters: ResultFilters;
}

export const PRESETS: FilterPreset[] = [
  {
    id: 'ai_receptionist',
    label: 'AI receptionist targets',
    hint: 'Real website, a phone, still open, enough reviews to be busy — best AI-system fit first.',
    filters: { ...DEFAULT_FILTERS, website: 'has', phone: true, openOnly: true, minReviews: 10, aiFit: 'possible', sort: 'ai_fit' },
  },
  {
    id: 'website_sales',
    label: 'Need a website',
    hint: 'No website of their own, but reachable and well reviewed.',
    filters: { ...DEFAULT_FILTERS, website: 'none', phone: true, openOnly: true, minReviews: 10, sort: 'reviews' },
  },
  {
    id: 'reachable',
    label: 'Easiest to reach',
    hint: 'Has a phone and an email on file.',
    filters: { ...DEFAULT_FILTERS, phone: true, email: true, openOnly: true },
  },
  {
    id: 'slow_site',
    label: 'Slow website',
    hint: 'Has a site that scores under 50 on Google PageSpeed.',
    filters: { ...DEFAULT_FILTERS, website: 'has', slowSite: true, openOnly: true },
  },
];

export function matchingPreset(f: ResultFilters): string | null {
  const same = (a: ResultFilters, b: ResultFilters) => (Object.keys(a) as (keyof ResultFilters)[]).every((k) => a[k] === b[k]);
  return PRESETS.find((p) => same(p.filters, f))?.id ?? null;
}
