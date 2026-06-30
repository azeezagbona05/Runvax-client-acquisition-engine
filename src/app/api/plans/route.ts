import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';

export const dynamic = 'force-dynamic';

// Public, unauthenticated — powers the marketing pricing page so it can never
// drift from the admin-editable plan config.

const CORE_PLANS = ['free', 'pro', 'agency'];
const numOrNull = (n: number) => (n === Infinity ? null : n);

export async function GET() {
  let ids: string[] = [...CORE_PLANS];
  try {
    const rows = await prisma.planConfig.findMany({ select: { planId: true } });
    const extras = rows.map((r) => r.planId).filter((id) => !CORE_PLANS.includes(id));
    ids = [...CORE_PLANS, ...extras];
  } catch { /* fall back to core plans */ }

  const plans = await Promise.all(ids.map(async (planId) => {
    const c = await getPlanConfig(planId);
    return {
      planId,
      name: c.name,
      price: c.price,
      priceNote: c.priceNote,
      searchesPerDay:   numOrNull(c.searchesPerDay),
      resultsPerSearch: numOrNull(c.resultsPerSearch),
      aiCallsPerDay:    numOrNull(c.aiCallsPerDay),
      maxProspects:     numOrNull(c.maxProspects),
      features:         c.features,
      highlight:        c.highlight,
    };
  }));

  return NextResponse.json(plans);
}
