import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [users, payments] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, plan: true, createdAt: true,
        emailVerified: true, planExpiresAt: true,
        _count: { select: { prospects: true } },
      },
    }),
    prisma.payment.findMany({
      orderBy: { paidAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const byPlan = users.reduce((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ users, payments, totalRevenue, byPlan });
}
