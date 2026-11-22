import { describe, it, expect } from 'vitest';
import { preflight, isRoleAddress, type PreflightInput } from '@/lib/preflight';

const base = (o: Partial<PreflightInput> = {}): PreflightInput => ({
  mailbox: { connected: true, fromAddress: 'sam@webco.ng', senderNamed: true }, dns: { spf: true, dmarc: true },
  subject: 'A website for {{business}}', bodies: ['Hi {{name}},\n\nHello.'], dailyCap: 30, status: 'draft', followUps: 2, autoFollowUps: false,
  leads: { queued: 50, total: 50, noName: 5, roleAddress: 5 }, hasOfferLink: false, ...o,
});
const ids = (p: ReturnType<typeof preflight>, level: string) => p.checks.filter((c) => c.level === level).map((c) => c.id);

describe('preflight', () => {
  it('a healthy campaign is ready with no blockers or warnings', () => {
    const p = preflight(base());
    expect(p.ready).toBe(true);
    expect(ids(p, 'block')).toEqual([]);
    expect(ids(p, 'warn')).toEqual([]);
  });
  it('blocks without a mailbox, sender name, leads, or with a [Your Name] placeholder', () => {
    expect(ids(preflight(base({ mailbox: { connected: false, senderNamed: false } })), 'block')).toEqual(['mailbox']);
    expect(ids(preflight(base({ mailbox: { connected: true, fromAddress: 'a@b.ng', senderNamed: false } })), 'block')).toEqual(['sender']);
    expect(ids(preflight(base({ leads: { queued: 0, total: 0, noName: 0, roleAddress: 0 } })), 'block')).toEqual(['leads']);
    const p = preflight(base({ bodies: ['Thanks,\n[Your Name]'] }));
    expect(p.ready).toBe(false);
    expect(ids(p, 'block')).toContain('placeholder');
  });
  it('a finished campaign with nobody queued is not blocked', () => expect(preflight(base({ status: 'completed', leads: { queued: 0, total: 40, noName: 0, roleAddress: 0 } })).ready).toBe(true));
  it('warns about spam-trigger subjects and shouting, and long subjects', () => {
    const p = preflight(base({ subject: 'FREE website + FREE domain for your clinic this Black Friday, limited time!!' }));
    expect(ids(p, 'warn')).toEqual(expect.arrayContaining(['subject-spam', 'shouting', 'subject-len']));
  });
  it('warns when several spam words pile up in the body', () => {
    expect(ids(preflight(base({ bodies: ['Free domain, guaranteed results, act now, risk-free.'] })), 'warn')).toContain('body-spam');
  });
  it('flags missing SPF and DMARC on a business domain', () => {
    const p = preflight(base({ dns: { spf: false, dmarc: false } }));
    expect(ids(p, 'warn')).toEqual(expect.arrayContaining(['spf', 'dmarc']));
  });
  it('says honestly when it could not look the records up', () => expect(ids(preflight(base({ dns: { spf: null, dmarc: null } })), 'info')).toContain('dns'));
  it('treats free mailboxes differently: no DNS advice, a cap warning when high', () => {
    const free = base({ mailbox: { connected: true, fromAddress: 'sam@gmail.com', senderNamed: true }, dns: null });
    expect(ids(preflight(free), 'warn')).toEqual([]);
    expect(ids(preflight({ ...free, dailyCap: 150 }), 'warn')).toContain('freemail');
  });
  it('warns about a big daily cap on a new business mailbox', () => expect(ids(preflight(base({ dailyCap: 200 })), 'warn')).toContain('cap'));
  it('notes missing names and shared inboxes without blocking', () => {
    const p = preflight(base({ leads: { queued: 10, total: 10, noName: 8, roleAddress: 8 } }));
    expect(ids(p, 'info')).toEqual(expect.arrayContaining(['names', 'role']));
    expect(p.ready).toBe(true);
  });
  it('lists blockers first', () => {
    const p = preflight(base({ mailbox: { connected: false, senderNamed: false }, subject: 'FREE FREE' }));
    expect(p.checks[0].level).toBe('block');
  });
  it('recognises shared inboxes', () => { expect(isRoleAddress('info@x.ng')).toBe(true); expect(isRoleAddress('ada@x.ng')).toBe(false); });
});
