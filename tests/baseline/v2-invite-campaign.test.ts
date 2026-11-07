import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  users: [] as Array<{ id: string; email: string | null; name: string | null; emailVerified: Date | null; createdAt: Date }>,
  rows: [] as Array<{ userId: string; key: string }>,
  payments: [] as Array<{ userId: string }>,
  sendMail: vi.fn(),
  created: [] as Array<{ userId: string; key: string }>,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: async () => mocks.users.filter((u) => u.email !== null) }, // the real query asks for accounts with an email and not suspended
    lifecycleEmail: {
      findMany: async ({ where }: { where: { key: { in: string[] } } }) => mocks.rows.filter((r) => where.key.in.includes(r.key)),
      create: async ({ data }: { data: { userId: string; key: string } }) => {
        if (mocks.rows.some((r) => r.userId === data.userId && r.key === data.key)) throw new Error('unique');
        mocks.rows.push(data); mocks.created.push(data); return data;
      },
      deleteMany: async ({ where }: { where: { userId: string; key: string } }) => { mocks.rows = mocks.rows.filter((r) => !(r.userId === where.userId && r.key === where.key)); return { count: 1 }; },
    },
    payment: { findMany: async () => mocks.payments },
  },
}));
vi.mock('@/lib/lifecycleRunner', () => ({ emailConfigured: () => true }));
vi.mock('@/lib/email', async (orig) => ({ ...(await orig<typeof import('@/lib/email')>()), createTransporter: () => ({ sendMail: mocks.sendMail }) }));

import { INVITE_MIN_ACCOUNT_AGE_DAYS, launchAudience, sendLaunchBatch, sendLaunchTest } from '@/lib/launchCampaign';
import { v2InviteEmailHtml, v2InviteSubject } from '@/lib/email';
import { TRIAL_DAYS } from '@/lib/promo';

const DAY = 24 * 60 * 60 * 1000;
const user = (id: string, over: Partial<(typeof mocks.users)[number]> = {}) => ({ id, email: `${id}@example.com`, name: `User ${id}`, emailVerified: new Date(), createdAt: new Date(Date.now() - 30 * DAY), ...over });

beforeEach(() => {
  mocks.users = []; mocks.rows = []; mocks.payments = []; mocks.created = []; mocks.sendMail.mockReset(); mocks.sendMail.mockResolvedValue({});
  process.env.NEXTAUTH_URL = 'https://runvax.com';
  process.env.NEXTAUTH_SECRET = 'test-secret-for-unsubscribe-links';
});
afterEach(() => { vi.useRealTimers(); delete process.env.NEXT_PUBLIC_TRIAL_OFFER_UNTIL; });

describe('the RUNVAX 2.0 invitation email', () => {
  const html = (trialAvailable: boolean, unsub?: string) => v2InviteEmailHtml('Ade Bello', 'https://runvax.com', 'RUNVAX', { trialAvailable, claimBy: 'Saturday, 7 November 2026' }, unsub);

  it('invites people to switch, and links to the new experience', () => {
    const h = html(true);
    expect(h).toContain('Hi <strong style="color:#1e293b;">Ade</strong>');
    expect(h).toContain('Switch to RUNVAX 2.0');
    expect(h).toContain('https://runvax.com/client-acquisition/find?ref=v2-invite');
    expect(h).toContain('classic RUNVAX');
  });
  it('talks about the free trial, truthfully, when the person can still claim it', () => {
    const h = html(true);
    expect(h).toContain(`${TRIAL_DAYS} days`);
    expect(h).toMatch(/no credit card/i);
    expect(h).toContain('https://runvax.com/claim-pro');
    expect(h).toMatch(/One free trial per account/);
    expect(v2InviteSubject(true)).toContain(`${TRIAL_DAYS} days of Pro free`);
  });
  it('does not print a deadline when the offer has none, and prints the real one when it does', () => {
    const open = v2InviteEmailHtml('A', 'https://runvax.com', 'RUNVAX', { trialAvailable: true, claimBy: null });
    expect(open).toMatch(/One free trial per account/);
    expect(open).not.toMatch(/Claim your free \d+ days by/);
    expect(html(true)).toMatch(/Claim your free \d+ days by Saturday, 7 November 2026/);
  });
  it('leaves the trial out entirely for someone who already has one, or when the offer has closed', () => {
    const h = html(false);
    expect(h).not.toMatch(/claim-pro|credit card|free trial|\$0|days of/i);
    expect(h).toContain('Switch to RUNVAX 2.0');
    expect(v2InviteSubject(false)).not.toMatch(/free|Pro/i);
  });
  it('makes no performance claims, and carries the unsubscribe link when given one', () => {
    const words = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '); // what a reader sees, not the markup
    for (const h of [html(true), html(false)]) expect(words(h)).not.toMatch(/guarantee|\b\d+\s?%|10x|double your|best in|number one|\bno\.? ?1\b/i);
    expect(html(true, 'https://runvax.com/api/unsubscribe?u=1')).toContain('https://runvax.com/api/unsubscribe?u=1');
  });
});

