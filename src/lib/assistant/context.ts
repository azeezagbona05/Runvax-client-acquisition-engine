// Live account snapshot handed to the support agent.
//
// The knowledge base explains how Runvax works in general; this explains how
// THIS account is configured right now. It is what turns "here is how limits
// work" into "you have used 5 of your 5 searches today, they reset in 4 hours".
//
// Read-only, and assembled server-side only — the user never supplies any of it,
// so the agent cannot be talked into believing a different plan or usage figure.

import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';
import { FEATURE_LABELS, FeatureId } from '@/lib/features';

export interface AccountSnapshot {
  signedIn: boolean;
  planId: string;
  planName: string;
  emailVerified: boolean;
  suspended: boolean;
  searches: { used: number; limit: number | null };   // null = unlimited
  aiCalls: { used: number; limit: number | null };
  prospects: { total: number; byStage: Record<string, number> };
  lockedFeatures: string[];
  setupGaps: string[];
  hoursUntilReset: number;
}

/** How many hours until the daily counters roll over at midnight UTC. */
function hoursUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.round(((next - now.getTime()) / 3_600_000) * 10) / 10;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

const ALL_FEATURE_IDS: FeatureId[] = ['emailBlast', 'proposals', 'marketBrief', 'weaknessAnalysis'];

/**
 * Gather everything the agent needs to answer account-specific questions.
 * Never throws: a DB hiccup degrades to a signed-out-shaped snapshot rather
 * than failing the whole chat request.
 */
export async function getAccountSnapshot(
  userId: string | undefined,
  planId: string,
): Promise<AccountSnapshot> {
  const empty: AccountSnapshot = {
    signedIn: false,
    planId: 'free',
    planName: 'Free',
    emailVerified: false,
    suspended: false,
    searches: { used: 0, limit: null },
    aiCalls: { used: 0, limit: null },
    prospects: { total: 0, byStage: {} },
    lockedFeatures: [],
    setupGaps: [],
    hoursUntilReset: hoursUntilUtcMidnight(),
  };

  if (!userId) return empty;

  try {
    const [planConfig, user, usage, settings, stageGroups] = await Promise.all([
      getPlanConfig(planId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true, isSuspended: true, searchLimitOverride: true },
      }),
      prisma.usageRecord.findUnique({
        where: { userId_date: { userId, date: todayStr() } },
        select: { searchCount: true, aiCalls: true },
      }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.prospect.groupBy({ by: ['stage'], where: { userId }, _count: { _all: true } }),
    ]);

    const byStage: Record<string, number> = {};
    let total = 0;
    stageGroups.forEach((g) => {
      byStage[g.stage] = g._count._all;
      total += g._count._all;
    });

    const searchLimit = user?.searchLimitOverride ?? planConfig.searchesPerDay;

    // What the user still has to configure. Ordered by how much it costs them
    // to leave undone, so the agent naturally leads with the biggest win.
    const gaps: string[] = [];
    if (!settings?.senderName) gaps.push('Your name is not set (Settings → Profile) — outreach has no signature');
    if (!settings?.businessName) gaps.push('Agency name is not set (Settings → Profile)');
    if (!settings?.tagline) gaps.push('Tagline is empty (Settings → Profile) — this is the top cause of generic-sounding messages');
    if (!settings?.city) gaps.push('City is not set (Settings → Profile) — messages lose local references');
    if (!settings?.replyEmail) gaps.push('Reply email is not set (Settings → Email & SMTP)');
    if (!settings?.smtpHost) gaps.push('No custom SMTP (Settings → Email & SMTP) — emails send from the platform address and are likelier to land in spam');
    if (!settings?.website) gaps.push('Portfolio website URL is not set (Settings → Profile)');
    const portfolio = settings?.portfolio as unknown[] | null;
    if (!portfolio || portfolio.length === 0) gaps.push('No portfolio pieces added (Settings → Portfolio) — proposals have no proof section');
    if (!settings?.rateCard) gaps.push('Rate card is not set up (Settings → Rate Card) — proposals have no pricing section');
    if (!settings?.bankAccount) gaps.push('Bank details are missing (Settings → Bank & Payment) — proposals have no payment instructions');
    if (!settings?.waPhoneNumberId) gaps.push('WhatsApp Business API is not connected (Settings → WhatsApp Business) — optional; you can still send via WhatsApp links');

    return {
      signedIn: true,
      planId,
      planName: planConfig.name,
      emailVerified: !!user?.emailVerified,
      suspended: !!user?.isSuspended,
      searches: {
        used: usage?.searchCount ?? 0,
        limit: searchLimit === Infinity || searchLimit === -1 ? null : searchLimit,
      },
      aiCalls: {
        used: usage?.aiCalls ?? 0,
        limit: planConfig.aiCallsPerDay === Infinity ? null : planConfig.aiCallsPerDay,
      },
      prospects: { total, byStage },
      lockedFeatures: ALL_FEATURE_IDS
        .filter((f) => !planConfig.features.includes(f))
        .map((f) => FEATURE_LABELS[f]),
      setupGaps: gaps,
      hoursUntilReset: hoursUntilUtcMidnight(),
    };
  } catch {
    return { ...empty, planId, signedIn: true };
  }
}

function quota(label: string, used: number, limit: number | null): string {
  if (limit === null) return `- ${label}: ${used} used today (unlimited on this plan)`;
  const left = Math.max(0, limit - used);
  const state = left === 0 ? ' — EXHAUSTED for today' : '';
  return `- ${label}: ${used} of ${limit} used today, ${left} left${state}`;
}

/** Render the snapshot as the prompt block the model reads. */
export function formatSnapshot(s: AccountSnapshot): string {
  if (!s.signedIn) {
    return `The person asking is NOT signed in. You can answer general questions about Runvax, but you cannot see any account details. For anything account-specific, ask them to sign in first.`;
  }

  const lines: string[] = [
    `- Plan: ${s.planName}`,
    quota('Searches', s.searches.used, s.searches.limit),
    quota('AI calls', s.aiCalls.used, s.aiCalls.limit),
    `- Daily limits reset in about ${s.hoursUntilReset} hours (midnight UTC)`,
    `- Saved prospects: ${s.prospects.total}${
      s.prospects.total > 0
        ? ` (${Object.entries(s.prospects.byStage).map(([k, v]) => `${k}: ${v}`).join(', ')})`
        : ''
    }`,
  ];

  if (!s.emailVerified) lines.push('- WARNING: their email address is NOT verified, which blocks searching');
  if (s.suspended) lines.push('- WARNING: this account is SUSPENDED — they must contact support');
  if (s.lockedFeatures.length > 0) {
    lines.push(`- Features locked on their plan: ${s.lockedFeatures.join(', ')}`);
  }
  if (s.setupGaps.length > 0) {
    lines.push(`- Incomplete setup:\n${s.setupGaps.map((g) => `    · ${g}`).join('\n')}`);
  } else {
    lines.push('- Setup is complete — profile, email, portfolio, rate card and bank details are all filled in');
  }

  return lines.join('\n');
}
