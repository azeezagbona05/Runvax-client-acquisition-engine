import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { enqueueTask, drainTasks } from '@/lib/tasks/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Rex (outreach agent) working while nobody's watching: once a day, drafts a
// ready-to-send message for prospects that have never been reached — but
// never sends. A human always reviews and clicks send from the Command Centre.
// Called by Vercel Cron daily at 7am WAT (6am UTC).
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/prepare-drafts", "schedule": "0 6 * * *" }] }

const BATCH = 20;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prospects = await prisma.prospect.findMany({
    where: {
      stage: 'found',
      outreachSentAt: null,
      // Opt-in only — never touches a user's prospects or AI quota unless
      // they've explicitly turned this on in Settings.
      user: { isSuspended: false, plan: { in: ['pro', 'agency'] }, settings: { autoDraftEnabled: true } },
      outreachDrafts: { none: { status: 'pending' } },
    },
    include: { user: { select: { id: true } } },
    orderBy: { savedAt: 'asc' },
    take: BATCH,
  });

  // Hand-off, not inline work: queue one detect_opportunity task per prospect
  // and let the runner carry each through detect → draft with retries.
  let queued = 0;
  for (const prospect of prospects) {
    const id = await enqueueTask({ userId: prospect.user.id, type: 'detect_opportunity', prospectId: prospect.id });
    if (id) queued++;
  }

  const run = await drainTasks(BATCH);

  return NextResponse.json({ ok: true, scanned: prospects.length, queued, ...run });
}
