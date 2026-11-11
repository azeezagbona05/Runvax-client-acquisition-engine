import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySegment, sampleById } from '@/lib/platformCampaignShared';

const DAY = 86_400_000; const NOW = new Date('2026-11-11T12:00:00Z').getTime();
type User = { id: string; email: string | null; name: string | null; plan: string; planExpiresAt: Date | null; emailVerified: Date | null; createdAt: Date; lastActiveAt: Date | null; isSuspended?: boolean };
type Lead = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let users: User[] = []; let payments: Array<{ userId: string; reference: string; amount: number; status: string }> = []; let life: Array<{ userId: string; key: string }> = [];
let campaigns: Lead[] = []; let leads: Lead[] = []; let registry: Lead[] = []; let settings: Lead[] = []; let audit: Lead[] = []; let seq = 0;
let sendCalls: Array<{ kind: string; campaignId: string; userId: string }> = []; let mailbox: object | null = { fromAddress: 'hello@runvax.com' };

const eq = (v: any, w: any): boolean => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (w === null) return v === null || v === undefined;
  if (w && typeof w === 'object' && !(w instanceof Date)) {
    if ('in' in w) return w.in.includes(v); if ('notIn' in w) return !w.notIn.includes(v); if ('not' in w) return w.not === null ? v !== null && v !== undefined : v !== w.not;
    if ('startsWith' in w) return typeof v === 'string' && v.startsWith(w.startsWith);
  }
  return v === w;
};
const matchLead = (l: Lead, where: Lead = {}): boolean => Object.entries(where).every(([k, w]) => {
  if (k === 'OR') return (w as Lead[]).some((c) => matchLead(l, c));
  if (k === 'AND') return (w as Lead[]).every((c) => matchLead(l, c));
  return eq(l[k], w);
});

vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { findMany: async ({ where }: Lead) => users.filter((u) => !u.isSuspended && (where?.email?.not === null ? u.email !== null : where?.email?.in ? u.email !== null && where.email.in.includes(u.email) : true)), findUnique: async ({ where }: Lead) => users.find((u) => u.id === where.id) ?? null },
  payment: { findMany: async () => payments },
  lifecycleEmail: { findMany: async ({ where }: Lead) => life.filter((r) => r.key === where.key), count: async ({ where }: Lead) => life.filter((r) => r.key.startsWith(where.key.startsWith)).length },
  userSettings: {
    findUnique: async ({ where }: Lead) => settings.find((s) => s.userId === where.userId) ?? null,
    create: async ({ data }: Lead) => { settings.push({ ...data }); return data; },
    update: async ({ where, data }: Lead) => { Object.assign(settings.find((s) => s.userId === where.userId)!, data); },
  },
  outreachCampaign: {
    create: async ({ data }: Lead) => { const c = { id: `c${++seq}`, status: 'draft', startedAt: null, ...data }; campaigns.push(c); return c; },
    findFirst: async ({ where }: Lead) => campaigns.find((c) => c.id === where.id && c.userId === where.userId) ?? null,
    findMany: async ({ where }: Lead) => campaigns.filter((c) => where.id.in.includes(c.id) && c.userId === where.userId),
    update: async ({ where, data }: Lead) => { Object.assign(campaigns.find((c) => c.id === where.id)!, data); },
    deleteMany: async ({ where }: Lead) => { campaigns = campaigns.filter((c) => !(c.id === where.id && c.userId === where.userId)); leads = leads.filter((l) => l.campaignId !== where.id); },
  },
  outreachLead: {
    findMany: async ({ where }: Lead) => leads.filter((l) => matchLead(l, where)),
    count: async ({ where }: Lead) => leads.filter((l) => matchLead(l, where)).length,
    createMany: async ({ data }: Lead) => { for (const d of data) leads.push({ id: `l${++seq}`, status: 'queued', sentAt: null, repliedAt: null, unsubscribedAt: null, stage: null, followUpsSent: 0, ...d }); return { count: data.length }; },
    updateMany: async ({ where, data }: Lead) => { const m = leads.filter((l) => matchLead(l, where)); m.forEach((l) => Object.assign(l, data)); return { count: m.length }; },
  },
  platformCampaign: {
    count: async () => registry.length,
    create: async ({ data }: Lead) => { const r = { id: `p${++seq}`, updatedAt: new Date(), ...data }; registry.push(r); return r; },
    findUnique: async ({ where }: Lead) => registry.find((r) => r.id === where.id) ?? null,
    findMany: async () => registry,
    update: async ({ where, data }: Lead) => { Object.assign(registry.find((r) => r.id === where.id)!, data); },
    delete: async ({ where }: Lead) => { registry = registry.filter((r) => r.id !== where.id); },
  },
  adminAuditLog: { create: async ({ data }: Lead) => { audit.push(data); } },
} }));
vi.mock('@/lib/outreachSender', () => ({
  newLeadToken: () => `tok${++seq}`, loadMailbox: async () => mailbox,
  sendBatch: async (a: { kind: string; campaignId: string; userId: string }) => { sendCalls.push(a); return { sent: 2, failed: 0, skipped: 0, remainingToday: 10, leftToSend: 0, capReached: false }; },
}));
vi.mock('@/lib/acqInboxReader', () => ({ checkInbox: async () => ({ ok: true, scanned: 0, replies: 0, duplicates: 0 }) }));
vi.mock('@/lib/automationAi', () => ({ planAutomation: async () => ({ source: 'rules', automation: null }) }));

