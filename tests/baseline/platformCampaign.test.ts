import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeConfig, emptySegment, type CampaignConfig } from '@/lib/platformCampaignShared';

const DAY = 86_400_000; const NOW = new Date('2026-11-11T12:00:00Z').getTime();
type User = { id: string; email: string | null; name: string | null; plan: string; planExpiresAt: Date | null; emailVerified: Date | null; createdAt: Date; lastActiveAt: Date | null; isSuspended?: boolean };
let users: User[] = []; let payments: Array<{ userId: string; reference: string; amount: number; status: string }> = [];
let life: Array<{ userId: string; key: string; sentAt: Date }> = []; let mailed: Array<{ to: string; subject: string; html: string; headers?: Record<string, string> }> = []; let failFor = new Set<string>();

vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { findMany: async () => users.filter((u) => !u.isSuspended && u.email !== null) },
  payment: { findMany: async () => payments },
  lifecycleEmail: {
    findMany: async ({ where }: { where: { key: string | { in: string[] } } }) => life.filter((r) => (typeof where.key === 'string' ? r.key === where.key : where.key.in.includes(r.key))),
    create: async ({ data }: { data: { userId: string; key: string } }) => { if (life.some((r) => r.userId === data.userId && r.key === data.key)) throw new Error('unique'); life.push({ ...data, sentAt: new Date(NOW) }); },
    deleteMany: async ({ where }: { where: { userId: string; key: string } }) => { life = life.filter((r) => !(r.userId === where.userId && r.key === where.key)); },
    groupBy: async ({ where }: { where: { key: { startsWith: string } } }) => { const m = new Map<string, number>(); for (const r of life.filter((x) => x.key.startsWith(where.key.startsWith))) m.set(r.key, (m.get(r.key) ?? 0) + 1); return Array.from(m.entries()).map(([key, n]) => ({ key, _count: { _all: n } })); },
    count: async ({ where }: { where: { key: { startsWith: string }; sentAt: { gt: Date } } }) => life.filter((r) => r.key.startsWith(where.key.startsWith) && r.sentAt > where.sentAt.gt).length,
  },
} }));
vi.mock('@/lib/email', async (orig) => ({ ...(await orig<typeof import('@/lib/email')>()), createTransporter: () => ({ sendMail: async (m: { to: string; subject: string; html: string; headers?: Record<string, string> }) => { if (failFor.has(m.to)) throw new Error('smtp down'); mailed.push(m); } }) }));

import { matchesSegment, stepAudience, sendBatch, sendCounts, renderStep, previewAudience, kindOf } from '@/lib/platformCampaign';
const real = Date.now; // the clock is only used through the `now` argument, except sendBatch which uses Date.now for the 24h window

const mk = (id: string, o: Partial<User> = {}): User => ({ id, email: `${id}@example.com`, name: `User ${id}`, plan: 'free', planExpiresAt: null, emailVerified: new Date(NOW - 30 * DAY), createdAt: new Date(NOW - 60 * DAY), lastActiveAt: new Date(NOW - 20 * DAY), ...o });
const cfg = (o: Partial<CampaignConfig> = {}): CampaignConfig => sanitizeConfig({
  goal: 'none', stopOnGoal: true, segment: emptySegment(), dailyCap: 200,
  steps: [{ subject: 'One', body: 'Hi {{name}}' }, { subject: 'Two', body: 'Hi again {{name}}', waitDays: 3 }], ...o,
});
beforeEach(() => { users = []; payments = []; life = []; mailed = []; failFor = new Set(); vi.stubEnv('NEXTAUTH_SECRET', 'test'); vi.stubEnv('NEXTAUTH_URL', 'https://runvax.com'); Date.now = real; });

