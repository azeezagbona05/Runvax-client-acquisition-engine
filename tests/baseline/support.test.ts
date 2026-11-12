import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCS, DOC_SECTIONS, searchDocs } from '@/lib/helpDocs';
import { makeRef, statusAfterMessage, validateNewTicket, validateReply, cleanText } from '@/lib/supportShared';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let tickets: Row[] = []; let messages: Row[] = []; let audit: Row[] = []; let sent: Array<{ to: string; subject: string }> = []; let seq = 0;

vi.mock('@/lib/email', () => ({
  createTransporter: () => ({ sendMail: async (m: { to: string; subject: string }) => { sent.push({ to: m.to, subject: m.subject }); } }),
  emailShell: (_a: string, b: string) => b, ctaButton: (l: string) => l,
}));
vi.mock('@/lib/prisma', () => {
  const ticketApi = {
    count: async ({ where }: Row) => tickets.filter((t) => t.userId === where.userId && where.status.in.includes(t.status)).length,
    findUnique: async ({ where }: Row) => tickets.find((t) => (where.id ? t.id === where.id : t.ref === where.ref)) ?? null,
    findFirst: async ({ where }: Row) => tickets.find((t) => t.id === where.id && t.userId === where.userId) ?? null,
    create: async ({ data }: Row) => { const t = { id: `t${++seq}`, status: 'open', lastBy: 'user', createdAt: new Date(), lastReplyAt: new Date(), ...data, messages: undefined }; tickets.push(t); (data.messages?.create ? [data.messages.create] : []).forEach((m: Row) => messages.push({ id: `m${++seq}`, ticketId: t.id, createdAt: new Date(), ...m })); return t; },
    update: async ({ where, data }: Row) => { Object.assign(tickets.find((t) => t.id === where.id)!, data); },
  };
  return { prisma: {
    supportTicket: ticketApi,
    supportMessage: { create: async ({ data }: Row) => { messages.push({ id: `m${++seq}`, createdAt: new Date(), ...data }); } },
    adminAuditLog: { create: async ({ data }: Row) => { audit.push(data); } },
    user: { findUnique: async () => null },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } };
});
import { createTicket, userReply, userSetStatus, adminReply, adminSetStatus } from '@/lib/support';

const me = { id: 'u1', email: 'ada@example.com', name: 'Ada Obi' };
beforeEach(() => { tickets = []; messages = []; audit = []; sent = []; seq = 0; process.env.SMTP_HOST = 'x'; process.env.ADMIN_EMAILS = 'admin@runvax.com'; });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ticket validation', () => {
  it('requires a subject and some detail', () => {
    expect(validateNewTicket({ subject: 'hi', body: 'long enough body' }).ok).toBe(false);
    expect(validateNewTicket({ subject: 'Campaign stuck', body: 'short' }).ok).toBe(false);
    const ok = validateNewTicket({ subject: 'Campaign stuck', body: 'It will not start for me', category: 'nope' });
    expect(ok.ok && ok.value.category).toBe('question');
  });
  it('strips control characters and caps length', () => {
    expect(cleanText('a\u0000b\r\nc', 50)).toBe('ab\nc');
    expect(cleanText('x'.repeat(9000), 100)).toHaveLength(100);
    const v = validateNewTicket({ subject: 'Line one\nline two', body: 'a long enough body here' });
    expect(v.ok && v.value.subject).toBe('Line one line two');
  });
  it('rejects an empty reply', () => { expect(validateReply({ body: ' ' }).ok).toBe(false); expect(validateReply({ body: 'ok thanks' }).ok).toBe(true); });
  it('refs look like RX-XXXXXX without confusable characters', () => { for (let i = 0; i < 50; i++) expect(makeRef()).toMatch(/^RX-[A-HJ-NP-Z2-9]{6}$/); });
  it('status moves the right way after a message', () => {
    expect(statusAfterMessage('user', 'resolved')).toBe('open');
    expect(statusAfterMessage('staff', 'open')).toBe('pending');
    expect(statusAfterMessage('staff', 'closed')).toBe('closed');
  });
});

