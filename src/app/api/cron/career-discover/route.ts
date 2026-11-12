import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { runDiscovery } from '@/lib/career/jobs/discover';
import { autoSubmitFor } from '@/lib/career/submit/queue';
import { sanitizeDiscovery } from '@/lib/career/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Daily tick: every deployed Career Agent whose search is due (daily, or weekly after 7 days) looks for new jobs. Searching only; nothing is ever applied to here.
export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const active = await prisma.careerPreference.findMany({ where: { status: 'active', user: { isSuspended: false } }, select: { userId: true, discovery: true }, orderBy: { updatedAt: 'asc' }, take: 200 });
  let ran = 0, failed = 0;
  for (const a of active) {
    if (ran >= 25) break;
    const gapDays = sanitizeDiscovery(a.discovery).frequency === 'weekly' ? 6.5 : 0.9;
    const last = await prisma.careerAgentEvent.findFirst({ where: { userId: a.userId, action: 'discovery_run' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    if (last && Date.now() - last.createdAt.getTime() < gapDays * 86_400_000) continue;
    try { await runDiscovery(a.userId); await autoSubmitFor(a.userId).catch((e) => console.error('[career-auto]', a.userId, e instanceof Error ? e.message : e)); ran++; } catch (e) { failed++; console.error('[career-discover]', a.userId, e instanceof Error ? e.message : e); }
  }
  return NextResponse.json({ deployed: active.length, ran, failed });
}
