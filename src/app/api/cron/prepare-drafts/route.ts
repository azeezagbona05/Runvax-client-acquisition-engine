import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { checkAndIncrementAIForUser } from '@/lib/usage';
import { composeOutreach } from '@/lib/outreach/compose';
import { logAgentActivity } from '@/lib/agentActivity';
import type { Business } from '@/types';

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
    include: { user: { select: { id: true, plan: true } } },
    orderBy: { savedAt: 'asc' },
    take: BATCH,
  });

  let drafted = 0;
  let skipped = 0;

  for (const prospect of prospects) {
    try {
      const usage = await checkAndIncrementAIForUser(prospect.user.id, prospect.user.plan);
      if (!usage.ok) { skipped++; continue; }

      const business = prospect.businessData as unknown as Business;
      const result = await composeOutreach({ business, userId: prospect.user.id });

      await prisma.outreachDraft.create({
        data: {
          userId: prospect.user.id,
          prospectId: prospect.id,
          channel: 'whatsapp',
          whatsapp: result.whatsapp,
          emailSubject: result.emailSubject,
          emailBody: result.emailBody,
          framework: result.framework,
          opportunityTitle: result.opportunity?.title,
          opportunityReason: result.opportunity?.reason,
          status: 'pending',
        },
      });

      await logAgentActivity({
        userId: prospect.user.id,
        agentKey: 'outreach',
        action: 'draft_prepared',
        title: `Prepared a message for ${prospect.businessName}`,
      });

      drafted++;
    } catch (err) {
      console.error('[/api/cron/prepare-drafts] prospect failed', prospect.id, err);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, scanned: prospects.length, drafted, skipped });
}