describe('ticket flow', () => {
  it('opens a ticket, confirms to the customer and tells the admins', async () => {
    const r = await createTicket(me, { subject: 'Cannot start campaign', body: 'It says something', category: 'campaigns' });
    expect(r.ok && r.ticket.ref).toMatch(/^RX-/);
    expect(messages).toHaveLength(1);
    await flush();
    expect(sent.map((s) => s.to).sort()).toEqual(['ada@example.com', 'admin@runvax.com']);
  });
  it('limits how many tickets one person can have open', async () => {
    for (let i = 0; i < 10; i++) await createTicket(me, { subject: `Ticket ${i} here`, body: 'some detail here', category: 'question' });
    const r = await createTicket(me, { subject: 'One more please', body: 'some detail here', category: 'question' });
    expect(r.ok).toBe(false);
  });
  it('staff reply waits on the customer and emails them; the customer replying reopens it', async () => {
    const r = await createTicket(me, { subject: 'Question about plans', body: 'What is included?', category: 'billing' });
    if (!r.ok) throw new Error('create failed');
    sent = [];
    expect(await adminReply({ email: 'admin@runvax.com' }, r.ticket.id, 'Here is the answer.')).toBe(true);
    expect(tickets[0].status).toBe('pending'); expect(tickets[0].lastBy).toBe('staff');
    expect(sent.some((s) => s.to === 'ada@example.com' && s.subject.includes(r.ticket.ref))).toBe(true);
    expect(audit[0].action).toBe('support_reply');
    await adminSetStatus({ email: 'admin@runvax.com' }, r.ticket.id, 'resolved');
    const back = await userReply(me, r.ticket.id, 'Thanks, one more thing');
    expect(back.ok).toBe(true); expect(tickets[0].status).toBe('open');
  });
  it('people can only touch their own tickets, and closed means closed', async () => {
    const r = await createTicket(me, { subject: 'Something is wrong', body: 'details here please', category: 'problem' });
    if (!r.ok) throw new Error('create failed');
    const other = await userReply({ id: 'u2', email: 'b@example.com' }, r.ticket.id, 'hello there');
    expect(other.ok).toBe(false); expect(!other.ok && other.status).toBe(404);
    expect(await userSetStatus('u1', r.ticket.id, 'closed')).toBe(true);
    const late = await userReply(me, r.ticket.id, 'still there?');
    expect(!late.ok && late.status).toBe(409);
    expect(await userSetStatus('u1', r.ticket.id, 'open')).toBe(false);
  });
  it('a failing mail server never fails the ticket', async () => {
    process.env.SMTP_HOST = 'x';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await createTicket(me, { subject: 'Mail is down today', body: 'but ticket must save', category: 'problem' });
    expect(r.ok).toBe(true);
  });
});

describe('documentation', () => {
  it('every article is in a known section with unique ids and real content', () => {
    const ids = new Set<string>();
    for (const d of DOCS) {
      expect(DOC_SECTIONS).toContain(d.section);
      expect(ids.has(d.id)).toBe(false); ids.add(d.id);
      expect(d.title.length).toBeGreaterThan(5); expect(d.summary.length).toBeGreaterThan(10); expect(d.body.length).toBeGreaterThan(0);
    }
    for (const s of DOC_SECTIONS) expect(DOCS.some((d) => d.section === s)).toBe(true);
  });
  it('search finds by title, keyword and body, and needs every word', () => {
    expect(searchDocs('follow-ups').some((d) => d.id === 'follow-ups')).toBe(true);
    expect(searchDocs('app password').some((d) => d.id === 'connect-mailbox')).toBe(true);
    expect(searchDocs('telegram').some((d) => d.id === 'agents-deploy')).toBe(true);
    expect(searchDocs('zzzznotathing')).toHaveLength(0);
    expect(searchDocs('')).toHaveLength(DOCS.length);
    expect(searchDocs('my follow-ups are not sending').length).toBeGreaterThan(0);
    expect(searchDocs('app password')[0].id).toBe('connect-mailbox');
  });
  it('makes no promises about reading replies automatically', () => {
    const text = JSON.stringify(DOCS).toLowerCase();
    expect(text).not.toContain('check inbox for replies');
  });
});
