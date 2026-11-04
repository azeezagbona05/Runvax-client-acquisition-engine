import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadMailbox } from '@/lib/outreachSender';
import { followRule } from '@/lib/automation';
import { cleanEmail, needsFollowUp, stageOf, statsOf, validateCampaignFields } from '@/lib/outreachCampaign';
import { sanitizeAutomation, toCampaignFields, validateAutomation } from '@/lib/automation';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** GET — one campaign with every lead, its stage, and the dashboard numbers. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const campaign = await prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [leads, mailbox] = await Promise.all([
    prisma.outreachLead.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ createdAt: 'asc' }, { email: 'asc' }],
      // The token is the secret behind the open pixel and unsubscribe link, so it stays server-side.
      select: {
        id: true, email: true, name: true, business: true, website: true, status: true, sentAt: true, lastSentAt: true,
        followUpsSent: true, customBody: true, openedAt: true, openCount: true, clickedAt: true, clickCount: true, repliedAt: true, outcome: true, unsubscribedAt: true, error: true, stage: true, pausedUntil: true, replyClass: true, demoAt: true, dealValue: true,
      },
    }),
    loadMailbox(user.userId),
  ]);
  const now = Date.now();
  const rule = { ...campaign, ...followRule(campaign) };
  return NextResponse.json({
    mailboxReady: !!mailbox,
    campaign,
    stats: statsOf(leads, rule, now),
    personalised: leads.filter((l) => l.status === 'queued' && l.customBody).length,
    leads: leads.map(({ customBody, stage: pipelineStage, ...l }) => ({ ...l, pipelineStage, personalised: !!customBody, stage: stageOf({ ...l, stage: pipelineStage }, rule, now), followUpDue: needsFollowUp({ ...l, stage: pipelineStage }, rule, now) })),
  });
}

/**
 * PATCH — edit the wording and limits, start or pause the campaign, or record replies.
 * Body: any editable field, plus { action: 'run' | 'pause' } or { repliedEmails: string[] }.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const campaign = await prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  // An automation plan from the builder: saved whole, and the part the engine runs is copied into the campaign fields.
  let automation: ReturnType<typeof sanitizeAutomation> = null;
  if (body.automation !== undefined) {
    automation = sanitizeAutomation(body.automation);
    const issues = automation ? validateAutomation(automation) : ['The automation has no usable email.'];
    if (!automation || issues.length) return NextResponse.json({ error: issues[0] }, { status: 400 });
    Object.assign(body, toCampaignFields(automation));
  }

  const v = validateCampaignFields(body, true);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  let replied = 0;
  if (Array.isArray(body.repliedEmails)) {
    const emails = body.repliedEmails.filter((e): e is string => typeof e === 'string').map(cleanEmail).slice(0, 2000);
    if (emails.length) {
      const res = await prisma.outreachLead.updateMany({
        where: { campaignId: campaign.id, email: { in: emails }, sentAt: { not: null }, repliedAt: null },
        data: { repliedAt: new Date() },
      });
      replied = res.count;
    }
  }

  const data: Record<string, unknown> = { ...v.data };
  if (automation) data.automation = automation as unknown as object;
  if (body.action === 'run') {
    if (!(await loadMailbox(user.userId))) {
      return NextResponse.json({ error: 'Connect your own email in Settings → Email first. Campaigns send from your mailbox so replies reach you.', code: 'NO_MAILBOX' }, { status: 400 });
    }
    const queued = await prisma.outreachLead.count({ where: { campaignId: campaign.id, status: 'queued' } });
    if (queued === 0) return NextResponse.json({ error: 'There is nobody left to send to. Upload some leads first.' }, { status: 400 });
    data.status = 'running';
    data.startedAt = campaign.startedAt ?? new Date();
  } else if (body.action === 'pause') {
    data.status = 'paused';
  } else if (body.action !== undefined) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const updated = Object.keys(data).length
    ? await prisma.outreachCampaign.update({ where: { id: campaign.id }, data })
    : campaign;
  return NextResponse.json({ campaign: updated, replied });
}

/** DELETE — removes the campaign and its history. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const res = await prisma.outreachCampaign.deleteMany({ where: { id: params.id, userId: user.userId } });
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
