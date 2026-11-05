import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;
const h = vi.hoisted(() => {
  type R = Record<string, unknown>;
  const db = { campaigns: [] as R[], leads: [] as R[] };
  const verdict = { fn: vi.fn<(...a: unknown[]) => unknown>() };

  // A tiny matcher for the where-clauses the sender uses.
  function match(row: R, where: R): boolean {
    return Object.entries(where).every(([k, cond]) => {
      if (k === 'OR') return (cond as R[]).some((w) => match(row, w));
      if (k === 'AND') return (cond as R[]).every((w) => match(row, w));
      const v = row[k];
      if (cond === null) return v === null || v === undefined;
      if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
      if (cond && typeof cond === 'object') {
        const c = cond as Record<string, unknown>;
        return Object.entries(c).every(([op, x]) => {
          if (op === 'not') return x === null ? v !== null && v !== undefined : v !== x;
          if (op === 'in') return (x as unknown[]).includes(v);
          if (op === 'notIn') return !(x as unknown[]).includes(v);
          if (op === 'lt') return typeof v === 'number' && v < (x as number);
          if (op === 'gte') return v instanceof Date && v.getTime() >= (x as Date).getTime();
          if (op === 'lte') return v instanceof Date && v.getTime() <= (x as Date).getTime();
          return false;
        });
      }
      return v === cond;
    });
  }
  function apply(row: R, data: R) {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && !(v instanceof Date) && ('increment' in v || 'decrement' in v)) {
        const d = v as { increment?: number; decrement?: number };
        row[k] = ((row[k] as number) ?? 0) + (d.increment ?? 0) - (d.decrement ?? 0);
      } else row[k] = v;
    }
  }
  const table = (rows: () => R[]) => ({
    findFirst: async ({ where }: { where: R }) => { const r = rows().find((x) => match(x, where)); return r ? { ...r } : null; },
    findMany: async ({ where, take }: { where: R; take?: number }) => rows().filter((r) => match(r, where)).slice(0, take).map((r) => ({ ...r })),
    count: async ({ where }: { where: R }) => rows().filter((r) => match(r, where)).length,
    update: async ({ where, data }: { where: R; data: R }) => { const r = rows().find((x) => match(x, where))!; apply(r, data); return r; },
    updateMany: async ({ where, data }: { where: R; data: R }) => { const hit = rows().filter((r) => match(r, where)); hit.forEach((r) => apply(r, data)); return { count: hit.length }; },
  });
  return { db, verdict, table };
});
const { db, verdict, table } = h;

vi.mock('@/lib/prisma', () => ({ prisma: { outreachCampaign: h.table(() => h.db.campaigns), outreachLead: h.table(() => h.db.leads), userSettings: { findUnique: vi.fn() } } }));
vi.mock('@/lib/acquisition/recipientGuard', () => ({ checkRecipient: (...a: unknown[]) => h.verdict.fn(...a) }));

import { sendBatch, sendTestEmail, type UserMailbox } from '@/lib/outreachSender';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12);
const sendMail = vi.fn();
const mailbox = { transport: { sendMail }, fromAddress: 'sam@webco.com', fromName: 'Sam', sender: { name: 'Sam', business: 'Webco' } } as unknown as UserMailbox;
const deps = { mailbox, now: () => NOW, pauseMs: 0, appUrl: 'https://app.test' };

const campaign = (over: Row = {}): Row => ({
  id: 'c1', userId: 'u1', name: 'Dental', subject: 'Hello {{business}}', body: 'Hi {{name}}', followUpSubject: null, followUpBody: null,
  followUpAfterDays: 3, maxFollowUps: 1, dailyCap: 30, status: 'running', startedAt: new Date(NOW - 5 * DAY), ...over,
});
const lead = (n: number, over: Row = {}): Row => ({
  id: `l${n}`, campaignId: 'c1', userId: 'u1', email: `p${n}@clinic.com`, name: `Pat ${n}`, business: `Clinic ${n}`, website: null,
  status: 'queued', token: `tok${n}xxxxxxxxxxxxxxxx`, messageId: null, sentAt: null, lastSentAt: null, followUpsSent: 0,
  openedAt: null, openCount: 0, repliedAt: null, unsubscribedAt: null, error: null, createdAt: new Date(NOW - n), ...over,
});
const byId = (id: string) => db.leads.find((l) => l.id === id)!;

