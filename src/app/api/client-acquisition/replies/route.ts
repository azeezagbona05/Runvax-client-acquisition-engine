import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { ingestReply } from '@/lib/acqReplies';
import { notifyOwnerOfReply } from '@/lib/acqNotify';
import { acquisitionStage } from '@/lib/replyIntel';

export const dynamic = 'force-dynamic';

/** GET — real replies with the contact, campaign, current pipeline stage and the suggested answer. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const rows = await prisma.campaignReply.findMany({
    where: { userId: user.userId }, orderBy: { receivedAt: 'desc' }, take: 200,
    include: { lead: true, campaign: { select: { name: true } } },
  });
  return NextResponse.json({
    replies: rows.map((r) => ({
      id: r.id, campaignId: r.campaignId, campaignName: r.campaign.name, leadId: r.leadId,
      email: r.fromEmail, name: r.lead.name, business: r.lead.business,
      subject: r.subject, text: r.text, receivedAt: r.receivedAt.toISOString(), source: r.source,
      replyClass: r.replyClass, confidence: r.confidence, classifiedBy: r.classifiedBy,
      suggestion: r.suggestion, suggestionBy: r.suggestionBy, respondedAt: r.respondedAt?.toISOString() ?? null,
      stage: acquisitionStage({ replyClass: r.lead.replyClass, sentAt: r.lead.sentAt, openedAt: r.lead.openedAt, clickedAt: r.lead.clickedAt, repliedAt: r.lead.repliedAt, outcome: r.lead.outcome, stage: r.lead.stage }).stage,
      demoAt: r.lead.demoAt?.toISOString() ?? null, dealValue: r.lead.dealValue,
    })),
  });
}

/** POST { leadId, text, subject? } — the user pastes a reply they received (for mailboxes RUNVAX can't read). */
async function handlePost(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-reply:${user.userId}`, { maxRequests: 60, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const b = await req.json().catch(() => null) as { leadId?: unknown; text?: unknown; subject?: unknown } | null;
  if (!b || typeof b.leadId !== 'string' || typeof b.text !== 'string') return NextResponse.json({ error: 'Choose the contact and paste their reply.' }, { status: 400 });
  const r = await ingestReply({ userId: user.userId, leadId: b.leadId, text: b.text, subject: typeof b.subject === 'string' ? b.subject : '', source: 'manual' }, { notifyOwner: notifyOwnerOfReply });
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
export const POST = (req: NextRequest) => guardInstalled(() => handlePost(req));
