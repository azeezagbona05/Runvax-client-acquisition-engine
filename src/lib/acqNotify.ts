import { prisma } from '@/lib/prisma';
import { createTransporter } from '@/lib/email';
import { getAppUrl } from '@/lib/url';
import { REPLY_LABEL, type ReplyClass } from '@/lib/replyIntel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Tells the account owner a prospect answered, using the platform's mail server. Throws on failure; the caller treats it as best-effort. */
export async function notifyOwnerOfReply(n: { userId: string; campaignName: string; leadLabel: string; replyClass: ReplyClass; excerpt: string }): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: n.userId }, select: { email: true, name: true } });
  if (!user?.email) return;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error('No platform mail server configured.');
  const link = `${getAppUrl()}/client-acquisition/inbox`;
  await createTransporter().sendMail({
    from, to: user.email,
    subject: `${n.leadLabel} replied: ${REPLY_LABEL[n.replyClass]}`,
    text: `${n.leadLabel} replied to "${n.campaignName}" (${REPLY_LABEL[n.replyClass]}).\n\n"${n.excerpt}"\n\nFollow-ups to them have stopped. A suggested answer is ready for you to review: ${link}`,
    html: `<p><strong>${esc(n.leadLabel)}</strong> replied to “${esc(n.campaignName)}” (${esc(REPLY_LABEL[n.replyClass])}).</p><blockquote>${esc(n.excerpt)}</blockquote><p>Follow-ups to them have stopped. A suggested answer is ready for you to review: <a href="${link}">open your inbox</a>.</p>`,
  });
}
