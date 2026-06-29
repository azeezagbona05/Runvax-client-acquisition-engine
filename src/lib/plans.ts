import { prisma } from './prisma';

export type PlanId = 'free' | 'pro' | 'agency';

export interface PlanConfig {
  name: string;
  price: string | null;
  priceNote: string;
  aiCallsPerDay: number;
  searchesPerDay: number;
  resultsPerSearch: number;
  maxProspects: number;
  badge: string;
  badgeClass: string;
  highlight: boolean;
}

// Hardcoded defaults — used as fallback when DB row is missing
export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    name: 'Free',
    price: null,
    priceNote: 'No credit card needed',
    aiCallsPerDay: 15,
    searchesPerDay: 5,
    resultsPerSearch: 20,
    maxProspects: 30,
    badge: 'FREE',
    badgeClass: 'bg-gray-700 text-gray-300',
    highlight: false,
  },
  pro: {
    name: 'Pro',
    price: '₦9,999',
    priceNote: 'per month',
    aiCallsPerDay: 200,
    searchesPerDay: 20,
    resultsPerSearch: 60,
    maxProspects: Infinity,
    badge: 'PRO',
    badgeClass: 'bg-purple-600 text-white',
    highlight: true,
  },
  agency: {
    name: 'Agency',
    price: '₦24,999',
    priceNote: 'per month',
    aiCallsPerDay: Infinity,
    searchesPerDay: Infinity,
    resultsPerSearch: Infinity,
    maxProspects: Infinity,
    badge: 'AGENCY',
    badgeClass: 'bg-orange-500 text-white',
    highlight: false,
  },
};

// DB stores -1 for unlimited
export const UNLIMITED = -1;
export function dbToVal(n: number): number { return n === UNLIMITED ? Infinity : n; }
export function valToDb(n: number): number { return n === Infinity ? UNLIMITED : n; }

// 60-second in-memory cache — avoids a DB round-trip on every search/AI call
const cache = new Map<string, { config: PlanConfig; exp: number }>();
const CACHE_TTL = 60_000;

export async function getPlanConfig(planId: string): Promise<PlanConfig> {
  const hit = cache.get(planId);
  if (hit && hit.exp > Date.now()) return hit.config;

  try {
    const row = await prisma.planConfig.findUnique({ where: { planId } });
    if (row) {
      // For built-in plans use PLANS as the base; for custom plans build a base from DB fields
      const base: PlanConfig = PLANS[planId as PlanId] ?? {
        name: row.name || planId,
        price: row.price ?? null,
        priceNote: row.priceNote || 'per month',
        aiCallsPerDay: Infinity,
        searchesPerDay: Infinity,
        resultsPerSearch: Infinity,
        maxProspects: Infinity,
        badge: (row.name || planId).toUpperCase(),
        badgeClass: 'bg-gray-700 text-gray-300',
        highlight: false,
      };
      const config: PlanConfig = {
        ...base,
        aiCallsPerDay:    dbToVal(row.aiCallsPerDay),
        searchesPerDay:   dbToVal(row.searchesPerDay),
        resultsPerSearch: dbToVal(row.resultsPerSearch),
        maxProspects:     dbToVal(row.maxProspects),
      };
      cache.set(planId, { config, exp: Date.now() + CACHE_TTL });
      return config;
    }
  } catch { /* fall through to hardcoded */ }

  return PLANS[planId as PlanId] ?? PLANS.free;
}

export function clearPlanCache(): void {
  cache.clear();
}

// Sync fallback kept for non-critical uses (e.g. UI display)
export function getPlan(plan: string): PlanConfig {
  return PLANS[plan as PlanId] ?? PLANS.free;
}

export function canUseAI(plan: string, usedToday: number): boolean {
  const limit = getPlan(plan).aiCallsPerDay;
  return limit === Infinity || usedToday < limit;
}

export function canSaveMoreProspects(plan: string, savedCount: number): boolean {
  const limit = getPlan(plan).maxProspects;
  return limit === Infinity || savedCount < limit;
}
