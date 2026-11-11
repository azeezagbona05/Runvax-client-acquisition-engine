import { getToken } from 'next-auth/jwt';
import { getSiteSettings } from './siteSettings';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { getPlanConfig } from './plans';
import { FeatureId, FEATURE_LABELS } from './features';
import { createTransporter, limitReachedEmailHtml } from './email';
import { getAppUrl, getAppName } from './url';

// Fire-and-forget: email the user the first time they hit a daily limit —
// guarded by a per-day flag on UsageRecord so retries after the block don't
// re-send. Mirrors UpgradeModal's copy, which already shows the same message
// for both the search and AI caps.
function notifyLimitReachedOnce(userId: string, date: string, kind: 'search' | 'ai'): void {
  // That email says "upgrade"; with pricing off there is nothing to upgrade to.
  void (async () => {
    try {
      if (!(await getSiteSettings()).pricingVisible) return;
      const field = kind === 'search' ? 'searchLimitEmailSent' : 'aiLimitEmailSent';
      const record = await prisma.usageRecord.findUnique({
        where: { userId_date: { userId, date } },
        select: { searchLimitEmailSent: true, aiLimitEmailSent: true },
      });
      if (record?.[field]) return;

      // Claim it first so a burst of retried requests can't double-send.
      await prisma.usageRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, [field]: true },
        update: { [field]: true },
      });

      if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY) return;

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (!user?.email) return;

      const transporter = createTransporter();
      const appName = getAppName();
      await transporter.sendMail({
        from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Daily limit reached — upgrade to keep going',
        html: limitReachedEmailHtml(user.name ?? 'there', getAppUrl(), appName),
      });
    } catch (e) {
      console.error('[limit-email] failed', e);
    }
  })();
}

export interface FeatureCheckResult {
  ok: boolean;
  error?: NextResponse;
  plan?: string;
}

/**
 * Gate an API route behind a plan feature. Returns a 401 if not signed in and a
 * 402 (code FEATURE_LOCKED) if the user's plan doesn't include the feature.
 */
export async function requireFeature(req: NextRequest, feature: FeatureId): Promise<FeatureCheckResult> {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) {
    return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const plan = (token?.plan as string) ?? 'free';
  const planConfig = await getPlanConfig(plan);
  if (!planConfig.features.includes(feature)) {
    return {
      ok: false,
      error: NextResponse.json({
        error: `${FEATURE_LABELS[feature]} is available on Pro and Agency plans. Upgrade to unlock it.`,
        code: 'FEATURE_LOCKED',
        feature,
        plan,
      }, { status: 402 }),
    };
  }

  return { ok: true, plan };
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

interface UsageCheckResult {
  ok: boolean;
  error?: NextResponse;
  userId?: string;
  plan?: string;
  remaining?: number;
}

export interface AIUsageResult {
  ok: boolean;
  code?: 'SUSPENDED' | 'LIMIT_REACHED';
  used?: number;
  limit?: number;
  remaining?: number;
}

/**
 * Req-free core of the AI daily-cap check, so a cron job (no session/request)
 * can enforce the same per-user quota an interactive request would hit.
 */
export async function checkAndIncrementAIForUser(userId: string, userPlan: string): Promise<AIUsageResult> {
  const planConfig = await getPlanConfig(userPlan);
  const date = todayStr();

  const [userRecord, record] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true } }),
    prisma.usageRecord.findUnique({ where: { userId_date: { userId, date } } }),
  ]);

  if (userRecord?.isSuspended) {
    return { ok: false, code: 'SUSPENDED' };
  }

  if (planConfig.aiCallsPerDay === Infinity) {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, aiCalls: 1 },
      update: { aiCalls: { increment: 1 } },
    });
    return { ok: true };
  }

  const used = record?.aiCalls ?? 0;

  if (used >= planConfig.aiCallsPerDay) {
    notifyLimitReachedOnce(userId, date, 'ai');
    return { ok: false, code: 'LIMIT_REACHED', used, limit: planConfig.aiCallsPerDay };
  }

  await prisma.usageRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, aiCalls: 1 },
    update: { aiCalls: { increment: 1 } },
  });

  return { ok: true, remaining: planConfig.aiCallsPerDay - used - 1 };
}

