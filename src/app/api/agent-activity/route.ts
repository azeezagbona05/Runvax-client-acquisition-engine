import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { AgentKey } from '@/lib/agentActivity';

export const dynamic = 'force-dynamic';

const AGENT_KEYS: AgentKey[] = ['research', 'outreach', 'seo', 'support', 'atlas', 'billing'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 30;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activities, weeklyGrouped] = await Promise.all([
    prisma.agentActivity.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, agentKey: true, action: true, title: true, detail: true, createdAt: true },
    }),
    prisma.agentActivity.groupBy({
      by: ['agentKey'],
      where: { userId: session.user.id, createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  const weekly: Record<AgentKey, number> = { research: 0, outreach: 0, seo: 0, support: 0, atlas: 0, billing: 0 };
  for (const row of weeklyGrouped) {
    if (AGENT_KEYS.includes(row.agentKey as AgentKey)) {
      weekly[row.agentKey as AgentKey] = row._count._all;
    }
  }

  return NextResponse.json({ activities, weekly });
}