import { eligiblePeople, createPlatformCampaign, applyGoal, deleteCampaign, parseRegistry, sendNow, sendSafetyProblem, setCampaignState, kindOf, displayStatus } from '@/lib/platformCampaign';

const mk = (id: string, o: Partial<User> = {}): User => ({ id, email: `${id}@example.com`, name: `User ${id}`, plan: 'free', planExpiresAt: null, emailVerified: new Date(NOW - 30 * DAY), createdAt: new Date(NOW - 60 * DAY), lastActiveAt: new Date(NOW - 20 * DAY), ...o });
const ADMIN = { adminUserId: 'admin1', adminEmail: 'admin@runvax.com' };
beforeEach(() => { users = []; payments = []; life = []; campaigns = []; leads = []; registry = []; settings = []; audit = []; sendCalls = []; mailbox = { fromAddress: 'hello@runvax.com' }; seq = 0; vi.stubEnv('NEXTAUTH_URL', 'https://runvax.com'); });

describe('who is eligible', () => {
  it('skips suspended, unsubscribed, invalid, duplicate and address-less accounts, and applies the filters', async () => {
    users = [mk('a'), mk('b', { isSuspended: true }), mk('c'), mk('d', { email: 'not-an-email' }), mk('e', { email: 'A@example.com' }), mk('f', { email: null }), mk('g', { emailVerified: null })];
    life = [{ userId: 'c', key: 'optout' }];
    const all = await eligiblePeople(emptySegment(), NOW); expect(all.people.map((u) => u.id)).toEqual(['a', 'g']); expect(all.optedOut).toBe(1);
    const ver = await eligiblePeople({ ...emptySegment(), verified: 'yes' }, NOW); expect(ver.people.map((u) => u.id)).toEqual(['a']);
  });
  it('plan kinds: free, on a trial, paying', () => {
    const t = new Set(['t1']); const p = new Set(['p1']);
    expect(kindOf({ id: 'a', plan: 'free' }, t, p)).toBe('free'); expect(kindOf({ id: 't1', plan: 'pro' }, t, p)).toBe('trial'); expect(kindOf({ id: 'p1', plan: 'pro' }, t, p)).toBe('paid');
  });
});

