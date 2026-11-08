import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { runVisibilityAgent } from '@/lib/agents/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Daily tick: every ACTIVE visibility agent whose next run is due writes its articles. Paid plans (and trials) only, suspended users never.
export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const due = await prisma.customAgent.findMany({ where: { kind: 'visibility', status: 'active', nextRunAt: { lte: new Date() }, user: { isSuspended: false, plan: { in: ['pro', 'agency'] } } }, include: { user: { select: { id: true, plan: true } } }, orderBy: { nextRunAt: 'asc' }, take: 10 });
  let written = 0, failed = 0;
  for (const a of due) {
    try { written += (await runVisibilityAgent(a, a.user)).created.length; } catch (e) { failed++; console.error('[run-agents]', a.id, e instanceof Error ? e.message : e); }
  }
  return NextResponse.json({ agents: due.length, written, failed });
}
