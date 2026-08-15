// Buying-signal detection for local businesses.
//
// The local equivalent of Sales Navigator's "changed jobs" alert: a change in a
// business's public profile that means they just became receptive (or, in one
// case, that they are no longer worth pitching).
//
// Every detector compares the CURRENT CachedBusiness row against the OLDEST
// BusinessSnapshot inside a lookback window, so it measures real change over
// time rather than noise between two consecutive days.

export type TriggerType =
  | 'new_business'
  | 'review_surge'
  | 'rating_drop'
  | 'website_lost'
  | 'website_gained';

/** 'negative' means deprioritise — the signal is real but it is bad news. */
export type TriggerStrength = 'hot' | 'warm' | 'negative';

export interface DetectedTrigger {
  placeId: string;
  type: TriggerType;
  businessName: string;
  category?: string | null;
  city?: string | null;
  country: string;
  detail: string;
  strength: TriggerStrength;
}

/** Current state, from CachedBusiness. */
export interface BusinessNow {
  placeId: string;
  name: string;
  category?: string | null;
  city?: string | null;
  country: string;
  rating?: number | null;
  reviewCount?: number | null;
  hasWebsite: boolean;
  firstSeenAt: Date;
  /**
   * When we first indexed this business's (city, category) segment.
   *
   * firstSeenAt means "first seen by Runvax", not "opened" — so on a young or
   * expanding index every business looks new. Searching a new industry in an
   * already-covered city surfaces hundreds of long-established businesses that
   * are merely new *to us*. Comparing against when we started watching this
   * exact segment is what separates the two. Undefined suppresses new_business
   * entirely rather than guessing.
   */
  segmentFirstSeenAt?: Date | null;
}

/** Historical state, from the oldest BusinessSnapshot in the window. */
export interface BusinessThen {
  date: string;
  rating?: number | null;
  reviewCount?: number | null;
  hasWebsite: boolean;
}

export const TRIGGER_COPY: Record<TriggerType, { label: string; why: string }> = {
  new_business: {
    label: 'Just opened',
    why: 'No incumbent developer yet — you are not displacing anyone.',
  },
  review_surge: {
    label: 'Growing fast',
    why: 'Sudden customer growth usually means cash to invest right now.',
  },
  rating_drop: {
    label: 'Reputation slipping',
    why: 'They are feeling the pain publicly, which makes them receptive to help.',
  },
  website_lost: {
    label: 'Website went down',
    why: 'Their site died. Urgent, and whoever reaches them first usually wins.',
  },
  website_gained: {
    label: 'Just built a site',
    why: 'They bought from someone else. Deprioritise — do not waste a message.',
  },
};

// ── Thresholds ───────────────────────────────────────────────────────────────
// Deliberately conservative. A trigger that fires constantly is noise, and noise
// is what makes people ignore alerts entirely.

/** A business first seen within this many days counts as newly opened. */
export const NEW_BUSINESS_DAYS = 45;
/** …and only if it still has few reviews. */
export const NEW_BUSINESS_MAX_REVIEWS = 15;
/**
 * How long we must already have been indexing a (city, category) segment before
 * a business appearing in it can count as newly opened.
 *
 * Measured against real data: without this, 1662 of 3236 businesses fired as
 * "just opened" — the entire seeded index looked new. With it, 12 do, and they
 * are genuine (businesses surfacing weeks after we began covering that exact
 * area and industry).
 */
export const NEW_BUSINESS_SEGMENT_GRACE_DAYS = 14;

/** Review growth that counts as a surge: both a floor and a percentage, so a
 *  business going 2 → 5 doesn't fire while 40 → 60 does. */
export const SURGE_MIN_ABSOLUTE = 10;
export const SURGE_MIN_PCT = 40;

/** Rating fall that counts as a slip. Ratings move slowly, so this is small. */
export const RATING_DROP_MIN = 0.3;
/** Ignore rating moves on businesses with too few reviews — one bad review can
 *  swing a 3-review average by a full point and mean nothing. */
export const RATING_DROP_MIN_REVIEWS = 20;

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Run all five detectors for one business.
 *
 * `then` may be undefined when no snapshot exists yet — only new_business can
 * fire in that case, which is why that detector deliberately relies on
 * firstSeenAt rather than on snapshot history.
 */
export function detectTriggers(
  now: BusinessNow,
  then: BusinessThen | undefined,
  asOf: Date = new Date(),
): DetectedTrigger[] {
  const out: DetectedTrigger[] = [];
  const base = {
    placeId: now.placeId,
    businessName: now.name,
    category: now.category,
    city: now.city,
    country: now.country,
  };

  // 1. Newly opened — the only detector that works with no snapshot history,
  //    because it reads firstSeenAt rather than comparing two points in time.
  const age = daysBetween(asOf, now.firstSeenAt);
  const segmentAge = now.segmentFirstSeenAt
    ? daysBetween(now.firstSeenAt, now.segmentFirstSeenAt)
    : -1;
  if (
    age <= NEW_BUSINESS_DAYS &&
    (now.reviewCount ?? 0) <= NEW_BUSINESS_MAX_REVIEWS &&
    now.segmentFirstSeenAt != null &&
    now.firstSeenAt > now.segmentFirstSeenAt &&
    segmentAge >= NEW_BUSINESS_SEGMENT_GRACE_DAYS
  ) {
    out.push({
      ...base,
      type: 'new_business',
      strength: 'hot',
      detail: `Appeared ${age === 0 ? 'today' : `${age} days ago`} with ${now.reviewCount ?? 0} reviews, in an area we had already been tracking for ${segmentAge} days`,
    });
  }

  if (!then) return out;

  const span = daysBetween(asOf, new Date(`${then.date}T00:00:00Z`));

  // 2. Review surge — growing, and growth means budget.
  const before = then.reviewCount ?? 0;
  const after = now.reviewCount ?? 0;
  const gained = after - before;
  const pct = before > 0 ? (gained / before) * 100 : Infinity;
  if (gained >= SURGE_MIN_ABSOLUTE && pct >= SURGE_MIN_PCT) {
    out.push({
      ...base,
      type: 'review_surge',
      strength: 'hot',
      detail: `Reviews jumped ${before} → ${after} in ${span} days`,
    });
  }

  // 3. Rating drop — public pain, high receptiveness.
  if (
    then.rating != null && now.rating != null &&
    after >= RATING_DROP_MIN_REVIEWS &&
    then.rating - now.rating >= RATING_DROP_MIN
  ) {
    out.push({
      ...base,
      type: 'rating_drop',
      strength: 'warm',
      detail: `Rating fell ${then.rating.toFixed(1)} → ${now.rating.toFixed(1)} over ${span} days`,
    });
  }

  // 4. Website disappeared — the most urgent signal there is.
  if (then.hasWebsite && !now.hasWebsite) {
    out.push({
      ...base,
      type: 'website_lost',
      strength: 'hot',
      detail: `Had a website ${span} days ago, now has none — their site may be down or expired`,
    });
  }

  // 5. Website appeared — negative. Someone else got the job.
  if (!then.hasWebsite && now.hasWebsite) {
    out.push({
      ...base,
      type: 'website_gained',
      strength: 'negative',
      detail: `Built a website in the last ${span} days — no longer a no-website lead`,
    });
  }

  return out;
}