beforeEach(() => {
  db.campaigns = [campaign()];
  db.leads = [];
  sendMail.mockReset().mockImplementation(async () => ({ messageId: `<m${Math.random()}@webco.com>` }));
  verdict.fn.mockReset().mockResolvedValue({ allowed: true });
});

describe('sendBatch: first emails', () => {
  it('sends to queued leads, personalised, with unsubscribe and pixel links, and records it', async () => {
    db.leads = [lead(1), lead(2)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r).toMatchObject({ sent: 2, failed: 0, skipped: 0, leftToSend: 0, remainingToday: 28 });
    const first = sendMail.mock.calls[0][0];
    expect(first.to).toBe('p1@clinic.com');
    expect(first.from).toBe('"Sam" <sam@webco.com>');
    expect(first.subject).toBe('Hello Clinic 1');
    expect(first.text).toContain('Hi Pat');
    expect(first.text).toContain('https://app.test/api/oc/unsubscribe?t=tok1xxxxxxxxxxxxxxxx');
    expect(first.html).toContain('https://app.test/api/oc/open/tok1xxxxxxxxxxxxxxxx');
    expect(first.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(byId('l1')).toMatchObject({ status: 'sent', sentAt: new Date(NOW) });
    expect(String(byId('l1').messageId)).toMatch(/^<m/);
  });

  it('marks the campaign completed when the last lead goes out', async () => {
    db.leads = [lead(1)];
    await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(db.campaigns[0].status).toBe('completed');
  });

  it('refuses unless the campaign is running', async () => {
    db.campaigns = [campaign({ status: 'paused' })];
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.aborted).toBe('not_started');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("won't touch another user's campaign", async () => {
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'someone-else', kind: 'initial' }, deps);
    expect(r.aborted).toBe('not_found');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('needs the sender own mailbox: never falls back to the platform', async () => {
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, { ...deps, mailbox: null });
    expect(r.aborted).toBe('no_mailbox');
    expect(byId('l1').status).toBe('queued');
  });

  it('stops at the daily limit and says how many are left', async () => {
    db.campaigns = [campaign({ dailyCap: 3 })];
    db.leads = [lead(1), lead(2), lead(3), lead(4), lead(5)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r).toMatchObject({ sent: 3, leftToSend: 2, remainingToday: 0, capReached: true });
    // A second press the same day sends nothing more.
    const again = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(again).toMatchObject({ sent: 0, capReached: true });
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it('counts the daily limit across all of the account campaigns', async () => {
    db.campaigns = [campaign({ dailyCap: 200 })];
    db.leads = [
      ...Array.from({ length: 199 }, (_, i) => lead(100 + i, { campaignId: 'other', status: 'sent', sentAt: new Date(NOW - 1000), lastSentAt: new Date(NOW - 1000) })),
      lead(1), lead(2),
    ];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.sent).toBe(1);
  });

  it('never sends to someone who unsubscribed from another campaign', async () => {
    db.leads = [
      lead(1, { campaignId: 'old', email: 'p2@clinic.com', status: 'unsubscribed', unsubscribedAt: new Date(NOW - DAY) }),
      lead(2),
    ];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r).toMatchObject({ sent: 0, skipped: 1 });
    expect(byId('l2').status).toBe('unsubscribed');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('skips recipients the guard refuses, with the reason', async () => {
    verdict.fn.mockResolvedValue({ allowed: false, status: 403, code: 'suppressed', message: 'This recipient has opted out.' });
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.skipped).toBe(1);
    expect(byId('l1')).toMatchObject({ status: 'skipped', error: 'This recipient has opted out.' });
  });

  it('puts the lead back and stops if the guard cannot be checked', async () => {
    verdict.fn.mockResolvedValue({ allowed: false, status: 503, code: 'check_unavailable', message: 'try again' });
    db.leads = [lead(1), lead(2)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.aborted).toBe('check_unavailable');
    expect([byId('l1').status, byId('l2').status]).toEqual(['queued', 'queued']);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('records a refused address as failed and carries on with the rest', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('550 mailbox unavailable'), { code: 'EENVELOPE' }));
    db.leads = [lead(1), lead(2)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
    expect(byId('l1')).toMatchObject({ status: 'failed', error: '550 mailbox unavailable' });
    expect(byId('l2').status).toBe('sent');
  });

  it('on a login or network failure, puts the lead back and stops without burning the list', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH' }));
    db.leads = [lead(1), lead(2), lead(3)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.aborted).toBe('mailbox_error');
    expect(r.message).toMatch(/login/i);
    expect(r.sent + r.failed).toBe(0);
    expect(db.leads.map((l) => l.status)).toEqual(['queued', 'queued', 'queued']);
    expect(db.campaigns[0].status).toBe('running');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('cannot double-send: a lead another request already claimed is skipped', async () => {
    db.leads = [lead(1, { status: 'sending' }), lead(2)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.sent).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});

describe('sendBatch: address check (Snov.io)', () => {
  const snov = (smtpStatus: 'valid' | 'not_valid' | 'unknown', disposable = false) => ({ email: 'x@y.com', smtpStatus, disposable, webmail: false });

  it('skips an address Snov says does not exist, and sends the rest', async () => {
    db.leads = [lead(1), lead(2)];
    const verify = vi.fn(async (e: string) => (e === 'p1@clinic.com' ? snov('not_valid') : snov('valid')));
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, { ...deps, verify });
    expect(r).toMatchObject({ sent: 1, skipped: 1 });
    expect(byId('l1')).toMatchObject({ status: 'skipped' });
    expect(String(byId('l1').error)).toContain('does not exist');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('skips disposable addresses', async () => {
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, { ...deps, verify: async () => snov('valid', true) });
    expect(r).toMatchObject({ sent: 0, skipped: 1 });
  });

  it('sends when Snov cannot decide (unknown) or does not answer', async () => {
    db.leads = [lead(1), lead(2)];
    const verify = vi.fn(async (e: string) => (e === 'p1@clinic.com' ? snov('unknown') : null));
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, { ...deps, verify });
    expect(r).toMatchObject({ sent: 2, skipped: 0 });
  });

  it('fails open when the check throws (outage, out of credits)', async () => {
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, { ...deps, verify: async () => { throw new Error('Snov.io: not enough credits.'); } });
    expect(r).toMatchObject({ sent: 1, skipped: 0 });
  });

  it('never checks follow-ups', async () => {
    db.leads = [lead(1, { status: 'sent', lastSentAt: new Date(NOW - 5 * DAY), sentAt: new Date(NOW - 5 * DAY), messageId: '<a@b>' })];
    const verify = vi.fn(async () => snov('not_valid'));
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'followup' }, { ...deps, verify });
    expect(verify).not.toHaveBeenCalled();
    expect(r.sent).toBe(1);
  });

  it('does nothing unless switched on', async () => {
    delete process.env.SNOV_VERIFY_BEFORE_SEND;
    db.leads = [lead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    expect(r.sent).toBe(1);
  });
});

describe('sendBatch: personalised first emails', () => {
  it("uses the lead's own written email instead of the template, but keeps the unsubscribe link", async () => {
    db.leads = [lead(1, { customSubject: 'About Clinic 1 specifically', customBody: 'Hello Dr Obi, I noticed your clinic.' }), lead(2)];
    await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'initial' }, deps);
    const first = sendMail.mock.calls[0][0];
    expect(first.subject).toBe('About Clinic 1 specifically');
    expect(first.text).toContain('Hello Dr Obi, I noticed your clinic.');
    expect(first.text).toContain('/api/oc/unsubscribe?t=');
    expect(sendMail.mock.calls[1][0].subject).toBe('Hello Clinic 2');
  });
  it('never uses personalised copy for a follow-up', async () => {
    db.leads = [lead(1, { status: 'sent', sentAt: new Date(NOW - 4 * DAY), lastSentAt: new Date(NOW - 4 * DAY), messageId: '<a@b>', customSubject: 'Custom', customBody: 'Custom body' })];
    await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'followup' }, deps);
    expect(sendMail.mock.calls[0][0].subject).toBe('Re: Hello Clinic 1');
    expect(sendMail.mock.calls[0][0].text).not.toContain('Custom body');
  });
});