describe('creating a campaign on the engine', () => {
  const plan = () => sampleById('ai_agents')!.plan;
  it('saves an ordinary campaign owned by the admin, with the matching users as leads and the page link on every lead', async () => {
    users = [mk('a'), mk('b'), mk('c', { emailVerified: null })]; life = [{ userId: 'b', key: 'optout' }];
    const r = await createPlatformCampaign({ ...ADMIN, plan: plan() });
    expect('error' in r).toBe(false); if ('error' in r) return;
    expect(r.added).toBe(1);                                                       // a only: b unsubscribed, c unverified
    expect(campaigns).toHaveLength(1); expect(campaigns[0].userId).toBe('admin1'); expect(campaigns[0].status).toBe('draft');
    expect(campaigns[0].maxFollowUps).toBe(2); expect(campaigns[0].automation.emails).toHaveLength(3);
    expect(leads).toHaveLength(1); expect(leads[0]).toMatchObject({ email: 'a@example.com', userId: 'admin1', campaignId: campaigns[0].id, website: 'https://runvax.com/client-acquisition/agents' });
    expect(leads[0].token).toBeTruthy();                                           // the secret behind the open pixel and unsubscribe link
    expect(registry[0].config).toMatchObject({ outreachCampaignId: campaigns[0].id, goal: 'come_back', linkPath: '/client-acquisition/agents' });
    expect(audit.map((a) => a.action)).toContain('platform_campaign_created');
  });
  it('sets the sender name only where it was blank, and never overwrites the admin\'s own', async () => {
    users = [mk('a')];
    await createPlatformCampaign({ ...ADMIN, plan: plan() }); expect(settings[0]).toMatchObject({ senderName: 'The RUNVAX team', smtpFrom: 'RUNVAX' });
    settings[0].senderName = 'Azeez'; await createPlatformCampaign({ ...ADMIN, plan: plan() }); expect(settings[0].senderName).toBe('Azeez');
  });
  it('refuses when nobody matches, and when the emails are unusable', async () => {
    users = [mk('a', { emailVerified: null })];
    expect(await createPlatformCampaign({ ...ADMIN, plan: plan() })).toMatchObject({ error: expect.stringMatching(/Nobody matches/) });
    expect(await createPlatformCampaign({ ...ADMIN, plan: { ...plan(), automation: { ...plan().automation, emails: [] } } })).toMatchObject({ error: expect.any(String) });
    expect(campaigns).toHaveLength(0); expect(registry).toHaveLength(0);
  });
});

describe('the goal stops follow-ups', () => {
  it('marks people who claimed the trial as converted, so the engine leaves them alone', async () => {
    users = [mk('claimed', { plan: 'pro' }), mk('free')]; payments = [{ userId: 'claimed', reference: 'trial_claimed', amount: 0, status: 'trial' }];
    campaigns = [{ id: 'c1', userId: 'admin1' }];
    leads = [
      { id: 'l1', campaignId: 'c1', email: 'claimed@example.com', status: 'sent', repliedAt: null, unsubscribedAt: null, stage: null, sentAt: new Date(NOW) },
      { id: 'l2', campaignId: 'c1', email: 'free@example.com', status: 'sent', repliedAt: null, unsubscribedAt: null, stage: null, sentAt: new Date(NOW) },
    ];
    expect(await applyGoal('c1', 'claim_trial')).toBe(1);
    expect(leads[0].stage).toBe('customer'); expect(leads[1].stage).toBeNull();
    expect(await applyGoal('c1', 'none')).toBe(0);
  });
  it('come-back: only people active since the first email count', async () => {
    users = [mk('back', { lastActiveAt: new Date(NOW) }), mk('quiet', { lastActiveAt: new Date(NOW - 20 * DAY) })];
    leads = [
      { id: 'l1', campaignId: 'c1', email: 'back@example.com', status: 'sent', repliedAt: null, unsubscribedAt: null, stage: null, sentAt: new Date(NOW - 5 * DAY) },
      { id: 'l2', campaignId: 'c1', email: 'quiet@example.com', status: 'sent', repliedAt: null, unsubscribedAt: null, stage: null, sentAt: new Date(NOW - 5 * DAY) },
    ];
    expect(await applyGoal('c1', 'come_back')).toBe(1); expect(leads[0].stage).toBe('customer');
  });
});

