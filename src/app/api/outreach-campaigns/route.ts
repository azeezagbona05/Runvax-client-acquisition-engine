import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { addLeads } from '@/lib/outreachLeads';
import { loadMailbox } from '@/lib/outreachSender';
import { statsOf, validateCampaignFields, DEFAULT_DAILY_CAP } from '@/lib/outreachCampaign';
import { sanitizeAutomation, toCampaignFields, validateAutomation } from '@/lib/automation';

export const dynamic = 'force-dynamic';

const MAX_CAMPAIGNS = 50;

/** GET — the user's campaigns with their dashboard numbers. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const [campaigns, leads, mailbox] = await Promise.all([
    prisma.outreachCampaign.findMany({ where: { userId: user.userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.outreachLead.findMany({
      where: { userId: user.userId },
      select: { campaignId: true, status: true, sentAt: true, lastSentAt: true, openedAt: true, clickedAt: true, repliedAt: true, outcome: true, unsubscribedAt: true, followUpsSent: true },
    }),
    loadMailbox(user.userId),
  ]);
  const byCampaign = new Map<string, typeof leads>();
  for (const l of leads) byCampaign.set(l.campaignId, [...(byCampaign.get(l.campaignId) ?? []), l]);

  return NextResponse.json({
    mailboxReady: !!mailbox,
    campaigns: campaigns.map((c) => ({
      id: c.id, name: c.name, status: c.status, dailyCap: c.dailyCap, createdAt: c.createdAt, startedAt: c.startedAt,
      stats: statsOf(byCampaign.get(c.id) ?? [], c),
    })),
  });
}

/** POST — create a campaign (as a draft), optionally with its first leads. */
export async function POST(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  let automation: ReturnType<typeof sanitizeAutomation> = null;
  if (body.automation !== undefined) {
    automation = sanitizeAutomation(body.automation);
    const issues = automation ? validateAutomation(automation) : ['The automation has no usable email.'];
    if (!automation || issues.length) return NextResponse.json({ error: issues[0] }, { status: 400 });
    Object.assign(body, toCampaignFields(automation));
    if (typeof body.name !== 'string' || !body.name.trim()) body.name = automation.name;
  }
  const v = validateCampaignFields(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  if (await prisma.outreachCampaign.count({ where: { userId: user.userId } }) >= MAX_CAMPAIGNS) {
    return NextResponse.json({ error: `You have ${MAX_CAMPAIGNS} campaigns already. Delete an old one first.` }, { status: 400 });
  }

  const d = v.data;
  const campaign = await prisma.outreachCampaign.create({
    data: {
      userId: user.userId, name: d.name!, subject: d.subject!, body: d.body!,
      followUpSubject: d.followUpSubject ?? null, followUpBody: d.followUpBody ?? null,
      followUpAfterDays: d.followUpAfterDays ?? 3, maxFollowUps: d.maxFollowUps ?? 1, dailyCap: d.dailyCap ?? DEFAULT_DAILY_CAP,
      ...(automation ? { automation: automation as unknown as object } : {}),
    },
  });
  const added = body.leads !== undefined ? await addLeads(campaign.id, user.userId, body.leads) : null;
  return NextResponse.json({ id: campaign.id, added }, { status: 201 });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
