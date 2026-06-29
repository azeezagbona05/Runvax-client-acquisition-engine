import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { prisma } from './prisma';
import { getPlanConfig } from './plans';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

interface UsageCheckResult {
  ok: boolean;
  error?: NextResponse;
  userId?: string;
  plan?: string;
  remaining?: number;
}

export async function checkAndIncrementAI(): Promise<UsageCheckResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userId = session.user.id;
  const userPlan = (session.user as { plan?: string }).plan ?? 'free';
  const planConfig = await getPlanConfig(userPlan);
  const date = todayStr();

  if (planConfig.aiCallsPerDay === Infinity) {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, aiCalls: 1 },
      update: { aiCalls: { increment: 1 } },
    });
    return { ok: true, userId, plan: userPlan };
  }

  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date } },
  });

  const used = record?.aiCalls ?? 0;

  if (used >= planConfig.aiCallsPerDay) {
    return {
      ok: false,
      error: NextResponse.json({
        error: 'Daily AI limit reached',
        code: 'LIMIT_REACHED',
        plan: userPlan,
        used,
        limit: planConfig.aiCallsPerDay,
      }, { status: 402 }),
    };
  }

  await prisma.usageRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, aiCalls: 1 },
    update: { aiCalls: { increment: 1 } },
  });

  return {
    ok: true,
    userId,
    plan: userPlan,
    remaining: planConfig.aiCallsPerDay - used - 1,
  };
}

export async function getUsageToday(userId: string): Promise<number> {
  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date: todayStr() } },
  });
  return record?.aiCalls ?? 0;
}

export interface SearchCheckResult {
  ok: boolean;
  error?: NextResponse;
  userId?: string;
  plan?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  resultsPerSearch?: number;
}

export async function checkAndIncrementSearch(): Promise<SearchCheckResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userId = session.user.id;
  const userPlan = (session.user as { plan?: string }).plan ?? 'free';
  const planConfig = await getPlanConfig(userPlan);
  const date = todayStr();

  if (planConfig.searchesPerDay === Infinity) {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, searchCount: 1 },
      update: { searchCount: { increment: 1 } },
    });
    return { ok: true, userId, plan: userPlan, resultsPerSearch: planConfig.resultsPerSearch };
  }

  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date } },
  });

  const used = record?.searchCount ?? 0;

  if (used >= planConfig.searchesPerDay) {
    return {
      ok: false,
      error: NextResponse.json({
        error: `Daily search limit reached. Upgrade for more searches.`,
        code: 'SEARCH_LIMIT',
        plan: userPlan,
        used,
        limit: planConfig.searchesPerDay,
      }, { status: 402 }),
    };
  }

  await prisma.usageRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, searchCount: 1 },
    update: { searchCount: { increment: 1 } },
  });

  return {
    ok: true,
    userId,
    plan: userPlan,
    used: used + 1,
    limit: planConfig.searchesPerDay,
    remaining: planConfig.searchesPerDay - used - 1,
    resultsPerSearch: planConfig.resultsPerSearch,
  };
}
