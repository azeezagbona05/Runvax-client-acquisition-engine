export type PlanId = 'free' | 'pro' | 'agency';

export interface PlanConfig {
  name: string;
  price: string | null;
  priceNote: string;
  aiCallsPerDay: number;
  maxProspects: number;
  badge: string;
  badgeClass: string;
  highlight: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    name: 'Free',
    price: null,
    priceNote: 'No credit card needed',
    aiCallsPerDay: 15,
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
    maxProspects: Infinity,
    badge: 'AGENCY',
    badgeClass: 'bg-orange-500 text-white',
    highlight: false,
  },
};

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
