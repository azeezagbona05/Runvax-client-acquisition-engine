import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { sendBatch } from '@/lib/outreachSender';
import { autoFollowUpsOn } from '@/lib/automation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily tick, always inside each campaign's own sending window (hours, weekdays, time zone):
//  - continues campaigns the user has already started (pressed Run) until each reaches its daily limit;
//  - sends follow-ups ONLY for campaigns whose owner switched on automatic follow-ups on the campaign page.
// It never starts a campaign. Follow-ups go first because they are time-sensitive; both share the daily limit.
// Stops before the serverless time limit.
const BUDGET_MS = 45_000;
const PER_CAMPAIGN = 20;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const started = Date.now();
  const campaigns = await prisma.outreachCampaign.findMany({
    // A finished campaign (everyone has had email 1) can still owe follow-ups, so 'completed' is included.
    where: { status: { in: ['running', 'completed'] }, startedAt: { not: null }, user: { isSuspended: false, emailVerified: { not: null }, plan: { in: ['pro', 'agency'] } } },
    orderBy: { updatedAt: 'asc' },
    select: { id: true, userId: true, status: true, automation: true },
    take: 60,
  });

  let sent = 0, failed = 0, followUps = 0, ran = 0, outsideWindow = 0;
  for (const c of campaigns) {
    if (Date.now() - started > BUDGET_MS) break;
    const auto = autoFollowUpsOn(c.automation);
    if (c.status !== 'running' && !auto) continue;
    try {
      if (auto) {
        const f = await sendBatch({ campaignId: c.id, userId: c.userId, kind: 'followup', max: PER_CAMPAIGN, respectWindow: true });
        if (f.aborted === 'outside_window') { outsideWindow++; continue; }
        followUps += f.sent; failed += f.failed;
      }
      if (c.status === 'running') {
        const r = await sendBatch({ campaignId: c.id, userId: c.userId, kind: 'initial', max: PER_CAMPAIGN, respectWindow: true });
        if (r.aborted === 'outside_window') { outsideWindow++; continue; }
        sent += r.sent; failed += r.failed;
      }
      ran++;
    } catch (e) {
      console.error('[cron/run-outreach-campaigns]', c.id, e);
    }
  }
  return NextResponse.json({ campaigns: campaigns.length, ran, outsideWindow, sent, followUps, failed });
}
