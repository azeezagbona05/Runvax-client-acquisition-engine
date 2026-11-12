// Pure helpers for Help & support tickets (no database, safe to import in the browser).

export const CATEGORIES = [
  { id: 'question', label: 'A question' },
  { id: 'problem', label: 'Something is not working' },
  { id: 'billing', label: 'Billing or plan' },
  { id: 'campaigns', label: 'Campaigns and sending' },
  { id: 'agents', label: 'AI agents' },
  { id: 'account', label: 'My account' },
  { id: 'feedback', label: 'Feedback or an idea' },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];

export const STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open', pending: 'Waiting for you', resolved: 'Resolved', closed: 'Closed',
};
/** Admin wording: "pending" means the ball is with the customer. */
export const ADMIN_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Needs a reply', pending: 'Waiting on customer', resolved: 'Resolved', closed: 'Closed',
};

export const LIMITS = { subject: 160, body: 5000, openPerUser: 10 };

export function isCategory(v: unknown): v is Category { return CATEGORIES.some((c) => c.id === v); }
export function isStatus(v: unknown): v is TicketStatus { return (STATUSES as readonly string[]).includes(v as string); }

/** Trim, drop control characters (keep newlines and tabs) and cap the length. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export type NewTicketInput = { subject: string; body: string; category: Category };

export function validateNewTicket(raw: unknown): { ok: true; value: NewTicketInput } | { ok: false; error: string } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const subject = cleanText(o.subject, LIMITS.subject).replace(/\n+/g, ' ');
  const body = cleanText(o.body, LIMITS.body);
  const category: Category = isCategory(o.category) ? o.category : 'question';
  if (subject.length < 4) return { ok: false, error: 'Give your ticket a short subject (at least 4 characters).' };
  if (body.length < 10) return { ok: false, error: 'Tell us a little more so we can help (at least 10 characters).' };
  return { ok: true, value: { subject, body, category } };
}

export function validateReply(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const body = cleanText(o.body, LIMITS.body);
  if (body.length < 2) return { ok: false, error: 'Write your reply first.' };
  return { ok: true, body };
}

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function makeRef(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_CHARS[Math.floor(rand() * REF_CHARS.length)];
  return `RX-${s}`;
}

/** Status after someone writes: a customer message needs staff; a staff reply waits on the customer. */
export function statusAfterMessage(author: 'user' | 'staff', current: TicketStatus): TicketStatus {
  if (author === 'user') return 'open'; // also reopens resolved tickets
  return current === 'closed' ? 'closed' : 'pending';
}
