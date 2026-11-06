import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignSender } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { logAgent } from '@/lib/acqReplies';
import { checkRecipient } from '@/lib/acquisition/recipientGuard';
import { bookMeeting, emitWebhook } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

/**
 * POST { start: ISO time, minutes?: number } — books the chosen time on the user's Google Calendar and invites the contact
 * (Google emails them the invite, so the same recipient check as sending email applies). The contact moves to "Demo booked"
 * and follow-ups to them stop.
 */
async function handlePost(req: NextRequest, id: string) {
  const user = await requireCampaignSender(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-book:${user.userId}`, { maxRequests: 20, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const b = await req.json().catch(() => null) as { start?: unknown; minutes?: unknown } | null;
  const start = typeof b?.start === 'string' ? b.start : '';
  const minutes = typeof b?.minutes === 'number' && b.minutes >= 15 && b.minutes <= 120 ? Math.round(b.minutes) : 30;
  if (!start || Number.isNaN(Date.parse(start))) return NextResponse.json({ error: 'Pick a time first.' }, { status: 400 });

  const reply = await prisma.campaignReply.findFirst({ where: { id, userId: user.userId }, include: { lead: { select: { id: true, email: true, name: true, business: true, unsubscribedAt: true, demoAt: true } } } });
  if (!reply) return NextResponse.json({ error: 'Reply not found.' }, { status: 404 });
  if (reply.lead.unsubscribedAt || reply.replyClass === 'unsubscribe' || reply.replyClass === 'not_interested') return NextResponse.json({ error: 'This contact does not want to be contacted, so no invite can be sent.' }, { status: 409 });
  if (reply.lead.demoAt && reply.lead.demoAt.getTime() > Date.now()) return NextResponse.json({ error: 'A meeting is already booked with this contact.' }, { status: 409 });

  const verdict = await checkRecipient(user.userId, { email: reply.lead.email });
  if (!verdict.allowed) return NextResponse.json({ error: verdict.message }, { status: verdict.code === 'check_unavailable' ? 503 : 409 });

  const label = reply.lead.business || reply.lead.name || reply.lead.email;
  const r = await bookMeeting(user.userId, { start, minutes, attendeeEmail: reply.lead.email, title: `Intro call: ${label}`, notes: `Booked from your RUNVAX reply with ${label}.` });
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: 422 });

  const when = new Date(start);
  await prisma.outreachLead.update({ where: { id: reply.lead.id }, data: { stage: 'demo_booked', demoAt: when, closedAt: null } });
  await logAgent(user.userId, 'reply', `Booked a meeting with ${label}`, `${when.toUTCString()}. Invite sent from your Google Calendar. Follow-ups have stopped.`, reply.campaignId, reply.lead.id);
  emitWebhook(user.userId, 'lead.interested', { event: 'meeting.booked', lead: { email: reply.lead.email, name: reply.lead.name, business: reply.lead.business }, start: when.toISOString() });
  return NextResponse.json({ ok: true, link: r.data?.link, meet: r.data?.meet });
}

export const POST = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => handlePost(req, params.id));
