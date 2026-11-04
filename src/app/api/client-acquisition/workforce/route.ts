import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { summariseWorkforce } from '@/lib/workforce';

export const dynamic = 'force-dynamic';

/** GET — the six agents with what each last did, plus the shared log they all write to. Real rows only. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const rows = await prisma.campaignLog.findMany({
    where: { userId: user.userId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: { createdAt: 'desc' }, take: 500,
    select: { id: true, agent: true, action: true, detail: true, createdAt: true, campaignId: true },
  });
  return NextResponse.json({
    agents: summariseWorkforce(rows),
    log: rows.slice(0, 60).map((r) => ({ id: r.id, agent: r.agent, action: r.action, detail: r.detail, at: r.createdAt.toISOString(), campaignId: r.campaignId })),
  });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
