/**
 * New-user email workflow: which email, if any, a user should receive next.
 *
 * Event-driven, not calendar-driven. Each step has an audience (what the user has or hasn't
 * done) and a time window measured from the event that matters (registration, verification,
 * trial start), so a user who has already done what an email asks for never receives it, and
 * a step that is long overdue is dropped rather than sent stale. This module is pure: the cron
 * route gathers the facts and does the sending.
 *
 *   register ─► welcome (sent by the register route)
 *      │
 *      ├─ not verified ─► verify_1 (+1h) ─► verify_2 (+24h) ─► stop
 *      │
 *      └─ verified ─► prospects saved?
 *            no  ─► first_search ─► reengage (day 3, still no activity)
 *            yes ─► outreach started?
 *                     no  ─► research_outreach (day 2)
 *                     yes ─► pipeline (day 3)
 *         engaged ─► feedback (day 5)
 *
 *   trial running, not paid ─► trial_ending_soon ─► trial_ends_today ─► post_expiry
 *   a paid subscriber receives none of the trial emails.
 */

import { TRIAL_DAYS } from './promo';

export type StepKey =
  | 'verify_1' | 'verify_2'
  | 'first_search' | 'research_outreach' | 'pipeline' | 'reengage' | 'feedback'
  | 'trial_ending_soon' | 'trial_ends_today' | 'post_expiry';

/** Priority when more than one step is ready: money-relevant first, then the funnel in order. */
export const STEP_ORDER: StepKey[] = [
  'trial_ends_today', 'trial_ending_soon', 'post_expiry',
  'verify_2', 'verify_1',
  'first_search', 'research_outreach', 'pipeline', 'reengage', 'feedback',
];

/** Account emails (verification). Everything else is promotional and honours unsubscribe. */
export const TRANSACTIONAL: ReadonlySet<StepKey> = new Set<StepKey>(['verify_1', 'verify_2']);

/** Only accounts created at or after this get the workflow; existing users are left alone. */
export function lifecycleStartsAt(): Date {
  const d = new Date(process.env.LIFECYCLE_STARTS_AT?.trim() || '2026-10-21T00:00:00+01:00');
  return Number.isNaN(d.getTime()) ? new Date('2026-10-21T00:00:00+01:00') : d;
}

export interface Snapshot {
  createdAt: Date;
  verifiedAt: Date | null;
  plan: string;
  planExpiresAt: Date | null;
  /** Has run at least one search. */
  searched: boolean;
  /** Prospects saved to the pipeline. */
  prospectCount: number;
  /** Has sent (or marked sent) outreach to at least one prospect. */
  outreachStarted: boolean;
  /** When the free Pro trial was started, if ever. */
  trialStartedAt: Date | null;
  /** Has a real (non-trial) payment. */
  paid: boolean;
  /** Lifecycle emails already sent: step key -> sentAt. */
  sent: Record<string, Date>;
  optedOut: boolean;
}

const HOUR = 3_600_000;
const hoursSince = (d: Date, now: Date) => (now.getTime() - d.getTime()) / HOUR;
const within = (h: number, from: number, to: number) => h >= from && h < to;

function ready(step: StepKey, s: Snapshot, now: Date): boolean {
  const verified = !!s.verifiedAt;
  const hv = s.verifiedAt ? hoursSince(s.verifiedAt, now) : -1;
  const engaged = s.searched || s.prospectCount > 0;

  const trialActive = !!s.trialStartedAt && !s.paid && s.plan !== 'free' && !!s.planExpiresAt;
  const remaining = s.planExpiresAt ? (s.planExpiresAt.getTime() - now.getTime()) / HOUR : 0;

  switch (step) {
    case 'verify_1': return !verified && within(hoursSince(s.createdAt, now), 1, 24);
    case 'verify_2': return !verified && within(hoursSince(s.createdAt, now), 24, 72);

    case 'first_search':       return verified && s.prospectCount === 0 && within(hv, 0, 72);
    case 'research_outreach':  return verified && s.prospectCount > 0 && !s.outreachStarted && within(hv, 48, 120);
    case 'pipeline':           return verified && s.outreachStarted && within(hv, 72, 144);
    case 'reengage':           return verified && !engaged && within(hv, 72, 168);
    case 'feedback':           return verified && engaged && within(hv, 120, 192);

    // Daily cron: a user lands in exactly one of these windows per run, so they get one
    // "tomorrow" email and one "today" email. Both need a trial that is genuinely running.
    case 'trial_ending_soon':  return trialActive && remaining > 10 && remaining <= 30;
    case 'trial_ends_today':   return trialActive && remaining > -24 && remaining <= 10;

    case 'post_expiry': {
      if (!s.trialStartedAt || s.paid || s.plan !== 'free') return false;
      const endedFor = hoursSince(new Date(s.trialStartedAt.getTime() + TRIAL_DAYS * 24 * HOUR), now);
      return within(endedFor, 24, 168);
    }
  }
}

/** The one email this user should receive now, or null. At most one per call. */
export function nextStep(s: Snapshot, now: Date = new Date()): StepKey | null {
  if (s.createdAt < lifecycleStartsAt()) return null;

  // Promotional gap: never two promotional emails within 20 hours (a trial ending is the exception).
  const lastPromo = Object.entries(s.sent)
    .filter(([k]) => !TRANSACTIONAL.has(k as StepKey) && k !== 'welcome' && k !== 'optout')
    .map(([, at]) => at.getTime())
    .sort((a, b) => b - a)[0];
  const tooSoon = lastPromo !== undefined && now.getTime() - lastPromo < 20 * HOUR;

  for (const step of STEP_ORDER) {
    if (s.sent[step]) continue;
    const promo = !TRANSACTIONAL.has(step);
    if (promo && s.optedOut) continue;
    // A subscriber is past every sales step; the trial emails in particular must not reach them.
    if (promo && s.paid && (step.startsWith('trial_') || step === 'post_expiry')) continue;
    if (promo && tooSoon && step !== 'trial_ends_today') continue;
    if (ready(step, s, now)) return step;
  }
  return null;
}
