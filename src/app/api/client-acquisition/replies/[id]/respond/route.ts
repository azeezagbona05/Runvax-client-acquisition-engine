import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { loadMailbox } from '@/lib/outreachSender';
import { logAgent } from '@/lib/acqReplies';
import { checkRecipient } from '@/lib/acquisition/recipientGuard';

export const dynamic = 'force-dynamic';

/** POST { body } — sends the answer the user approved (edited or not) from their own mailbox, in the same thread. One click, one email. */
async function handlePost(req: NextRequest, id: string) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-respond:${user.userId}`, { maxRequests: 30, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const b = await req.json().catch(() => null) as { body?: unknown } | null;
  const body = typeof b?.body === 'string' ? b.body.replace(/\0/g, '').trim().slice(0, 8000) : '';
  if (!body) return NextResponse.json({ error: 'Write the answer first.' }, { status: 400 });

  const reply = await prisma.campaignReply.findFirst({ where: { id, userId: user.userId }, include: { lead: { select: { id: true, email: true, messageId: true, unsubscribedAt: true, name: true, business: true } } } });
  if (!reply) return NextResponse.json({ error: 'Reply not found.' }, { status: 404 });
  if (reply.lead.unsubscribedAt) return NextResponse.json({ error: 'This contact has opted out and cannot be emailed.' }, { status: 409 });
  if (reply.replyClass === 'unsubscribe' || reply.replyClass === 'out_of_office') return NextResponse.json({ error: 'This reply does not need an answer.' }, { status: 409 });
  if (reply.respondedAt) return NextResponse.json({ error: 'You already answered this reply.' }, { status: 409 });

  const mailbox = await loadMailbox(user.userId);
  if (!mailbox) return NextResponse.json({ error: 'Connect your mailbox in Settings → Email first.' }, { status: 422 });
  const verdict = await checkRecipient(user.userId, { email: reply.lead.email });
  if (!verdict.allowed) return NextResponse.json({ error: verdict.message }, { status: verdict.code === 'check_unavailable' ? 503 : 409 });
  // Claim before sending so a double click cannot send twice.
  const claim = await prisma.campaignReply.updateMany({ where: { id, respondedAt: null }, data: { respondedAt: new Date() } });
  if (claim.count === 0) return NextResponse.json({ error: 'You already answered this reply.' }, { status: 409 });
  try {
    const subject = reply.subject ? (/^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject}`) : 'Re: your reply';
    await mailbox.transport.sendMail({
      from: mailbox.fromName ? `"${mailbox.fromName}" <${mailbox.fromAddress}>` : mailbox.fromAddress,
      to: reply.lead.email, replyTo: mailbox.replyTo, subject, text: body,
      ...(reply.messageId ? { inReplyTo: reply.messageId, references: [reply.messageId] } : {}),
    });
  } catch (e) {
    await prisma.campaignReply.update({ where: { id }, data: { respondedAt: null } });
    return NextResponse.json({ error: `Could not send: ${e instanceof Error ? e.message.slice(0, 160) : 'mail server refused it'}` }, { status: 502 });
  }
  await logAgent(user.userId, 'reply', `Sent your answer to ${reply.lead.business || reply.lead.name || reply.lead.email}`, undefined, reply.campaignId, reply.leadId);
  return NextResponse.json({ ok: true });
}

export const POST = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => handlePost(req, params.id));