describe('audience filters', () => {
  const ctx = { trial: new Set<string>(['t1']), paid: new Set<string>(['p1']) };
  it('plan kinds: free, on a trial, paying', () => {
    expect(kindOf({ id: 'a', plan: 'free' }, ctx.trial, ctx.paid)).toBe('free');
    expect(kindOf({ id: 't1', plan: 'pro' }, ctx.trial, ctx.paid)).toBe('trial');
    expect(kindOf({ id: 'p1', plan: 'pro' }, ctx.trial, ctx.paid)).toBe('paid');
  });
  it('verified, joined and activity filters', () => {
    const u = mk('a');
    expect(matchesSegment(u as never, { ...emptySegment(), verified: 'no' }, ctx, NOW)).toBe(false);
    expect(matchesSegment(u as never, { ...emptySegment(), joinedWithinDays: 30 }, ctx, NOW)).toBe(false);
    expect(matchesSegment(u as never, { ...emptySegment(), joinedOlderThanDays: 30 }, ctx, NOW)).toBe(true);
    expect(matchesSegment(u as never, { ...emptySegment(), inactiveForDays: 14 }, ctx, NOW)).toBe(true);
    expect(matchesSegment(u as never, { ...emptySegment(), activeWithinDays: 14 }, ctx, NOW)).toBe(false);
    expect(matchesSegment(mk('n', { lastActiveAt: null }) as never, { ...emptySegment(), inactiveForDays: 14 }, ctx, NOW)).toBe(true); // never active counts as inactive
  });
});

describe('who is due each email', () => {
  it('email 1 goes to matching people only: not suspended, not unsubscribed, no bad or duplicate addresses', async () => {
    users = [mk('a'), mk('b', { isSuspended: true }), mk('c'), mk('d', { email: 'not-an-email' }), mk('e', { email: 'A@example.com' }), mk('f', { email: null })];
    life = [{ userId: 'c', key: 'optout', sentAt: new Date(NOW) }];
    const a = await stepAudience('X', cfg(), 0, NOW);
    expect(a.eligible.map((u) => u.id)).toEqual(['a']); // e is a duplicate of a
    expect(a.optedOut).toBe(1);
  });
  it('email 2 waits for the gap, needs email 1 first, and nobody is sent the same email twice', async () => {
    users = [mk('due'), mk('soon'), mk('never'), mk('done')];
    life = [
      { userId: 'due', key: 'pc:X:0', sentAt: new Date(NOW - 4 * DAY) },
      { userId: 'soon', key: 'pc:X:0', sentAt: new Date(NOW - 1 * DAY) },
      { userId: 'done', key: 'pc:X:0', sentAt: new Date(NOW - 9 * DAY) }, { userId: 'done', key: 'pc:X:1', sentAt: new Date(NOW - 2 * DAY) },
    ];
    const a = await stepAudience('X', cfg(), 1, NOW);
    expect(a.eligible.map((u) => u.id)).toEqual(['due']);
    expect(a).toMatchObject({ waiting: 1, notReached: 1, alreadySent: 1 });
  });
  it('stops emailing people who reached the goal: claimed the trial / verified', async () => {
    users = [mk('free'), mk('claimed', { plan: 'pro' })]; payments = [{ userId: 'claimed', reference: 'trial_claimed', amount: 0, status: 'trial' }];
    const a = await stepAudience('X', cfg({ goal: 'claim_trial' }), 0, NOW);
    expect(a.eligible.map((u) => u.id)).toEqual(['free']); expect(a.goalReached).toBe(1);
    const off = await stepAudience('X', cfg({ goal: 'claim_trial', stopOnGoal: false }), 0, NOW);
    expect(off.eligible).toHaveLength(2);
  });
  it('come-back goal: someone active since email 1 is left alone', async () => {
    users = [mk('back', { lastActiveAt: new Date(NOW - 1 * DAY) }), mk('quiet')];
    life = [{ userId: 'back', key: 'pc:X:0', sentAt: new Date(NOW - 5 * DAY) }, { userId: 'quiet', key: 'pc:X:0', sentAt: new Date(NOW - 5 * DAY) }];
    const a = await stepAudience('X', cfg({ goal: 'come_back' }), 1, NOW);
    expect(a.eligible.map((u) => u.id)).toEqual(['quiet']); expect(a.goalReached).toBe(1);
  });
  it('someone already in the sequence stays in it even if they stop matching the filters', async () => {
    users = [mk('a', { lastActiveAt: new Date(NOW - 1 * DAY) })];
    life = [{ userId: 'a', key: 'pc:X:0', sentAt: new Date(NOW - 5 * DAY) }];
    const a = await stepAudience('X', cfg({ segment: { ...emptySegment(), inactiveForDays: 14 } }), 1, NOW);
    expect(a.eligible.map((u) => u.id)).toEqual(['a']);
  });
  it('the live count ignores unsubscribed people', async () => {
    users = [mk('a'), mk('b')]; life = [{ userId: 'b', key: 'optout', sentAt: new Date(NOW) }];
    expect(await previewAudience(emptySegment())).toMatchObject({ matching: 1, optedOut: 1 });
  });
});

