import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { addLeads } from '@/lib/outreachLeads';
import { DEFAULT_DAILY_CAP, validateCampaignFields } from '@/lib/outreachCampaign';
import { sanitizeAutomation, toCampaignFields, validateAutomation } from '@/lib/automation';
import { RESCHEDULE_TEMPLATE_ID, OFFICIAL_TEMPLATES } from '@/lib/templateLibrary';
import { briefFromTemplate, planFromTemplate } from '@/lib/templateEngine';

export const dynamic = 'force-dynamic';

const MAX_CAMPAIGNS = 50;

/**
 * POST { leadIds: string[] }: a DRAFT campaign (review mode, nothing sent) that invites the people who missed a booked appointment to choose a
 * new time. Only contacts recorded as "missed", who have not opted out, are included. The user reviews it and sends it from Campaigns.
 */
export const POST = (req: NextRequest) => guardInstalled(async () => {
  const user = await requireCampaignUser(req); if (!user.ok) return user.response;
  const b = await req.json().catch(() => ({})) as { leadIds?: unknown };
  const ids = Array.isArray(b.leadIds) ? b.leadIds.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one missed appointment.' }, { status: 400 });

  const leads = await prisma.outreachLead.findMany({
    where: { id: { in: ids }, userId: user.userId, unsubscribedAt: null, status: { not: 'unsubscribed' }, appointment: { is: { outcome: 'missed' } } },
    select: { email: true, name: true, business: true, website: true },
  });
  if (!leads.length) return NextResponse.json({ error: 'None of those contacts can be included. They must be marked missed and must not have opted out.' }, { status: 400 });
  if (await prisma.outreachCampaign.count({ where: { userId: user.userId } }) >= MAX_CAMPAIGNS) return NextResponse.json({ error: `You have ${MAX_CAMPAIGNS} campaigns already. Delete an old one first.` }, { status: 400 });

  const t = OFFICIAL_TEMPLATES.find((x) => x.id === RESCHEDULE_TEMPLATE_ID)!;
  const automation = sanitizeAutomation(planFromTemplate(t, { ...briefFromTemplate(t), name: `Reschedule missed appointments, ${new Date().toISOString().slice(0, 10)}` }, '3 emails, 3 days apart'));
  const issues = automation ? validateAutomation(automation) : ['No usable email.'];
  if (!automation || issues.length) return NextResponse.json({ error: issues[0] }, { status: 500 });
  const v = validateCampaignFields({ ...toCampaignFields(automation), name: automation.name });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 500 });
  const d = v.data;
  const campaign = await prisma.outreachCampaign.create({
    data: { userId: user.userId, name: d.name!, subject: d.subject!, body: d.body!, followUpSubject: d.followUpSubject ?? null, followUpBody: d.followUpBody ?? null, followUpAfterDays: d.followUpAfterDays ?? 3, maxFollowUps: d.maxFollowUps ?? 1, dailyCap: d.dailyCap ?? DEFAULT_DAILY_CAP, automation: automation as unknown as object },
  });
  const added = await addLeads(campaign.id, user.userId, leads);
  return NextResponse.json({ id: campaign.id, name: campaign.name, added: added.added, skipped: ids.length - leads.length }, { status: 201 });
});
