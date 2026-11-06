import { describe, it, expect, beforeAll } from 'vitest';
import { nextStep, STEP_ORDER, type Snapshot, type StepKey } from '@/lib/lifecycle';
import { renderStep, welcomeEmail, trialStartedEmail } from '@/lib/lifecycleEmails';
import { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from '@/lib/unsubscribe';

const H = 3_600_000;
const T0 = new Date('2026-10-25T10:00:00Z'); // after the workflow start
const at = (h: number) => new Date(T0.getTime() + h * H);

const snap = (o: Partial<Snapshot> = {}): Snapshot => ({
  createdAt: T0, verifiedAt: null, plan: 'free', planExpiresAt: null,
  searched: false, prospectCount: 0, outreachStarted: false,
  trialStartedAt: null, paid: false, sent: {}, optedOut: false, ...o,
});
const verified = (h = 0) => ({ verifiedAt: at(h) });

describe('verification branch', () => {
  it('waits an hour, then reminds, then sends the final reminder, then stops', () => {
    expect(nextStep(snap(), at(0.5))).toBeNull();
    expect(nextStep(snap(), at(2))).toBe('verify_1');
    expect(nextStep(snap({ sent: { verify_1: at(2) } }), at(5))).toBeNull();
    expect(nextStep(snap({ sent: { verify_1: at(2) } }), at(26))).toBe('verify_2');
    expect(nextStep(snap({ sent: { verify_1: at(2), verify_2: at(26) } }), at(60))).toBeNull();
    expect(nextStep(snap(), at(100))).toBeNull(); // stale: never sent late
  });
  it('stops the moment the email is verified', () => {
    expect(nextStep(snap({ verifiedAt: at(1.5) }), at(2))).not.toBe('verify_1');
    expect(nextStep(snap({ verifiedAt: at(3) }), at(26))).not.toBe('verify_2');
  });
  it('verification reminders still go to someone who unsubscribed from promotions', () => {
    expect(nextStep(snap({ optedOut: true }), at(2))).toBe('verify_1');
  });
});

describe('onboarding branches', () => {
  it('no prospects yet: first-search guidance right after verifying, then a day-3 nudge if still idle', () => {
    expect(nextStep(snap(verified(2)), at(3))).toBe('first_search');
    expect(nextStep(snap({ ...verified(2), sent: { first_search: at(3) } }), at(2 + 80))).toBe('reengage');
  });
  it('someone who already has prospects never gets first-search guidance', () => {
    expect(nextStep(snap({ ...verified(2), prospectCount: 3, searched: true }), at(3))).toBeNull();
  });
  it('prospects but no outreach: outreach guidance on day 2', () => {
    const s = snap({ ...verified(2), prospectCount: 3, searched: true });
    expect(nextStep(s, at(2 + 49))).toBe('research_outreach');
  });
  it('outreach started: pipeline follow-up instead, and no outreach guidance', () => {
    const s = snap({ ...verified(2), prospectCount: 3, searched: true, outreachStarted: true });
    expect(nextStep(s, at(2 + 49))).toBeNull();
    expect(nextStep(s, at(2 + 75))).toBe('pipeline');
  });
  it('feedback goes to engaged users only, on day 5', () => {
    const engaged = snap({ ...verified(2), searched: true, prospectCount: 2, outreachStarted: true, sent: { pipeline: at(2 + 75) } });
    expect(nextStep(engaged, at(2 + 125))).toBe('feedback');
    expect(nextStep(snap({ ...verified(2), sent: { first_search: at(3), reengage: at(80) } }), at(2 + 125))).toBeNull();
  });
  it('never sends two promotional emails within 20 hours', () => {
    const s = snap({ ...verified(2), prospectCount: 2, searched: true, sent: { first_search: at(40) } });
    expect(nextStep(s, at(2 + 50))).toBeNull();      // 12h after the last one
    expect(nextStep(s, at(2 + 62))).toBe('research_outreach');
  });
  it('sends each step once, and respects unsubscribe', () => {
    const s = snap({ ...verified(2), sent: { first_search: at(3) } });
    expect(nextStep(s, at(5))).toBeNull();
    expect(nextStep(snap({ ...verified(2), optedOut: true }), at(3))).toBeNull();
  });
});

describe('trial branch', () => {
  const trial = (over: Partial<Snapshot>) => snap({ ...verified(1), plan: 'pro', trialStartedAt: at(2), planExpiresAt: at(2 + 11 * 24), prospectCount: 1, searched: true, ...over });
  const end = 2 + 11 * 24;
  it('warns the day before, then on the day', () => {
    expect(String(nextStep(trial({}), at(end - 50)))).not.toMatch(/^trial_/);
    expect(nextStep(trial({}), at(end - 26))).toBe('trial_ending_soon');
    expect(nextStep(trial({ sent: { trial_ending_soon: at(end - 26) } }), at(end - 4))).toBe('trial_ends_today');
  });
  it('the day-of email overrides the promotional gap', () => {
    expect(nextStep(trial({ sent: { trial_ending_soon: at(end - 8), pipeline: at(end - 5) } }), at(end - 2))).toBe('trial_ends_today');
  });
  it('a paid subscriber gets no trial sales email, and no post-expiry email', () => {
    expect(nextStep(trial({ paid: true }), at(end - 26))).toBeNull();
    expect(nextStep(trial({ paid: true, plan: 'free', planExpiresAt: null }), at(end + 48))).toBeNull();
  });
  it('someone who never started a trial gets no trial emails', () => {
    expect(nextStep(snap({ ...verified(1), plan: 'pro', planExpiresAt: at(end), prospectCount: 1, searched: true }), at(end - 26))).toBeNull();
  });
  it('after the trial lapses to free: one reactivation email within a week, nothing before or after', () => {
    const lapsed = trial({ plan: 'free', planExpiresAt: null, sent: { trial_ending_soon: at(end - 26), trial_ends_today: at(end - 4) } });
    expect(nextStep(lapsed, at(end + 6))).toBeNull();
    expect(nextStep(lapsed, at(end + 30))).toBe('post_expiry');
    expect(nextStep(lapsed, at(end + 24 * 9))).toBeNull();
  });
});

describe('workflow scope', () => {
  it('ignores accounts created before the workflow started', () => {
    expect(nextStep(snap({ createdAt: new Date('2026-10-01T00:00:00Z') }), new Date('2026-10-01T05:00:00Z'))).toBeNull();
  });
  it('every step has a priority slot', () => {
    expect(new Set(STEP_ORDER).size).toBe(10);
  });
});

describe('templates', () => {
  beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; process.env.NEXTAUTH_URL = 'https://runvax.com'; });
  const ctx = (extra = {}) => ({ name: 'Ada Obi', appUrl: 'https://runvax.com', appName: 'Runvax', ...extra });

  it('renders every step; promotional ones carry unsubscribe, verification ones carry a verify link', () => {
    for (const step of STEP_ORDER) {
      const verify = step === 'verify_1' || step === 'verify_2';
      const m = renderStep(step, ctx(verify ? { verifyUrl: 'https://runvax.com/api/auth/verify-email?token=abc' } : { unsubscribeUrl: 'https://runvax.com/api/unsubscribe?u=1&t=2' }));
      expect(m.subject.length, step).toBeGreaterThan(5);
      expect(m.html, step).toContain('Ada');
      expect(m.html, step).not.toMatch(/localhost|undefined|\[object/);
      if (verify) { expect(m.html).toContain('verify-email?token=abc'); expect(m.transactional).toBe(true); expect(m.html).not.toContain('/api/unsubscribe'); }
      else { expect(m.html, step).toContain('/api/unsubscribe'); expect(m.transactional).toBe(false); }
    }
  });
  it('pricing is off: no email links to a plan page or promises a charge', () => {
    for (const step of ['trial_ending_soon', 'trial_ends_today', 'post_expiry'] as StepKey[]) {
      const m = renderStep(step, ctx({ unsubscribeUrl: 'https://runvax.com/api/unsubscribe?u=1&t=2' }));
      expect(m.html, step).not.toContain('/pricing');
      expect(m.html.toLowerCase(), step).not.toMatch(/charged automatically|subscribe now|upgrade/);
      expect(m.html, step).toMatch(/saved prospects|prospects/);
    }
    expect(renderStep('trial_ends_today', ctx()).subject).toContain('10 days');
  });
  it('welcome email asks them to verify and links to the verification URL', () => {
    const w = welcomeEmail({ ...ctx(), verifyUrl: 'https://runvax.com/api/auth/verify-email?token=zzz' });
    expect(w.html).toContain('verify-email?token=zzz');
    expect(w.html).toContain('Verify my email');
    expect(w.subject).toContain('Welcome');
  });
});

