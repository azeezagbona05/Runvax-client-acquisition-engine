import { PRICING_ENABLED } from './promo';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';
import { logAgentActivity } from '@/lib/agentActivity';

export type BillingRecommendationType = 'usage_near_limit' | 'plan_expiring_soon';

export interface BillingRecommendation {
  type: BillingRecommendationType;
  label: string;
  detail: string;
  count: number;
  href: string;
}

export interface BillingBriefData {
  summary: string;
  recommendations: BillingRecommendation[];
}

const NUDGE_THRESHOLD = 0.8;
const EXPIRY_WINDOW_DAYS = 3; // mirrors the window Argus uses for renewal reminders

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Pure, rule-based synthesis over data that already exists — no LLM call,
 * same as atlas.ts and adminOps.ts. Read-only: this never increments usage,
 * it just reads what checkAndIncrementAIForUser/checkAndIncrementSearchForUser
 * would have checked.
 */
export async function buildBillingBrief(userId: string): Promise<BillingBriefData> {
  const [user, usage] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, searchLimitOverride: true } }),
    prisma.usageRecord.findUnique({ where: { userId_date: { userId, date: todayStr() } } }),
  ]);

  if (!user) return { summary: '', recommendations: [] };

  const planConfig = await getPlanConfig(user.plan);
  const aiUsed = usage?.aiCalls ?? 0;
  const searchUsed = usage?.searchCount ?? 0;
  const aiLimit = planConfig.aiCallsPerDay;
  const searchLimit = user.searchLimitOverride ?? planConfig.searchesPerDay;

  const aiRatio = Number.isFinite(aiLimit) && aiLimit > 0 ? aiUsed / aiLimit : 0;
  const searchRatio = Number.isFinite(searchLimit) && searchLimit > 0 ? searchUsed / searchLimit : 0;
  const nearLimit = aiRatio >= NUDGE_THRESHOLD || searchRatio >= NUDGE_THRESHOLD;

  const lines: string[] = [];
  lines.push(`You're on the ${planConfig.name} plan.`);

  const recommendations: BillingRecommendation[] = [];

  if (nearLimit) {
    lines.push(
      Number.isFinite(aiLimit) && aiRatio >= NUDGE_THRESHOLD
        ? `You've used ${aiUsed} of ${aiLimit} AI calls today.`
        : `You've used ${searchUsed} of ${searchLimit} searches today.`,
    );
    recommendations.push({
      type: 'usage_near_limit',
      label: 'Close to your daily limit',
      detail: PRICING_ENABLED ? 'Upgrade to keep working without hitting your daily cap.' : 'Your limit resets overnight.',
      count: 1,
      href: PRICING_ENABLED ? '/pricing' : '/',
    });
  }

  if (user.plan !== 'free' && user.planExpiresAt) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (user.planExpiresAt >= now && user.planExpiresAt <= windowEnd) {
      const daysLeft = Math.max(1, Math.ceil((user.planExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      lines.push(`Your plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`);
      recommendations.push({
        type: 'plan_expiring_soon',
        label: PRICING_ENABLED ? `Renew — expires in ${daysLeft}d` : `Free Pro ends in ${daysLeft}d`,
        detail: PRICING_ENABLED ? 'Renew now to avoid losing Pro features when your plan lapses.' : 'Make the most of your Pro access while it lasts.',
        count: daysLeft,
        href: PRICING_ENABLED ? '/pricing' : '/',
      });
    }
  }

  if (recommendations.length === 0) {
    lines.push("You're all set — no action needed.");
  }

  return { summary: lines.join(' '), recommendations };
}

/** Loads today's cached billing brief, generating and caching one if it doesn't exist yet. */
export async function getOrCreateTodaysBillingBrief(userId: string) {
  const date = todayStr();
  const existing = await prisma.billingBrief.findUnique({ where: { userId_date: { userId, date } } });
  if (existing) return existing;

  const { summary, recommendations } = await buildBillingBrief(userId);
  if (recommendations.length > 0) {
    await logAgentActivity({
      userId, agentKey: 'billing', action: 'usage_nudge',
      title: recommendations[0].label,
    });
  }

  return prisma.billingBrief.create({
    data: { userId, date, summary, recommendations: recommendations as unknown as object },
  });
}
