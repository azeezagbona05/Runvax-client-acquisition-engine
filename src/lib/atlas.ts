import { notAcquisition } from '@/lib/acquisition/isolation';
import { prisma } from '@/lib/prisma';
import { checkAndIncrementAIForUser, checkAndIncrementSearchForUser } from '@/lib/usage';
import { composeOutreach } from '@/lib/outreach/compose';
import { runAutoProspectSearch } from '@/lib/autoProspect';
import { logAgentActivity } from '@/lib/agentActivity';
import type { Business } from '@/types';

export type AtlasRecommendationType = 'reactivate_cold_leads' | 'scan_more_prospects' | 'follow_up_interested';

export interface AtlasRecommendation {
  type: AtlasRecommendationType;
  label: string;
  detail: string;
  count: number;
  done: boolean;
}

export interface AtlasBriefData {
  summary: string;
  recommendations: AtlasRecommendation[];
}

const COLD_DAYS = 14;
const REACTIVATE_BATCH = 10;
const FOLLOWUP_STALE_DAYS = 5;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function coldLeadWhere(userId: string) {
  const cutoff = new Date(Date.now() - COLD_DAYS * 24 * 60 * 60 * 1000);
  return {
    userId,
    stage: { in: ['found', 'contacted'] as string[] },
    updatedAt: { lt: cutoff },
    reminderDate: null,
    // Industry Acquisition clinics are never "cold leads" for Rex to draft: they have their own gate.
    AND: [notAcquisition],
  };
}

/**
 * Prospects who showed interest (or got a proposal) and then went quiet —
 * distinct from coldLeadWhere, which only covers never-contacted/first-touch
 * prospects. A prospect with no logged Conversation at all is left alone:
 * that isn't "gone quiet," it's just missing a manual log entry.
 */