describe('sendBatch: follow-ups', () => {
  const sentLead = (n: number, over: Row = {}) => lead(n, { status: 'sent', sentAt: new Date(NOW - 4 * DAY), lastSentAt: new Date(NOW - 4 * DAY), messageId: `<orig${n}@webco.com>`, ...over });

  it('follows up only those who are due, unanswered and still allowed, in the same thread', async () => {
    db.leads = [
      sentLead(1),                                                         // due
      sentLead(2, { lastSentAt: new Date(NOW - DAY) }),                    // too soon
      sentLead(3, { repliedAt: new Date(NOW - DAY) }),                     // replied
      sentLead(4, { status: 'unsubscribed', unsubscribedAt: new Date(NOW - DAY) }),
      sentLead(5, { followUpsSent: 1 }),                                   // already followed up
    ];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'followup' }, deps);
    expect(r).toMatchObject({ sent: 1, leftToSend: 0 });
    const m = sendMail.mock.calls[0][0];
    expect(m.to).toBe('p1@clinic.com');
    expect(m.subject).toBe('Re: Hello Clinic 1');
    expect(m.inReplyTo).toBe('<orig1@webco.com>');
    expect(m.references).toBe('<orig1@webco.com>');
    expect(byId('l1')).toMatchObject({ followUpsSent: 1, lastSentAt: new Date(NOW), status: 'sent' });
    expect(byId('l2').followUpsSent).toBe(0);
  });

  it('uses the custom follow-up wording when set', async () => {
    db.campaigns = [campaign({ followUpSubject: 'Quick nudge for {{business}}', followUpBody: 'Hey {{name}}, any thoughts?' })];
    db.leads = [sentLead(1)];
    await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'followup' }, deps);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ subject: 'Quick nudge for Clinic 1' });
    expect(sendMail.mock.calls[0][0].text).toContain('Hey Pat, any thoughts?');
  });

  it('reverts the follow-up count if the mailbox is down, so it is retried later', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    db.leads = [sentLead(1)];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'followup' }, deps);
    expect(r.aborted).toBe('mailbox_error');
    expect(byId('l1')).toMatchObject({ followUpsSent: 0, lastSentAt: new Date(NOW - 4 * DAY) });
  });

  it('is not available before the campaign was ever run', async () => {
    db.campaigns = [campaign({ startedAt: null, status: 'draft' })];
    const r = await sendBatch({ campaignId: 'c1', userId: 'u1', kind: 'followup' }, deps);
    expect(r.aborted).toBe('not_started');
  });
});

describe('sendTestEmail', () => {
  it('sends a clearly-marked sample to the given address', async () => {
    const r = await sendTestEmail('u1', { campaign: { subject: 'Hello {{business}}', body: 'Hi {{name}}' }, to: 'me@webco.com' }, deps);
    expect(r).toEqual({ ok: true });
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'me@webco.com', subject: '[Test] Hello Sample Business' });
    expect(sendMail.mock.calls[0][0].text).toContain('Hi Alex');
  });
  it('reports a mailbox problem instead of throwing', async () => {
    sendMail.mockRejectedValue(new Error('Invalid login'));
    expect(await sendTestEmail('u1', { campaign: { subject: 's', body: 'b' }, to: 'me@webco.com' }, deps)).toEqual({ ok: false, message: 'Invalid login' });
    expect(await sendTestEmail('u1', { campaign: { subject: 's', body: 'b' }, to: 'me@webco.com' }, { ...deps, mailbox: null })).toMatchObject({ ok: false });
  });
});
