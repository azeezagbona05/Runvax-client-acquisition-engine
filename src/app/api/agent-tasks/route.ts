import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// The signed-in user's slice of the agent hand-off queue: status counts for
// the last 7 days plus the most recent tasks, each labelled with its prospect.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [grouped, tasks] = await Promise.all([
    prisma.agentTask.groupBy({ by: ['status'], where: { userId, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.agentTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, type: true, status: true, prospectId: true, attempts: true, error: true, createdAt: true, completedAt: true, output: true },
    }),
  ]);

  const ids = Array.from(new Set(tasks.map((t) => t.prospectId).filter((v): v is string => !!v)));
  const prospects = ids.length
    ? await prisma.prospect.findMany({ where: { userId, id: { in: ids } }, select: { id: true, businessName: true } })
    : [];
  const names = new Map(prospects.map((p) => [p.id, p.businessName]));

  const counts: Record<string, number> = { pending: 0, running: 0, completed: 0, skipped: 0, failed: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;

  return NextResponse.json({
    counts,
    tasks: tasks.map((t) => ({ ...t, businessName: t.prospectId ? names.get(t.prospectId) ?? null : null })),
  });
}
