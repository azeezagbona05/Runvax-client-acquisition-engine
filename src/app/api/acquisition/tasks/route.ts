import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;

  const tasks = await prisma.acquisitionTask.findMany({
    where: { userId: access.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, type: true, status: true, acqProspectId: true, attempts: true, maxAttempts: true,
      scheduledAt: true, completedAt: true, error: true, createdAt: true,
    },
  });
  return NextResponse.json({ tasks });
}

// Manual "run now" for the admin, bounded by the same budget as the cron.
export async function POST(req: NextRequest) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as { budget?: unknown };
  const budget = typeof body.budget === 'number' ? body.budget : undefined;
  const result = await drainAcqTasks({ budget });
  return NextResponse.json({ ok: true, ...result });
}
