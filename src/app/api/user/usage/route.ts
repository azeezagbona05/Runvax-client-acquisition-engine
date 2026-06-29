import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';

export const dynamic = 'force-dynamic';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Read-only snapshot of today's quota usage. Does NOT increment.
export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const plan = (token?.plan as string) ?? 'free';
  const cfg = await getPlanConfig(plan);

  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date: todayStr() } },
  });

  const searchesUsed = record?.searchCount ?? 0;
  const aiUsed = record?.aiCalls ?? 0;

  const searchesLimit = cfg.searchesPerDay === Infinity ? null : cfg.searchesPerDay;
  const aiLimit = cfg.aiCallsPerDay === Infinity ? null : cfg.aiCallsPerDay;

  return NextResponse.json({
    plan,
    searchesUsed,
    searchesLimit,
    searchesRemaining: searchesLimit === null ? null : Math.max(0, searchesLimit - searchesUsed),
    aiUsed,
    aiLimit,
    aiRemaining: aiLimit === null ? null : Math.max(0, aiLimit - aiUsed),
  });
}
