import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const logs = await prisma.dailyLog.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 30,
  });

  return NextResponse.json(logs.map((l) => ({ date: l.date, count: l.count })));
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = todayStr();

  const log = await prisma.dailyLog.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: { userId: session.user.id, date, count: 1 },
    update: { count: { increment: 1 } },
  });

  return NextResponse.json({ date: log.date, count: log.count });
}
