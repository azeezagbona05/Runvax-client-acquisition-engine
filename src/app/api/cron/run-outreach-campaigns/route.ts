import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { sendBatch } from '@/lib/outreachSender';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily tick: continues campaigns the user has already started (pressed Run) until each
// reaches its daily limit. It never starts a campaign, never sends follow-ups (those are
// always the user's click), and stops before the serverless time limit.
const BUDGET_MS = 45_000;
const PER_CAMPAIGN = 20;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const started = Date.now();
  const campaigns = await prisma.outreachCampaign.findMany({
    where: { status: 'running', user: { isSuspended: false, emailVerified: { not: null }, plan: { in: ['pro', 'agency'] } } },
    orderBy: { updatedAt: 'asc' },
    select: { id: true, userId: true },
    take: 25,
  });

  let sent = 0, failed = 0, ran = 0;
  for (const c of campaigns) {
    if (Date.now() - started > BUDGET_MS) break;
    try {
      const r = await sendBatch({ campaignId: c.id, userId: c.userId, kind: 'initial', max: PER_CAMPAIGN });
      sent += r.sent; failed += r.failed; ran++;
    } catch (e) {
      console.error('[cron/run-outreach-campaigns]', c.id, e);
    }
  }
  return NextResponse.json({ campaigns: campaigns.length, ran, sent, failed });
}
