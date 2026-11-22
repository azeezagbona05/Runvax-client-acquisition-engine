import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { computeResults } from '@/lib/acqResults';

export const dynamic = 'force-dynamic';

/** GET — funnel, per-campaign results and revenue across the account's campaigns. Revenue is only what is recorded on contacts marked "customer". */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const [campaigns, leads] = await Promise.all([
    prisma.outreachCampaign.findMany({ where: { userId: user.userId }, select: { id: true, name: true, status: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.outreachLead.findMany({
      where: { userId: user.userId }, orderBy: { createdAt: 'desc' }, take: 20_000,
      select: { campaignId: true, status: true, sentAt: true, openedAt: true, repliedAt: true, outcome: true, stage: true, demoAt: true, closedAt: true, dealValue: true },
    }),
  ]);
  return NextResponse.json(computeResults(leads, campaigns));
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
