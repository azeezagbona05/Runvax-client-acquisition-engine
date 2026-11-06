/**
 * Launch offer + pricing switch. Pure (no server imports) so client components can use it.
 *
 * The offer: every new verified account gets TRIAL_DAYS days of Pro (Professional) for $0, no card, started automatically; existing free
 * accounts can activate it from a banner. It is a
 * real plan change (plan = Pro, planExpiresAt = +TRIAL_DAYS days); the existing expire-plans cron puts
 * the account back on Free when the week is up. One trial per account.
 *
 * PRICING_ENABLED hides every price, the pricing page and checkout until new prices are set.
 * Flip it to true to bring them back; the pricing page, plans and Paystack code are untouched.
 */

export const PRICING_ENABLED = false;

export const TRIAL_PLAN = 'pro' as const;
export const TRIAL_DAYS = 10;

// Last moment a trial can be started (exclusive): the end of 1 November, launch day. Each trial then runs TRIAL_DAYS from the day
// it is started. One constant drives the app, the API and the launch email. Override per
// environment with NEXT_PUBLIC_TRIAL_OFFER_UNTIL (ISO 8601 with offset).
const DEFAULT_OFFER_ENDS_AT = '2099-01-01T00:00:00+01:00'; // the offer is ongoing; set NEXT_PUBLIC_TRIAL_OFFER_UNTIL to close it

export function trialOfferEndsAt(): Date {
  const raw = process.env.NEXT_PUBLIC_TRIAL_OFFER_UNTIL?.trim();
  const d = new Date(raw || DEFAULT_OFFER_ENDS_AT);
  return Number.isNaN(d.getTime()) ? new Date(DEFAULT_OFFER_ENDS_AT) : d;
}

export function trialOfferOpen(now: Date = new Date()): boolean {
  return now.getTime() < trialOfferEndsAt().getTime();
}

/** The last day the offer can be claimed, e.g. "Saturday, 7 November 2026". */
export function trialOfferLastDayLabel(): string {
  const lastDay = new Date(trialOfferEndsAt().getTime() - 1);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(lastDay);
}

/** Official launch day, used by the countdown email. */
export const LAUNCH_DATE = '2026-11-01';

/** Whole days from `now` until launch day, by the calendar in Lagos (0 = today, negative = past). */
export function daysUntilLaunch(now: Date = new Date()): number {
  const lagosToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(now); // YYYY-MM-DD
  return Math.round((Date.parse(`${LAUNCH_DATE}T00:00:00Z`) - Date.parse(`${lagosToday}T00:00:00Z`)) / 86_400_000);
}
