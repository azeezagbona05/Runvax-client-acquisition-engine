import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';
import { getUsageToday } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const userPlan = (session.user as { plan?: string }).plan ?? 'free';

  const [planConfig, savedCount, aiUsedToday] = await Promise.all([
    getPlanConfig(userPlan),
    prisma.prospect.count({ where: { userId } }),
    getUsageToday(userId),
  ]);

  return NextResponse.json({
    plan: userPlan,
    features: planConfig.features,
    planConfig: {
      name: planConfig.name,
      aiCallsPerDay: planConfig.aiCallsPerDay === Infinity ? null : planConfig.aiCallsPerDay,
      maxProspects: planConfig.maxProspects === Infinity ? null : planConfig.maxProspects,
    },
    usage: {
      aiUsedToday,
      aiRemainingToday: planConfig.aiCallsPerDay === Infinity
        ? null
        : Math.max(0, planConfig.aiCallsPerDay - aiUsedToday),
      savedProspects: savedCount,
    },
  });
}