export async function checkAndIncrementAI(req: NextRequest): Promise<UsageCheckResult> {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userPlan = (token?.plan as string) ?? 'free';
  const result = await checkAndIncrementAIForUser(userId, userPlan);

  if (!result.ok) {
    if (result.code === 'SUSPENDED') {
      return {
        ok: false,
        error: NextResponse.json({ error: 'This account has been suspended.', code: 'SUSPENDED' }, { status: 403 }),
      };
    }
    return {
      ok: false,
      error: NextResponse.json({
        error: 'Daily AI limit reached',
        code: 'LIMIT_REACHED',
        plan: userPlan,
        used: result.used,
        limit: result.limit,
      }, { status: 402 }),
    };
  }

  return { ok: true, userId, plan: userPlan, remaining: result.remaining };
}

export async function getUsageToday(userId: string): Promise<number> {
  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date: todayStr() } },
  });
  return record?.aiCalls ?? 0;
}

export interface SearchCheckResult {
  ok: boolean;
  error?: NextResponse;
  userId?: string;
  plan?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  resultsPerSearch?: number;
}

export interface SearchUsageResult {
  ok: boolean;
  code?: 'SUSPENDED' | 'SEARCH_LIMIT';
  used?: number;
  limit?: number;
  remaining?: number;
  resultsPerSearch?: number;
}

/**
 * Req-free core of the search daily-cap check, so a cron job (no session/request)
 * can enforce the same per-user quota an interactive request would hit.
 */
export async function checkAndIncrementSearchForUser(userId: string, userPlan: string): Promise<SearchUsageResult> {
  const planConfig = await getPlanConfig(userPlan);
  const date = todayStr();

  const [userRecord, record] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { searchLimitOverride: true, isSuspended: true },
    }),
    prisma.usageRecord.findUnique({ where: { userId_date: { userId, date } } }),
  ]);

  if (userRecord?.isSuspended) {
    return { ok: false, code: 'SUSPENDED' };
  }

  const effectiveLimit = userRecord?.searchLimitOverride != null
    ? userRecord.searchLimitOverride
    : planConfig.searchesPerDay;

  if (effectiveLimit === Infinity || effectiveLimit === -1) {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, searchCount: 1 },
      update: { searchCount: { increment: 1 } },
    });
    return { ok: true, resultsPerSearch: planConfig.resultsPerSearch };
  }

  const used = record?.searchCount ?? 0;

  if (used >= effectiveLimit) {
    // Skip the upsell email when the cap is an admin-set override, not the
    // plan's natural limit — upgrading wouldn't lift a manually-restricted account.
    if (userRecord?.searchLimitOverride == null) notifyLimitReachedOnce(userId, date, 'search');
    return { ok: false, code: 'SEARCH_LIMIT', used, limit: effectiveLimit };
  }

  await prisma.usageRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, searchCount: 1 },
    update: { searchCount: { increment: 1 } },
  });

  return {
    ok: true,
    used: used + 1,
    limit: effectiveLimit,
    remaining: effectiveLimit - used - 1,
    resultsPerSearch: planConfig.resultsPerSearch,
  };
}

export async function checkAndIncrementSearch(req: NextRequest): Promise<SearchCheckResult> {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userPlan = (token?.plan as string) ?? 'free';
  const result = await checkAndIncrementSearchForUser(userId, userPlan);

  if (!result.ok) {
    if (result.code === 'SUSPENDED') {
      return {
        ok: false,
        error: NextResponse.json({ error: 'This account has been suspended.', code: 'SUSPENDED' }, { status: 403 }),
      };
    }
    return {
      ok: false,
      error: NextResponse.json({
        error: `Daily search limit reached. Upgrade for more searches.`,
        code: 'SEARCH_LIMIT',
        plan: userPlan,
        used: result.used,
        limit: result.limit,
      }, { status: 402 }),
    };
  }

  return {
    ok: true,
    userId,
    plan: userPlan,
    used: result.used,
    limit: result.limit,
    remaining: result.remaining,
    resultsPerSearch: result.resultsPerSearch,
  };
}