describe('sending and its safeguards', () => {
  const setup = (status = 'running', goal = 'claim_trial') => {
    campaigns = [{ id: 'c1', userId: 'admin1', status, startedAt: new Date(NOW), automation: sampleById('ai_agents')!.plan.automation }];
    registry = [{ id: 'p1', name: 'X', config: { outreachCampaignId: 'c1', purpose: 'announce', goal, stopOnGoal: true, segment: emptySegment(), linkPath: '/client-acquisition' } }];
  };
  it('a follow-up send first leaves people who reached the goal alone, then runs the engine for the admin account', async () => {
    setup(); users = [mk('claimed', { plan: 'pro' })]; payments = [{ userId: 'claimed', reference: 'trial_claimed', amount: 0, status: 'trial' }];
    leads = [{ id: 'l1', campaignId: 'c1', email: 'claimed@example.com', status: 'sent', repliedAt: null, unsubscribedAt: null, stage: null, sentAt: new Date(NOW) }];
    const r = await sendNow('admin1', 'p1', 'followup');
    expect('error' in r).toBe(false); if ('error' in r) return;
    expect(r.stoppedByGoal).toBe(1); expect(leads[0].stage).toBe('customer'); expect(sendCalls).toEqual([{ kind: 'followup', campaignId: 'c1', userId: 'admin1' }]);
  });
  it('a paused campaign sends nothing, and another account\'s campaign is not reachable', async () => {
    setup('paused'); expect(await sendNow('admin1', 'p1', 'followup')).toMatchObject({ error: expect.stringMatching(/paused/) });
    setup(); expect(await sendNow('someone-else', 'p1', 'followup')).toMatchObject({ error: 'Campaign not found' }); expect(sendCalls).toHaveLength(0);
  });
  it('"completed" on the engine only means every first email went out: follow-ups still send until the admin marks it finished', async () => {
    expect(displayStatus('active', 'completed')).toBe('running'); expect(displayStatus('active', 'running')).toBe('running');
    expect(displayStatus('draft', 'draft')).toBe('draft'); expect(displayStatus('paused', 'paused')).toBe('paused'); expect(displayStatus('finished', 'completed')).toBe('finished');
    setup('completed'); registry[0].status = 'active'; users = [mk('a')]; leads = [];
    const r = await sendNow('admin1', 'p1', 'followup'); expect('error' in r).toBe(false); expect(sendCalls).toHaveLength(1);
    await setCampaignState('admin1', 'p1', 'finished'); sendCalls = [];
    expect(await sendNow('admin1', 'p1', 'followup')).toMatchObject({ error: expect.stringMatching(/finished/) }); expect(sendCalls).toHaveLength(0);
  });
  it('pausing and finishing change the engine campaign and the registry together', async () => {
    setup(); expect(await setCampaignState('admin1', 'p1', 'paused')).toEqual({ ok: true }); expect(campaigns[0].status).toBe('paused'); expect(registry[0].status).toBe('paused');
    await setCampaignState('admin1', 'p1', 'finished'); expect(campaigns[0].status).toBe('completed'); expect(registry[0].status).toBe('finished');
  });
  it('a campaign that has sent cannot be deleted; one that has not can, with its contacts', async () => {
    setup(); leads = [{ id: 'l1', campaignId: 'c1', userId: 'admin1', email: 'a@x.com', sentAt: new Date(NOW) }];
    expect(await deleteCampaign('admin1', 'admin@runvax.com', 'p1')).toMatchObject({ status: 409 }); expect(registry).toHaveLength(1);
    leads = [{ id: 'l1', campaignId: 'c1', userId: 'admin1', email: 'a@x.com', sentAt: null }];
    expect(await deleteCampaign('admin1', 'admin@runvax.com', 'p1')).toEqual({ ok: true }); expect(registry).toHaveLength(0); expect(campaigns).toHaveLength(0); expect(leads).toHaveLength(0);
  });
  it('refuses to send from a production server whose own address is local or not https', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000'); expect(sendSafetyProblem()).toMatch(/Refusing to send/);
    vi.stubEnv('NEXTAUTH_URL', 'http://runvax.com'); expect(sendSafetyProblem()).toMatch(/Refusing/);
    vi.stubEnv('NEXTAUTH_URL', 'https://runvax.com'); expect(sendSafetyProblem()).toBeNull();
    vi.stubEnv('NODE_ENV', 'test');
  });
});

describe('old-format campaigns', () => {
  it('a campaign from the first version has no engine campaign behind it, and is handled safely', async () => {
    expect(parseRegistry({ steps: [{ subject: 'a', body: 'b' }] })).toBeNull(); expect(parseRegistry(null)).toBeNull();
    registry = [{ id: 'old', name: 'Old', config: { steps: [] } }];
    expect(await deleteCampaign('admin1', 'admin@runvax.com', 'old')).toEqual({ ok: true }); expect(registry).toHaveLength(0);
  });
});