async function staleInterestedProspects(userId: string) {
  const cutoff = new Date(Date.now() - FOLLOWUP_STALE_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.prospect.findMany({
    where: {
      userId,
      stage: { in: ['interested', 'proposal'] },
      reminderDate: null,
      outreachDrafts: { none: { status: 'pending' } },
      AND: [notAcquisition],
    },
    include: { conversations: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'asc' },
    take: 50,
  });
  return candidates.filter((p) => p.conversations[0] && p.conversations[0].createdAt < cutoff);
}

/**
 * Pure, rule-based synthesis over data that already exists — no LLM call, so
 * viewing a brief costs nothing and never touches a user's AI-call quota.
 * Only the delegated actions below spend quota, and only on an explicit click.
 */
export async function buildBrief(userId: string): Promise<AtlasBriefData> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [settings, stageGroups, coldCount, pendingDrafts, dailyLog, queuedTasks, failedTasks] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.prospect.groupBy({ by: ['stage'], where: { userId }, _count: { _all: true } }),
    prisma.prospect.count({ where: coldLeadWhere(userId) }),
    prisma.outreachDraft.count({ where: { userId, status: 'pending' } }),
    prisma.dailyLog.findUnique({ where: { userId_date: { userId, date: todayStr() } } }),
    prisma.agentTask.count({ where: { userId, status: { in: ['pending', 'running'] } } }),
    prisma.agentTask.count({ where: { userId, status: 'failed', createdAt: { gte: weekAgo } } }),
  ]);

  const stages: Record<string, number> = {};
  for (const g of stageGroups) stages[g.stage] = g._count._all;
  const wonCount = stages.won ?? 0;
  const totalActive = (stages.found ?? 0) + (stages.contacted ?? 0) + (stages.interested ?? 0);
  const avgDealValue = settings?.avgDealValue ?? 300000;
  const dailyGoal = settings?.dailyGoal ?? 10;
  const wonValue = wonCount * avgDealValue;

  const lines: string[] = [];
  lines.push(
    `You have ${totalActive} active prospect${totalActive === 1 ? '' : 's'} in your pipeline`
    + (wonCount > 0 ? `, ${wonCount} won (~₦${wonValue.toLocaleString()} estimated).` : '.'),
  );

  if (coldCount > 0) {
    lines.push(`${coldCount} of them ${coldCount === 1 ? 'has' : 'have'} gone cold — untouched for ${COLD_DAYS}+ days.`);
  }
  if (pendingDrafts > 0) {
    lines.push(`Rex has ${pendingDrafts} draft${pendingDrafts === 1 ? '' : 's'} waiting for your review in Command Centre.`);
  }
  if (queuedTasks > 0) {
    lines.push(`${queuedTasks} agent task${queuedTasks === 1 ? ' is' : 's are'} queued and will run on the next cycle.`);
  }
  if (failedTasks > 0) {
    lines.push(`${failedTasks} agent task${failedTasks === 1 ? '' : 's'} failed after retries this week — see the work queue below.`);
  }
  const todayCount = dailyLog?.count ?? 0;
  if (todayCount < dailyGoal) {
    lines.push(`You're at ${todayCount} of your ${dailyGoal} daily goal so far today.`);
  } else {
    lines.push(`You've hit your daily goal of ${dailyGoal} already — nice work.`);
  }

  const staleInterested = await staleInterestedProspects(userId);

  const recommendations: AtlasRecommendation[] = [];
  if (staleInterested.length > 0) {
    recommendations.push({
      type: 'follow_up_interested',
      label: `Follow up with ${staleInterested.length} interested lead${staleInterested.length === 1 ? '' : 's'}`,
      detail: `Have Rex draft a follow-up for ${staleInterested.length} prospect${staleInterested.length === 1 ? '' : 's'} who showed interest but went quiet — nothing sends until you review it.`,
      count: staleInterested.length,
      done: false,
    });
  }
  if (coldCount > 0) {
    const batch = Math.min(coldCount, REACTIVATE_BATCH);
    recommendations.push({
      type: 'reactivate_cold_leads',
      label: `Reactivate ${batch} cold lead${batch === 1 ? '' : 's'}`,
      detail: `Have Rex draft fresh outreach for ${batch} of your ${coldCount} cold prospects — nothing sends until you review it.`,
      count: batch,
      done: false,
    });
  }
  if (settings?.autoProspectIndustry && settings?.autoProspectLocation) {
    recommendations.push({
      type: 'scan_more_prospects',
      label: `Scan ${settings.autoProspectLocation} for ${settings.autoProspectIndustry}`,
      detail: `Have Ava run a fresh search using your saved criteria in Settings.`,
      count: 0,
      done: false,
    });
  }

  return { summary: lines.join(' '), recommendations };
}

/** Loads today's cached brief, generating and caching one if it doesn't exist yet. */
export async function getOrCreateTodaysBrief(userId: string) {
  const date = todayStr();
  const existing = await prisma.atlasBrief.findUnique({ where: { userId_date: { userId, date } } });
  if (existing) return existing;

  const { summary, recommendations } = await buildBrief(userId);
  return prisma.atlasBrief.create({
    data: { userId, date, summary, recommendations: recommendations as unknown as object },
  });
}

async function markRecommendationDone(userId: string, type: AtlasRecommendationType) {
  const date = todayStr();
  const brief = await prisma.atlasBrief.findUnique({ where: { userId_date: { userId, date } } });
  if (!brief) return;
  const recs = (brief.recommendations as unknown as AtlasRecommendation[]).map((r) =>
    r.type === type ? { ...r, done: true } : r,
  );
  await prisma.atlasBrief.update({ where: { id: brief.id }, data: { recommendations: recs as unknown as object } });
}

export interface DelegateResult {
  ok: boolean;
  message: string;
}

