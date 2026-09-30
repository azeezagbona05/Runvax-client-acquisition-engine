import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { checkAndIncrementSearchForUser } from '@/lib/usage';
import { runAutoProspectSearch } from '@/lib/autoProspect';
import { enqueueTask, drainTasks } from '@/lib/tasks/queue';
import { logAgentActivity } from '@/lib/agentActivity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily campaign tick: for each active campaign, import prospects up to the
// remaining daily cap and hand every new one to the agent task queue
// (detect_opportunity → draft_outreach). Paid plans only — same gate as the
// other autonomous jobs, to bound Google Places spend.
const BATCH = 20;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { status: 'active', user: { isSuspended: false, plan: { in: ['pro', 'agency'] } } },
    include: { user: { select: { id: true, plan: true } } },
    orderBy: { lastRunAt: 'asc' },
    take: BATCH,
  });

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  let imported = 0;
  let queued = 0;
  let deferred = 0;

  for (const c of campaigns) {
    try {
      const today = await prisma.prospect.count({ where: { campaignId: c.id, savedAt: { gte: startOfDay } } });
      const remaining = c.dailyCap - today;
      if (remaining <= 0) { deferred++; continue; }

      const usage = await checkAndIncrementSearchForUser(c.user.id, c.user.plan);
      if (!usage.ok) { deferred++; continue; }

      const { found, prospectIds } = await runAutoProspectSearch({
        userId: c.user.id,
        industry: c.industry,
        location: c.location,
        minRating: c.minRating,
        noWebsiteOnly: c.noWebsiteOnly,
        campaignId: c.id,
        limit: remaining,
      });

      for (const prospectId of prospectIds) {
        if (await enqueueTask({ userId: c.user.id, type: 'detect_opportunity', prospectId })) queued++;
      }

      await prisma.campaign.update({
        where: { id: c.id },
        data: { lastRunAt: new Date(), totalImported: { increment: found } },
      });
      imported += found;

      if (found > 0) {
        await logAgentActivity({
          userId: c.user.id,
          agentKey: 'research',
          action: 'campaign_imported',
          title: `Campaign "${c.name}" imported ${found} new prospect${found === 1 ? '' : 's'}`,
        });
      }
    } catch (err) {
      console.error('[/api/cron/run-campaigns] campaign failed', c.id, err);
    }
  }

  const run = await drainTasks(15);
  return NextResponse.json({ ok: true, campaigns: campaigns.length, imported, queued, deferred, ...run });
}
