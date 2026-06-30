import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { getPlanConfig } from './plans';
import { FeatureId, FEATURE_LABELS } from './features';

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

export async function checkAndIncrementAI(req: NextRequest): Promise<UsageCheckResult> {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuspended: true },
  });
  if (userRecord?.isSuspended) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'This account has been suspended.', code: 'SUSPENDED' }, { status: 403 }),
    };
  }

  const userPlan = (token?.plan as string) ?? 'free';
  const planConfig = await getPlanConfig(userPlan);
  const date = todayStr();

  if (planConfig.aiCallsPerDay === Infinity) {
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, aiCalls: 1 },
      update: { aiCalls: { increment: 1 } },
    });
    return { ok: true, userId, plan: userPlan };
  }

  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date } },
  });

  const used = record?.aiCalls ?? 0;

  if (used >= planConfig.aiCallsPerDay) {
    return {
      ok: false,
      error: NextResponse.json({
        error: 'Daily AI limit reached',
        code: 'LIMIT_REACHED',
        plan: userPlan,
        used,
        limit: planConfig.aiCallsPerDay,
      }, { status: 402 }),
    };
  }

  await prisma.usageRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, aiCalls: 1 },
    update: { aiCalls: { increment: 1 } },
  });

  return {
    ok: true,
    userId,
    plan: userPlan,
    remaining: planConfig.aiCallsPerDay - used - 1,
  };
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
  const planConfig = await getPlanConfig(userPlan);
  const date = todayStr();

  // Per-user override takes precedence over plan default.
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { searchLimitOverride: true, isSuspended: true },
  });
  if (userRecord?.isSuspended) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'This account has been suspended.', code: 'SUSPENDED' }, { status: 403 }),
    };
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
    return { ok: true, userId, plan: userPlan, resultsPerSearch: planConfig.resultsPerSearch };
  }

  const record = await prisma.usageRecord.findUnique({
    where: { userId_date: { userId, date } },
  });

  const used = record?.searchCount ?? 0;

  if (used >= effectiveLimit) {
    return {
      ok: false,
      error: NextResponse.json({
        error: `Daily search limit reached. Upgrade for more searches.`,
        code: 'SEARCH_LIMIT',
        plan: userPlan,
        used,
        limit: effectiveLimit,
      }, { status: 402 }),
    };
  }

  await prisma.usageRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, searchCount: 1 },
    update: { searchCount: { increment: 1 } },
  });

  return {
    ok: true,
    userId,
    plan: userPlan,
    used: used + 1,
    limit: effectiveLimit,
    remaining: effectiveLimit - used - 1,
    resultsPerSearch: planConfig.resultsPerSearch,
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
