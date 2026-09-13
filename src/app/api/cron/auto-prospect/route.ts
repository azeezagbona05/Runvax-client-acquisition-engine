import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { checkAndIncrementSearchForUser } from '@/lib/usage';
import { runAutoProspectSearch } from '@/lib/autoProspect';
import { logAgentActivity } from '@/lib/agentActivity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Ava (research agent) working while nobody's watching: once a day, scans for
// new prospects on behalf of every paid user who opted in via Settings.
// Called by Vercel Cron daily at 6am WAT (5am UTC).
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/auto-prospect", "schedule": "0 5 * * *" }] }

// Paid-plan gate + batch cap bound the external Google Places spend this
// autonomous job can incur in one run.
const BATCH = 25;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settingsRows = await prisma.userSettings.findMany({
    where: {
      autoProspectEnabled: true,
      user: { isSuspended: false, plan: { in: ['pro', 'agency'] } },
    },
    include: { user: { select: { id: true, plan: true } } },
    take: BATCH,
  });

  let scanned = 0;
  let foundTotal = 0;
  let skipped = 0;

  for (const settings of settingsRows) {
    const { user, autoProspectIndustry, autoProspectLocation, autoProspectMinRating, autoProspectNoWebsiteOnly } = settings;
    if (!autoProspectIndustry?.trim() || !autoProspectLocation?.trim()) { skipped++; continue; }

    try {
      const usage = await checkAndIncrementSearchForUser(user.id, user.plan);
      if (!usage.ok) { skipped++; continue; }

      const { found } = await runAutoProspectSearch({
        userId: user.id,
        industry: autoProspectIndustry,
        location: autoProspectLocation,
        minRating: autoProspectMinRating,
        noWebsiteOnly: autoProspectNoWebsiteOnly,
      });

      scanned++;
      foundTotal += found;

      if (found > 0) {
        await logAgentActivity({
          userId: user.id,
          agentKey: 'research',
          action: 'auto_scan_completed',
          title: `Scanned ${autoProspectLocation} for ${autoProspectIndustry} — found ${found} new prospect${found === 1 ? '' : 's'}`,
        });
      }
    } catch (err) {
      console.error('[/api/cron/auto-prospect] user scan failed', user.id, err);
    }
  }

  return NextResponse.json({ ok: true, users: settingsRows.length, scanned, skipped, foundTotal });
}
