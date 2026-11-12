import { prisma } from '@/lib/prisma';
import { createTransporter, emailShell, ctaButton } from '@/lib/email';
import { getAppUrl } from '@/lib/url';
import { sanitizePermissions } from '@/lib/career/types';
import { computeReminders, type Reminder } from './reminders';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const HOUR = 3_600_000;

/** What is worth an email today: interviews in the next 48h that were not mentioned yet, and follow-ups that became due in the last 36h (so nobody is nagged daily). */
export function worthEmailing(items: Reminder[], sentInterviewIds: Set<string>, now: Date): Reminder[] {
  return items.filter((r) => (r.kind === 'interview' && r.due.getTime() - now.getTime() <= 48 * HOUR && !sentInterviewIds.has(r.id)) || (r.kind === 'follow_up' && now.getTime() - r.due.getTime() <= 36 * HOUR));
}

export function digestHtml(name: string, items: Reminder[]): string {
  const rows = items.map((r) => `<li style="margin:6px 0;"><b>${esc(r.title)}</b><br><span style="color:#64748b;">${r.kind === 'interview' ? esc(r.due.toUTCString()) + ' · ' : ''}${esc(r.detail)}</span></li>`).join('');
  return `<h2 style="margin:0 0 12px;font-size:20px;">Your Career Agent reminders</h2><p>Hi ${esc(name.split(' ')[0] || 'there')}, here is what needs you:</p><ul style="padding-left:18px;">${rows}</ul>${ctaButton('Open my Career Agent', `${getAppUrl()}/client-acquisition/career`)}<p style="color:#64748b;font-size:12px;">You can turn these emails off in your Career Agent setup (step 4).</p>`;
}

/** Sends at most one email to one user. Returns how many items it contained. Never throws: a mail problem must not stop the other users. */
export async function sendDigestFor(userId: string, now = new Date()): Promise<number> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, isSuspended: true, careerPreference: { select: { permissions: true, status: true } } } });
  if (!u?.email || u.isSuspended || u.careerPreference?.status !== 'active' || !sanitizePermissions(u.careerPreference.permissions).remindByEmail) return 0;
  const all = await computeReminders(userId, now);
  const sent = new Set((await prisma.careerInterview.findMany({ where: { userId, reminderSentAt: { not: null } }, select: { id: true } })).map((i) => i.id));
  const items = worthEmailing(all, sent, now); if (!items.length) return 0;
  if (!(process.env.RESEND_API_KEY || process.env.SMTP_HOST)) return 0;
  try {
    await createTransporter().sendMail({ from: `"${process.env.APP_NAME || 'Runvax'}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`, to: u.email, subject: `Career Agent: ${items.length} thing${items.length > 1 ? 's' : ''} need you`, html: emailShell(process.env.APP_NAME || 'Runvax', digestHtml(u.name ?? '', items), 'Interviews and follow-ups') });
    const ids = items.filter((i) => i.kind === 'interview').map((i) => i.id);
    if (ids.length) await prisma.careerInterview.updateMany({ where: { id: { in: ids }, userId }, data: { reminderSentAt: now } });
    return items.length;
  } catch (e) { console.error('[career-reminders] email failed', e instanceof Error ? e.message : e); return 0; }
}
