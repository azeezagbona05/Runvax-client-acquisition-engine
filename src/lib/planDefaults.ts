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
  /** Display price, e.g. '$6'. null = free. Prices are shown in US dollars; the Paystack charge is NOT derived from a dollar price — see priceToKobo(). */
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
    price: '$6',
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
    price: '$15',
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

export type ChargeCurrency = 'USD' | 'NGN';

/**
 * What to charge for a display price, in the currency's smallest unit: '$6' -> 600 US cents,
 * '₦9,999' -> 999900 kobo. Plans are priced in US dollars; the naira branch only exists so an
 * old naira price stored in the admin panel still charges correctly instead of being misread.
 * Returns null for a free/blank/unparseable price so callers refuse to charge rather than guess.
 */
export function priceToCharge(price: string | null | undefined): { amount: number; currency: ChargeCurrency } | null {
  if (!price) return null;
  const digits = price.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const major = Number(digits);
  if (!Number.isFinite(major) || major <= 0) return null;
  const currency: ChargeCurrency = price.trim().startsWith('$') ? 'USD' : 'NGN';
  return { amount: Math.round(major * 100), currency };
}

/**
 * Parse a naira display price ('₦9,999') into kobo (999900). Dollar prices return null here
 * on purpose: use priceToCharge(), which keeps the currency with the amount.
 * Returns null for a free/blank/unparseable price so callers can refuse to
 * charge rather than guess an amount.
 */
export function priceToKobo(price: string | null | undefined): number | null {
  if (!price) return null;
  // Display prices are in dollars. Reading '$6' as ₦6 would charge the wrong amount, so a
  // dollar price yields no charge until a USD payment path exists.
  if (price.trim().startsWith('$')) return null;
  const digits = price.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const naira = Number(digits);
  if (!Number.isFinite(naira) || naira <= 0) return null;
  return Math.round(naira * 100);
}