/** Shared drafting loop for both reactivate_cold_leads and follow_up_interested. */
async function draftMessagesFor(
  userId: string,
  userPlan: string,
  prospects: Array<{ id: string; businessName: string; businessData: unknown }>,
  activityAction: string,
): Promise<number> {
  let drafted = 0;
  for (const prospect of prospects) {
    const usage = await checkAndIncrementAIForUser(userId, userPlan);
    if (!usage.ok) break;

    const business = prospect.businessData as unknown as Business;
    const result = await composeOutreach({ business, userId });

    await prisma.outreachDraft.create({
      data: {
        userId, prospectId: prospect.id, channel: 'whatsapp',
        whatsapp: result.whatsapp, emailSubject: result.emailSubject, emailBody: result.emailBody,
        framework: result.framework, opportunityTitle: result.opportunity?.title,
        opportunityReason: result.opportunity?.reason, priorContext: result.priorContext ?? undefined,
        status: 'pending',
      },
    });
    await logAgentActivity({
      userId, agentKey: 'outreach', action: activityAction,
      title: `Prepared a message for ${prospect.businessName}`,
    });
    drafted++;
  }
  return drafted;
}

/**
 * Executes one recommendation. Reuses the exact same quota-checked functions
 * Ava's and Rex's crons already use — ATLAS never bypasses those limits, it
 * just triggers them on an explicit click instead of waiting for the next run.
 */
export async function runDelegatedAction(userId: string, type: AtlasRecommendationType): Promise<DelegateResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!user) return { ok: false, message: 'User not found' };

  if (type === 'reactivate_cold_leads') {
    const prospects = await prisma.prospect.findMany({
      where: { ...coldLeadWhere(userId), outreachDrafts: { none: { status: 'pending' } } },
      orderBy: { updatedAt: 'asc' },
      take: REACTIVATE_BATCH,
    });

    const drafted = await draftMessagesFor(userId, user.plan, prospects, 'draft_prepared');

    await markRecommendationDone(userId, type);
    if (drafted === 0) return { ok: false, message: 'Daily AI limit reached — try again tomorrow.' };
    await logAgentActivity({
      userId, agentKey: 'atlas', action: 'delegated',
      title: `Delegated ${drafted} cold lead${drafted === 1 ? '' : 's'} to Rex for drafting`,
    });
    return { ok: true, message: `Rex drafted ${drafted} message${drafted === 1 ? '' : 's'} — review them below.` };
  }

  if (type === 'follow_up_interested') {
    const prospects = await staleInterestedProspects(userId);
    const drafted = await draftMessagesFor(userId, user.plan, prospects, 'follow_up_drafted');

    await markRecommendationDone(userId, type);
    if (drafted === 0) return { ok: false, message: 'Daily AI limit reached — try again tomorrow.' };
    await logAgentActivity({
      userId, agentKey: 'atlas', action: 'delegated',
      title: `Delegated ${drafted} follow-up${drafted === 1 ? '' : 's'} to Rex for drafting`,
    });
    return { ok: true, message: `Rex drafted ${drafted} follow-up${drafted === 1 ? '' : 's'} — review them below.` };
  }

  if (type === 'scan_more_prospects') {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.autoProspectIndustry || !settings?.autoProspectLocation) {
      return { ok: false, message: 'Set a target industry and location in Settings first.' };
    }

    const usage = await checkAndIncrementSearchForUser(userId, user.plan);
    if (!usage.ok) {
      await markRecommendationDone(userId, type);
      return { ok: false, message: 'Daily search limit reached — try again tomorrow.' };
    }

    const { found } = await runAutoProspectSearch({
      userId,
      industry: settings.autoProspectIndustry,
      location: settings.autoProspectLocation,
      minRating: settings.autoProspectMinRating,
      noWebsiteOnly: settings.autoProspectNoWebsiteOnly,
    });

    await markRecommendationDone(userId, type);
    if (found > 0) {
      await logAgentActivity({
        userId, agentKey: 'research', action: 'auto_scan_completed',
        title: `Scanned ${settings.autoProspectLocation} for ${settings.autoProspectIndustry} — found ${found} new prospect${found === 1 ? '' : 's'}`,
      });
      await logAgentActivity({
        userId, agentKey: 'atlas', action: 'delegated',
        title: `Delegated a fresh scan to Ava — found ${found} new prospect${found === 1 ? '' : 's'}`,
      });
    }
    return { ok: true, message: found > 0 ? `Ava found ${found} new prospect${found === 1 ? '' : 's'}.` : 'Ava scanned but found nothing new this time.' };
  }

  return { ok: false, message: 'Unknown recommendation type' };
}
