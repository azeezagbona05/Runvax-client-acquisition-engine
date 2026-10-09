import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;

// Cross-account platform operations: agent runs, failures, pipeline throughput,
// campaigns and SEO/GEO activity. Admin only — customers never reach this.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const since = new Date(Date.now() - 7 * DAY);

  const [taskStatus, taskTypes, failed, activityByAgent, drafts, sent, campaigns, seoRuns, lastSeo] = await Promise.all([
    prisma.agentTask.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.agentTask.groupBy({ by: ['type', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.agentTask.findMany({
      where: { status: 'failed', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, type: true, attempts: true, maxAttempts: true, error: true, createdAt: true, user: { select: { email: true } } },
    }),
    prisma.agentActivity.groupBy({ by: ['agentKey'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.outreachDraft.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.conversation.count({ where: { type: 'sent', createdAt: { gte: since } } }),
    prisma.campaign.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalImported: true } }),
    prisma.agentActivity.count({ where: { agentKey: 'seo', createdAt: { gte: since } } }),
    prisma.agentActivity.findFirst({ where: { agentKey: 'seo' }, orderBy: { createdAt: 'desc' }, select: { title: true, createdAt: true } }),
  ]);

  const toMap = <T extends { _count: { _all: number } }>(rows: T[], key: (r: T) => string) => {
    const out: Record<string, number> = {};
    for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + r._count._all;
    return out;
  };

  return NextResponse.json({
    windowDays: 7,
    tasks: toMap(taskStatus, (r) => r.status),
    tasksByType: toMap(taskTypes, (r) => `${r.type}:${r.status}`),
    failed,
    activityByAgent: toMap(activityByAgent, (r) => r.agentKey),
    drafts: toMap(drafts, (r) => r.status),
    messagesSent: sent,
    campaigns: campaigns.map((c) => ({ status: c.status, count: c._count._all, imported: c._sum.totalImported ?? 0 })),
    seo: { runs: seoRuns, last: lastSeo },
  });
}