export interface LocationCheckResult {
  ok: boolean;
  error?: NextResponse;
}

function locationMatches(location: string, keywords: string[]): boolean {
  const loc = location.toLowerCase();
  return keywords.some((kw) => loc.includes(kw.toLowerCase().trim()));
}

export async function checkLocationRestriction(
  userId: string,
  userPlan: string,
  location: string,
  country?: string,
): Promise<LocationCheckResult> {
  const [user, planConfig] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { blockedLocations: true, blockedCountries: true },
    }),
    getPlanConfig(userPlan),
  ]);

  // User-level blocked countries
  if (country && user?.blockedCountries) {
    try {
      const blocked: string[] = JSON.parse(user.blockedCountries);
      if (blocked.length > 0 && blocked.some((c) => c.toUpperCase() === country.toUpperCase())) {
        return {
          ok: false,
          error: NextResponse.json({
            error: 'Searches in this country are restricted on your account.',
            code: 'COUNTRY_BLOCKED',
          }, { status: 403 }),
        };
      }
    } catch { /* malformed JSON — skip */ }
  }

  // User-level blocked locations
  if (user?.blockedLocations) {
    try {
      const blocked: string[] = JSON.parse(user.blockedLocations);
      if (blocked.length > 0 && locationMatches(location, blocked)) {
        return {
          ok: false,
          error: NextResponse.json({
            error: 'Searches in this location are restricted on your account.',
            code: 'LOCATION_BLOCKED',
          }, { status: 403 }),
        };
      }
    } catch { /* malformed JSON — skip */ }
  }

  // Plan-level allowed countries (whitelist)
  const planAllowedCountries = (planConfig as { allowedCountries?: string | null }).allowedCountries;
  if (country && planAllowedCountries) {
    try {
      const allowed: string[] = JSON.parse(planAllowedCountries);
      if (allowed.length > 0 && !allowed.some((c) => c.toUpperCase() === country.toUpperCase())) {
        return {
          ok: false,
          error: NextResponse.json({
            error: 'Searches in this country are not available on your plan.',
            code: 'COUNTRY_NOT_ALLOWED',
          }, { status: 403 }),
        };
      }
    } catch { /* malformed JSON — skip */ }
  }

  // Plan-level allowed locations (whitelist)
  const planAllowedLocations = (planConfig as { allowedLocations?: string | null }).allowedLocations;
  if (planAllowedLocations) {
    try {
      const allowed: string[] = JSON.parse(planAllowedLocations);
      if (allowed.length > 0 && !locationMatches(location, allowed)) {
        return {
          ok: false,
          error: NextResponse.json({
            error: 'Searches in this location are not available on your plan.',
            code: 'LOCATION_NOT_ALLOWED',
          }, { status: 403 }),
        };
      }
    } catch { /* malformed JSON — skip */ }
  }

  return { ok: true };
}

/** Fire-and-forget: log AI token usage after a successful generation. */
export async function logTokenUsage(
  userId: string,
  provider: 'openai' | 'gemini',
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const date = todayStr();
  const data = provider === 'openai'
    ? { openaiInputTokens: { increment: inputTokens }, openaiOutputTokens: { increment: outputTokens } }
    : { geminiInputTokens: { increment: inputTokens }, geminiOutputTokens: { increment: outputTokens } };
  try {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...( provider === 'openai' ? { openaiInputTokens: inputTokens, openaiOutputTokens: outputTokens } : { geminiInputTokens: inputTokens, geminiOutputTokens: outputTokens }) },
      update: data,
    });
  } catch { /* never block the main response */ }
}

/** Fire-and-forget: log Google Places API requests made during a search. */
export async function logGooglePlacesReqs(userId: string, count: number): Promise<void> {
  const date = todayStr();
  try {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, googlePlacesReqs: count },
      update: { googlePlacesReqs: { increment: count } },
    });
  } catch { /* never block the main response */ }
}
