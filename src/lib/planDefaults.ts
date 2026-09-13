// Built-in plan defaults — the single source of truth for tier names, prices and
// limits when the DB has no PlanConfig row (or can't be reached). No server-only
// imports (no prisma), so this is safe to import from client components too:
// the marketing pricing page renders these while /api/plans loads.
//
// At runtime the DB row wins — see getPlanConfig() in ./plans. Change a limit
// here and it only affects installs with no PlanConfig row for that plan; to
// change it for real, edit the plan in the admin panel.

export type PlanId = 'free' | 'pro' | 'agency';

export interface PlanDefaults {
  name: string;
  /** Display price, e.g. '₦9,999'. null = free. Also drives the Paystack charge — see priceToKobo(). */
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

export const PLAN_DEFAULTS: Record<PlanId, PlanDefaults> = {
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

/**
 * Parse a display price ('₦9,999') into kobo (999900) for Paystack.
 * Returns null for a free/blank/unparseable price so callers can refuse to
 * charge rather than guess an amount.
 */
export function priceToKobo(price: string | null | undefined): number | null {
  if (!price) return null;
  const digits = price.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const naira = Number(digits);
  if (!Number.isFinite(naira) || naira <= 0) return null;
  return Math.round(naira * 100);
}
