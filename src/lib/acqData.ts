import { prisma } from '@/lib/prisma';
import { followRule } from '@/lib/automation';
import type { OvCampaign, OvLead } from '@/lib/acqOverview';

/** Past this many leads the dashboard stops reading older ones; a single account rarely gets close. */
const MAX_LEADS = 20_000;

export async function loadAcqData(userId: string): Promise<{ campaigns: Array<OvCampaign & { followUpAfterDays: number; maxFollowUps: number; waits?: number[] }>; leads: OvLead[] }> {
  const [campaigns, leads] = await Promise.all([
    prisma.outreachCampaign.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, name: true, status: true, dailyCap: true, startedAt: true, createdAt: true, followUpAfterDays: true, maxFollowUps: true, automation: true },
    }),
    prisma.outreachLead.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: MAX_LEADS,
      select: {
        id: true, campaignId: true, email: true, name: true, business: true, website: true, status: true,
        sentAt: true, lastSentAt: true, openedAt: true, openCount: true, clickedAt: true, repliedAt: true, outcome: true,
        unsubscribedAt: true, followUpsSent: true, createdAt: true, stage: true, pausedUntil: true, replyClass: true,
      },
    }),
  ]);
  return { campaigns: campaigns.map(({ automation, ...c }) => ({ ...c, ...followRule({ ...c, automation }) })), leads };
}
