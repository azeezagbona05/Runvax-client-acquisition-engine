import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(settings ?? { dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { dailyGoal?: number; avgDealValue?: number; closeRatePct?: number };

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      dailyGoal: body.dailyGoal ?? 10,
      avgDealValue: body.avgDealValue ?? 300000,
      closeRatePct: body.closeRatePct ?? 10,
    },
    update: {
      ...(body.dailyGoal != null && { dailyGoal: body.dailyGoal }),
      ...(body.avgDealValue != null && { avgDealValue: body.avgDealValue }),
      ...(body.closeRatePct != null && { closeRatePct: body.closeRatePct }),
    },
  });

  return NextResponse.json(settings);
}