describe('who the invitation goes to', () => {
  it('skips the unsubscribed, anyone already sent it, suspended or email-less accounts, duplicates, and accounts that joined in the last few days', async () => {
    mocks.users = [
      user('ok'), user('out'), user('sent'), user('new', { createdAt: new Date(Date.now() - 1 * DAY) }),
      user('noemail', { email: null }), user('dupe', { email: 'ok@example.com' }), user('bad', { email: 'not-an-email' }),
    ];
    mocks.rows = [{ userId: 'out', key: 'optout' }, { userId: 'sent', key: 'launch_3' }, { userId: 'ok', key: 'launch_1' }];
    const a = await launchAudience(3);
    expect(a.eligible.map((u) => u.id)).toEqual(['ok']);
    expect(a).toMatchObject({ optedOut: 1, alreadySent: 1, joinedRecently: 1 });
    expect(INVITE_MIN_ACCOUNT_AGE_DAYS).toBe(3);
  });
  it('still invites people who claimed the trial, flagged so the email leaves the offer out; email 2 still skips them', async () => {
    mocks.users = [user('a'), user('b')];
    mocks.payments = [{ userId: 'b' }];
    const three = await launchAudience(3);
    expect(three.eligible.map((u) => [u.id, u.claimed])).toEqual([['a', false], ['b', true]]);
    const two = await launchAudience(2);
    expect(two.eligible.map((u) => u.id)).toEqual(['a']);
    expect(two.alreadyClaimed).toBe(1);
  });
  it('does not change who gets email 1', async () => {
    mocks.users = [user('a'), user('new', { createdAt: new Date() })];
    expect((await launchAudience(1)).eligible.map((u) => u.id)).toEqual(['a', 'new']);
  });
});

describe('sending it', () => {
  it('a test goes to one address only, marked [TEST], and records nothing', async () => {
    await sendLaunchTest(3, 'admin@runvax.com', 'Admin');
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({ to: 'admin@runvax.com' });
    expect(mocks.sendMail.mock.calls[0][0].subject).toMatch(/^\[TEST\] /);
    expect(mocks.created).toEqual([]);
  });
  it('a batch emails each eligible person once, records it first, and never twice', async () => {
    vi.useFakeTimers();
    mocks.users = [user('a'), user('b'), user('c', { createdAt: new Date() })];
    mocks.payments = [{ userId: 'b' }];
    const run = sendLaunchBatch(3); await vi.runAllTimersAsync();
    expect(await run).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(mocks.sendMail.mock.calls.map((c) => c[0].to)).toEqual(['a@example.com', 'b@example.com']);
    expect(mocks.created.map((c) => [c.userId, c.key])).toEqual([['a', 'launch_3'], ['b', 'launch_3']]);
    // The person with a trial already gets the invitation without the offer.
    const [forA, forB] = mocks.sendMail.mock.calls.map((c) => c[0]);
    expect(forA.html).toContain('claim-pro'); expect(forB.html).not.toContain('claim-pro');
    expect(forA.headers['List-Unsubscribe']).toMatch(/unsubscribe/i);
    expect(forA.html).not.toMatch(/2098|2099/); // no far-future placeholder date in a customer's inbox
    // Running it again sends nothing: everyone has had it.
    mocks.sendMail.mockClear();
    const again = sendLaunchBatch(3); await vi.runAllTimersAsync();
    expect(await again).toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
  it('a failed send is un-recorded so it can be retried, and does not stop the rest', async () => {
    vi.useFakeTimers();
    mocks.users = [user('a'), user('b')];
    mocks.sendMail.mockRejectedValueOnce(new Error('smtp down')).mockResolvedValue({});
    const run = sendLaunchBatch(3); await vi.runAllTimersAsync();
    const r = await run;
    expect(r.sent).toBe(1); expect(r.failed).toBe(1);
    expect(mocks.rows.map((x) => x.userId)).toEqual(['b']);
  });
});
