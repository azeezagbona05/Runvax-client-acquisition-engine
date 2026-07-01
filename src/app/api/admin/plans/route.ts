import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, valToDb, clearPlanCache } from '@/lib/plans';
import { FeatureId, resolveFeatures, serializeFeatures } from '@/lib/features';

// Resolve features CSV → FeatureId[] and parse allowedLocations JSON → string[]
function withFeatures<T extends { planId: string; features: string | null; allowedLocations?: string | null; allowedCountries?: string | null }>(row: T) {
  let allowedLocations: string[] | null = null;
  if (row.allowedLocations) {
    try { allowedLocations = JSON.parse(row.allowedLocations) as string[]; } catch { allowedLocations = null; }
  }
  let allowedCountries: string[] | null = null;
  if (row.allowedCountries) {
    try { allowedCountries = JSON.parse(row.allowedCountries) as string[]; } catch { allowedCountries = null; }
  }
  return { ...row, features: resolveFeatures(row.planId, row.features), allowedLocations, allowedCountries };
}

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

function isAdmin(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

const CORE_PLANS = ['free', 'pro', 'agency'] as const;

// Seed name/price/limits for built-in plans that have no DB row yet
async function ensureDefaults() {
  for (const planId of CORE_PLANS) {
    const d = PLANS[planId];
    await prisma.planConfig.upsert({
      where: { planId },
      create: {
        planId,
        name:             d.name,
        price:            d.price,
        priceNote:        d.priceNote,
        searchesPerDay:   valToDb(d.searchesPerDay),
        resultsPerSearch: valToDb(d.resultsPerSearch),
        aiCallsPerDay:    valToDb(d.aiCallsPerDay),
        maxProspects:     valToDb(d.maxProspects),
        features:         serializeFeatures(d.features),
      },
      update: {}, // never overwrite existing admin edits
    });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureDefaults();
  const rows = await prisma.planConfig.findMany({ orderBy: { updatedAt: 'asc' } });
  return NextResponse.json(rows.map(withFeatures));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    planId: string;
    name: string;
    price?: string;
    priceNote?: string;
    searchesPerDay: number;
    resultsPerSearch: number;
    aiCallsPerDay: number;
    maxProspects: number;
    features?: FeatureId[];
  };

  const planId = body.planId?.trim().toLowerCase().replace(/\s+/g, '-');
  if (!planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const existing = await prisma.planConfig.findUnique({ where: { planId } });
  if (existing) return NextResponse.json({ error: `Plan "${planId}" already exists` }, { status: 409 });

  const row = await prisma.planConfig.create({
    data: {
      planId,
      name:             body.name.trim(),
      price:            body.price?.trim() || null,
      priceNote:        body.priceNote?.trim() || 'per month',
      searchesPerDay:   valToDb(body.searchesPerDay ?? 5),
      resultsPerSearch: valToDb(body.resultsPerSearch ?? 20),
      aiCallsPerDay:    valToDb(body.aiCallsPerDay ?? 15),
      maxProspects:     valToDb(body.maxProspects ?? 30),
      features:         Array.isArray(body.features) ? serializeFeatures(body.features) : null,
    },
  });

  clearPlanCache();
  return NextResponse.json(withFeatures(row), { status: 201 });
}