describe('trial-started confirmation', () => {
  it('confirms the claim with the real end date, promises no charge, and is an account email', () => {
    process.env.NEXTAUTH_URL = 'https://runvax.com';
    const m = trialStartedEmail({ name: 'Ada Obi', appUrl: 'https://runvax.com', appName: 'Runvax', endsLabel: 'Saturday, 12 December 2026' });
    expect(m.subject).toContain('10 days');
    expect(m.html).toContain('12 December 2026');
    expect(m.html).toContain('nothing will be charged');
    expect(m.html).toContain('AI receptionist targets');
    expect(m.html).not.toContain('/api/unsubscribe');
    expect(m.html).not.toContain('/pricing');
    expect(m.transactional).toBe(true);
  });
});

describe('unsubscribe links', () => {
  beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; });
  it('only unsubscribes the account the link was issued for', () => {
    const t = unsubscribeToken('user-1');
    expect(verifyUnsubscribeToken('user-1', t)).toBe(true);
    expect(verifyUnsubscribeToken('user-2', t)).toBe(false);
    expect(verifyUnsubscribeToken('user-1', t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a'))).toBe(false);
    expect(verifyUnsubscribeToken('user-1', '')).toBe(false);
    expect(unsubscribeUrl('https://runvax.com', 'user-1')).toContain(`t=${t}`);
  });
});
