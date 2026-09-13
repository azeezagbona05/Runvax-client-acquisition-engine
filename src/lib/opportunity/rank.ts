/**
 * Ranking — turning a search result set into "opportunities worth pursuing".
 *
 * This is the layer the product promise actually rests on: the list is a cut, not
 * a sort. A business that does not qualify is absent, not ranked last. If every
 * business survives, the page is still a directory with better labels.
 *
 * Two gates, in order:
 *
 *   1. Business strength — is this a real, healthy business that could pay?
 *   2. Opportunity — is there something specific to sell them?
 *
 * Strength comes first deliberately. A dormant business with no website is a
 * perfect-looking opportunity and a worthless lead, and putting the strength gate
 * second lets exactly that business reach the top of the list.
 */

import type { Business } from '@/types';
import { detectOpportunities } from './detect';
import type { Opportunity, SellerOffer } from './types';

export interface RankedOpportunity {
  business: Business;
  opportunity: Opportunity;
  /** 0-100. Kept alongside the opportunity score so the two stay separable —
   *  "strong business, weak opportunity" is a different thing from its inverse. */
  strength: number;
}

/**
 * Business strength — evidence that this is a going concern with customers.
 *
 * Reviews are the backbone because they are the one public, hard-to-fake measure
 * of real trade that Google gives us. They are not used alone: review count with
 * a poor rating is a business with problems, not a business doing well.
 */
export function businessStrength(b: Business): number {
  let s = 0;

  // ── Reputation (0-55) — proven customers, and proven satisfaction ──
  const reviews = b.reviewCount ?? 0;
  if (reviews >= 500) s += 35;
  else if (reviews >= 200) s += 30;
  else if (reviews >= 100) s += 25;
  else if (reviews >= 50) s += 20;
  else if (reviews >= 20) s += 12;
  else if (reviews >= 5) s += 5;

  const rating = b.rating ?? 0;
  if (rating >= 4.5) s += 20;
  else if (rating >= 4.0) s += 15;
  else if (rating >= 3.5) s += 8;
  else if (rating > 0) s += 2;      // rated, but poorly — a turnaround, not a win

  // ── Activity (0-25) — still trading, and recently ──
  if (b.status === 'OPERATIONAL') s += 12;
  if (b.lastReviewDate) {
    const days = (Date.now() - new Date(b.lastReviewDate).getTime()) / 864e5;
    if (days <= 90) s += 13;
    else if (days <= 365) s += 7;
    // Older than a year: no credit. The listing may be running on old momentum.
  }

  // ── Operational completeness (0-20) — someone is tending the business ──
  if (b.phone) s += 8;
  if (b.hoursComplete !== false) s += 6;
  if (b.hasWebsite) s += 6;         // proof they have bought digital before

  return Math.min(100, s);
}

/** Below this a business is not credible enough to spend outreach on. */
export const MIN_STRENGTH = 45;

export interface RankOptions {
  /** What the user sells. Ranks their own offer first. */
  seller?: SellerOffer;
  /** Lower the bar — used when a strict cut would return nothing. */
  minStrength?: number;
  /** Hard cap on the shortlist. The promise is a short list, not a full page. */
  limit?: number;
}

/**
 * The full cut. Returns only businesses that are both credible and have a
 * detectable opportunity, ranked by opportunity score.
 */
export function rankOpportunities(
  businesses: Business[],
  { seller = 'both', minStrength = MIN_STRENGTH, limit = 25 }: RankOptions = {},
): RankedOpportunity[] {
  const ranked: RankedOpportunity[] = [];

  for (const business of businesses) {
    const strength = businessStrength(business);
    if (strength < minStrength) continue;

    const { primary } = detectOpportunities(business, seller);
    if (!primary) continue;

    ranked.push({ business, opportunity: primary, strength });
  }

  // Opportunity score leads; strength breaks ties, so between two equally good
  // cases the healthier business wins.
  ranked.sort((a, b) =>
    b.opportunity.score - a.opportunity.score || b.strength - a.strength);

  return ranked.slice(0, limit);
}

/**
 * How many of a result set were dropped, and why. The UI needs this to explain
 * itself — "12 of 84 worth pursuing" is only trustworthy if we can say what
 * happened to the other 72.
 */
export function rankSummary(businesses: Business[], opts: RankOptions = {}) {
  const minStrength = opts.minStrength ?? MIN_STRENGTH;
  let weak = 0;
  let noOpportunity = 0;

  for (const business of businesses) {
    if (businessStrength(business) < minStrength) { weak++; continue; }
    if (!detectOpportunities(business, opts.seller ?? 'both').primary) noOpportunity++;
  }

  return { total: businesses.length, weak, noOpportunity };
}
