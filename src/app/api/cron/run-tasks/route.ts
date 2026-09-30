import { NextRequest, NextResponse } from 'next/server';
import { guardCron } from '@/lib/cron';
import { drainTasks } from '@/lib/tasks/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Drains the agent task queue. Safe to call as often as the platform allows —
// claims are atomic, so overlapping runs never double-process a task.
export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await drainTasks(15);
  return NextResponse.json({ ok: true, ...result });
}
