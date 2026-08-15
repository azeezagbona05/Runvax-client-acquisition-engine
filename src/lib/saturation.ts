// Pure lead-saturation helpers. No server-only imports (no prisma), so this file
// is safe to import from both client components and API routes — same rule as
// src/lib/features.ts.

/** Aggregate outreach signal for one business. Never contains user identities. */
export interface Saturation {
  businessId: string;
  /** Distinct Runvax users who have sent this business a message, including you. */
  userCount: number;
  /** Same count excluding you — what the badge actually shows. */
  otherCount: number;
  youContacted: boolean;
  /** Most recent send across all users, ISO. Null when nobody has sent. */
  lastSentAt: string | null;
  yourLastSentAt: string | null;
}

export type Heat = 'untouched' | 'light' | 'warm' | 'saturated' | 'cooled';

/** Sends older than this stop counting as competition — the lead has gone cold
 *  for whoever contacted it, which makes it fair game again. */
export const COOLED_AFTER_DAYS = 90;

export function emptySaturation(businessId: string): Saturation {
  return {
    businessId,
    userCount: 0,
    otherCount: 0,
    youContacted: false,
    lastSentAt: null,
    yourLastSentAt: null,
  };
}

/**
 * Business ids we can meaningfully aggregate across users.
 *
 * Google Place ids and `osm_<id>` are globally stable — two users searching the
 * same street get the same id. `manual_<ts>_<rand>` ids are minted per user, so
 * they can never collide and would always report a count of 1.
 */
export function isTrackableBusinessId(id: string | undefined | null): boolean {
  if (!id) return false;
  return !id.startsWith('manual_');
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Heat is a function of *both* count and recency — 14 users six months ago is a
 * revivable lead, 3 users yesterday is a bidding war. Collapsing that to a raw
 * count is what makes most "already contacted" features useless.
 */
export function heatOf(s: Saturation): Heat {
  if (s.otherCount === 0) return 'untouched';
  const age = daysSince(s.lastSentAt);
  if (age != null && age >= COOLED_AFTER_DAYS) return 'cooled';
  if (s.otherCount >= 10) return 'saturated';
  if (s.otherCount >= 4) return 'warm';
  return 'light';
}

/** "today" | "yesterday" | "3 days ago" | "2 weeks ago" | "5 months ago" */
export function relativeDays(iso: string | null): string {
  const d = daysSince(iso);
  if (d == null) return '';
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

export const HEAT_COPY: Record<Heat, { label: string; hint: string }> = {
  untouched: {
    label: 'Untouched',
    hint: 'No one on Runvax has messaged this business. You are first.',
  },
  light: {
    label: 'Lightly contacted',
    hint: 'A few others have reached out recently. A specific, non-generic opener still wins here.',
  },
  warm: {
    label: 'Getting crowded',
    hint: 'This business is hearing from several people. Lead with something none of them would say.',
  },
  saturated: {
    label: 'Saturated',
    hint: 'This owner is being flooded. Only a genuinely different angle is worth your time.',
  },
  cooled: {
    label: 'Gone quiet',
    hint: 'Contacted before, but nothing recent — those conversations went nowhere. Good revival target.',
  },
};

/** The one-line badge string, e.g. "14 users messaged this · last 2 days ago". */
export function saturationLabel(s: Saturation): string {
  if (s.otherCount === 0) {
    return s.youContacted ? 'Only you have messaged this' : 'No one has messaged this yet';
  }
  const who = s.youContacted
    ? `You + ${s.otherCount} ${s.otherCount === 1 ? 'other' : 'others'}`
    : `${s.otherCount} ${s.otherCount === 1 ? 'user' : 'users'}`;
  const when = relativeDays(s.lastSentAt);
  return when ? `${who} messaged this · last ${when}` : `${who} messaged this`;
}