describe('sending', () => {
  it('claims before sending, adds an unsubscribe link and header, and records one row per person', async () => {
    users = [mk('a'), mk('b')];
    const r = await sendBatch('X', cfg(), 0);
    expect(r).toMatchObject({ sent: 2, failed: 0, remaining: 0 });
    expect(life.filter((x) => x.key === 'pc:X:0')).toHaveLength(2);
    expect(mailed[0].headers?.['List-Unsubscribe']).toContain('/api/unsubscribe');
    expect(mailed[0].html).toContain('Unsubscribe'); expect(mailed[0].html).toContain('Hi User');
  }, 15000);
  it('running it again sends nothing more (no double sends)', async () => {
    users = [mk('a')];
    await sendBatch('X', cfg(), 0); mailed = [];
    const again = await sendBatch('X', cfg(), 0);
    expect(again.sent).toBe(0); expect(mailed).toHaveLength(0);
  }, 15000);
  it('a failed send releases the claim so it can be retried, and is counted', async () => {
    users = [mk('a'), mk('b')]; failFor = new Set(['a@example.com']);
    const r = await sendBatch('X', cfg(), 0);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
    expect(life.some((x) => x.userId === 'a' && x.key === 'pc:X:0')).toBe(false);
    expect(life.some((x) => x.userId === 'b' && x.key === 'pc:X:0')).toBe(true);
  }, 15000);
  it('the daily cap stops a send and says so', async () => {
    users = [mk('a'), mk('b'), mk('c')];
    const r = await sendBatch('X', cfg({ dailyCap: 2 }), 0);
    expect(r.sent).toBe(2); expect(r.remaining).toBe(1); expect(r.capped).toBe(true);
    const next = await sendBatch('X', cfg({ dailyCap: 2 }), 0);   // already at the cap in the last 24h
    expect(next).toMatchObject({ sent: 0, capped: true });
  }, 15000);
  it('counts per email', async () => {
    life = [{ userId: 'a', key: 'pc:X:0', sentAt: new Date() }, { userId: 'b', key: 'pc:X:0', sentAt: new Date() }, { userId: 'a', key: 'pc:X:1', sentAt: new Date() }];
    expect(await sendCounts('X', 2)).toEqual({ perStep: [2, 1], last24h: 3 });
  });
});

describe('rendering', () => {
  it('puts the button on the app domain and escapes the label; no button when none is set', () => {
    const v = { name: 'Ada', plan: 'Free', appName: 'RUNVAX', trialDays: 10 };
    const withBtn = renderStep({ subject: 'S', body: 'Hi {{name}}', waitDays: 0, ctaLabel: 'Go <b>', ctaPath: '/claim-pro' }, v);
    expect(withBtn.html).toContain('https://runvax.com/claim-pro'); expect(withBtn.html).not.toContain('Go <b>');
    expect(renderStep({ subject: 'S', body: 'Hi', waitDays: 0, ctaLabel: '', ctaPath: '' }, v).html).not.toContain('claim-pro');
  });
});
