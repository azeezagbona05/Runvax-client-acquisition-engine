import { prisma } from '@/lib/prisma';
import { createTransporter, emailShell, ctaButton } from '@/lib/email';
import { getAppUrl } from '@/lib/url';
import { LIMITS, makeRef, statusAfterMessage, type NewTicketInput, type TicketStatus } from '@/lib/supportShared';

const appName = () => process.env.APP_NAME || 'Runvax';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const html = (s: string) => esc(s).replace(/\n/g, '<br>');
const adminEmails = () => (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const from = () => `"${appName()} Support" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;

/** Best effort: a failed email must never fail the ticket. */
async function mail(to: string, subject: string, bodyHtml: string, preheader: string) {
  if (!to || !(process.env.RESEND_API_KEY || process.env.SMTP_HOST)) return;
  try {
    await createTransporter().sendMail({ from: from(), to, subject, html: emailShell(appName(), bodyHtml, preheader) });
  } catch (e) { console.error('[support] email failed', e instanceof Error ? e.message : e); }
}

type MsgRow = { id: string; author: string; authorName: string | null; body: string; createdAt: Date };
const shapeMsg = (m: MsgRow) => ({ id: m.id, author: m.author as 'user' | 'staff', authorName: m.authorName, body: m.body, createdAt: m.createdAt.toISOString() });
type TicketRow = { id: string; ref: string; email: string; name: string | null; subject: string; category: string; status: string; lastBy: string; createdAt: Date; lastReplyAt: Date };
const shapeTicket = (t: TicketRow) => ({ id: t.id, ref: t.ref, email: t.email, name: t.name, subject: t.subject, category: t.category, status: t.status as TicketStatus, lastBy: t.lastBy as 'user' | 'staff', createdAt: t.createdAt.toISOString(), lastReplyAt: t.lastReplyAt.toISOString() });
export type TicketSummary = ReturnType<typeof shapeTicket>;
export type TicketMessage = ReturnType<typeof shapeMsg>;

export async function createTicket(user: { id: string; email: string; name?: string | null }, input: NewTicketInput): Promise<{ ok: true; ticket: TicketSummary } | { ok: false; error: string }> {
  const open = await prisma.supportTicket.count({ where: { userId: user.id, status: { in: ['open', 'pending'] } } });
  if (open >= LIMITS.openPerUser) return { ok: false, error: `You already have ${open} open tickets. Please wait for a reply, or close one you no longer need.` };
  let ref = makeRef();
  for (let i = 0; i < 4 && await prisma.supportTicket.findUnique({ where: { ref }, select: { id: true } }); i++) ref = makeRef();
  const t = await prisma.supportTicket.create({
    data: { ref, userId: user.id, email: user.email, name: user.name ?? null, subject: input.subject, category: input.category, messages: { create: { author: 'user', authorName: user.name ?? user.email, body: input.body } } },
  });
  const link = `${getAppUrl()}/client-acquisition/help`;
  // Confirmation to the customer, heads-up to the team.
  void mail(user.email, `[${ref}] We got your request: ${input.subject}`,
    `<h2 style="margin:0 0 12px;font-size:20px;">We got your request</h2><p>Hi ${esc(user.name?.split(' ')[0] || 'there')}, your ticket <b>${ref}</b> is open. A real person will reply here by email and in Help &amp; support.</p><blockquote style="margin:16px 0;padding:10px 14px;border-left:3px solid #cbd5e1;color:#475569;">${html(input.body.slice(0, 600))}</blockquote>${ctaButton('Open my tickets', link)}`,
    `Ticket ${ref} is open`);
  const admins = adminEmails();
  if (admins.length) void mail(admins.join(', '), `[${ref}] New support ticket: ${input.subject}`,
    `<h2 style="margin:0 0 12px;font-size:20px;">New support ticket</h2><p><b>${esc(user.email)}</b> · ${esc(input.category)}</p><p><b>${esc(input.subject)}</b></p><p>${html(input.body.slice(0, 1200))}</p>${ctaButton('Reply in admin', `${getAppUrl()}/admin#support`)}`,
    `${user.email}: ${input.subject}`);
  return { ok: true, ticket: shapeTicket(t) };
}

export async function listMine(userId: string) {
  const rows = await prisma.supportTicket.findMany({ where: { userId }, orderBy: { lastReplyAt: 'desc' }, take: 100 });
  return rows.map(shapeTicket);
}

export async function getMine(userId: string, id: string) {
  const t = await prisma.supportTicket.findFirst({ where: { id, userId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  return t ? { ticket: shapeTicket(t), messages: t.messages.map(shapeMsg) } : null;
}

/** Customer writes on their own ticket (also reopens a resolved one). Closed tickets stay closed: open a new one. */
export async function userReply(user: { id: string; email: string; name?: string | null }, id: string, body: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const t = await prisma.supportTicket.findFirst({ where: { id, userId: user.id } });
  if (!t) return { ok: false, error: 'Ticket not found.', status: 404 };
  if (t.status === 'closed') return { ok: false, error: 'This ticket is closed. Please open a new one.', status: 409 };
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: t.id, author: 'user', authorName: user.name ?? user.email, body } }),
    prisma.supportTicket.update({ where: { id: t.id }, data: { status: statusAfterMessage('user', t.status as TicketStatus), lastBy: 'user', lastReplyAt: new Date() } }),
  ]);
  const admins = adminEmails();
  if (admins.length) void mail(admins.join(', '), `[${t.ref}] Customer replied: ${t.subject}`,
    `<p><b>${esc(user.email)}</b> replied on <b>${t.ref}</b>:</p><p>${html(body.slice(0, 1200))}</p>${ctaButton('Reply in admin', `${getAppUrl()}/admin#support`)}`, `${user.email} replied`);
  return { ok: true };
}

export async function userSetStatus(userId: string, id: string, status: 'closed' | 'open'): Promise<boolean> {
  const t = await prisma.supportTicket.findFirst({ where: { id, userId }, select: { id: true, status: true } });
  if (!t) return false;
  if (status === 'open' && t.status === 'closed') return false; // closed means closed
  await prisma.supportTicket.update({ where: { id }, data: { status, ...(status === 'open' ? { lastBy: 'user', lastReplyAt: new Date() } : {}) } });
  return true;
}

// ---- admin side ----
export async function adminList(filter: string, q: string) {
  const where: Record<string, unknown> = {};
  if (filter === 'open' || filter === 'pending' || filter === 'resolved' || filter === 'closed') where.status = filter;
  if (q) where.OR = [{ subject: { contains: q } }, { email: { contains: q } }, { ref: { contains: q.toUpperCase() } }];
  const [rows, grouped] = await Promise.all([
    prisma.supportTicket.findMany({ where, orderBy: { lastReplyAt: 'desc' }, take: 200 }),
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = { open: 0, pending: 0, resolved: 0, closed: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  return { tickets: rows.map(shapeTicket), counts };
}

export async function adminGet(id: string) {
  const t = await prisma.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  if (!t) return null;
  const user = await prisma.user.findUnique({ where: { id: t.userId }, select: { plan: true, createdAt: true } }).catch(() => null);
  return { ticket: shapeTicket(t), messages: t.messages.map(shapeMsg), customer: user ? { plan: user.plan, since: user.createdAt.toISOString() } : null };
}

export async function adminReply(admin: { email: string }, id: string, body: string, status?: TicketStatus): Promise<boolean> {
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) return false;
  const next = status ?? statusAfterMessage('staff', t.status as TicketStatus);
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: t.id, author: 'staff', authorName: `${appName()} Support`, body } }),
    prisma.supportTicket.update({ where: { id: t.id }, data: { status: next, lastBy: 'staff', lastReplyAt: new Date() } }),
    prisma.adminAuditLog.create({ data: { actorEmail: admin.email, action: 'support_reply', title: `Replied to ${t.ref}`, detail: t.subject } }),
  ]);
  await mail(t.email, `[${t.ref}] Re: ${t.subject}`,
    `<p>Hi ${esc(t.name?.split(' ')[0] || 'there')},</p><p>${html(body)}</p><p style="color:#64748b;font-size:13px;">Ticket ${t.ref}. You can reply to this from Help &amp; support inside ${esc(appName())}.</p>${ctaButton('Open my ticket', `${getAppUrl()}/client-acquisition/help`)}`,
    `Reply on ${t.ref}`);
  return true;
}

export async function adminSetStatus(admin: { email: string }, id: string, status: TicketStatus): Promise<boolean> {
  const t = await prisma.supportTicket.findUnique({ where: { id }, select: { ref: true } });
  if (!t) return false;
  await prisma.$transaction([
    prisma.supportTicket.update({ where: { id }, data: { status } }),
    prisma.adminAuditLog.create({ data: { actorEmail: admin.email, action: 'support_status', title: `Marked ${t.ref} ${status}` } }),
  ]);
  return true;
}
