import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { valToDb, clearPlanCache } from '@/lib/plans';
import { FeatureId, resolveFeatures, serializeFeatures } from '@/lib/features';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

function isAdmin(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { planId } = params;

  const body = await req.json() as {
    name?: string;
    price?: string | null;
    priceNote?: string;
    searchesPerDay?: number;
    resultsPerSearch?: number;
    aiCallsPerDay?: number;
    maxProspects?: number;
    features?: FeatureId[];
    allowedLocations?: string[] | null;
    allowedCountries?: string[] | null;
  };

  const data: Record<string, unknown> = {};
  if (body.name             !== undefined) data.name             = body.name;
  if (body.price            !== undefined) data.price            = body.price || null;
  if (body.priceNote        !== undefined) data.priceNote        = body.priceNote;
  if (body.searchesPerDay   !== undefined) data.searchesPerDay   = valToDb(body.searchesPerDay);
  if (body.resultsPerSearch !== undefined) data.resultsPerSearch = valToDb(body.resultsPerSearch);
  if (body.aiCallsPerDay    !== undefined) data.aiCallsPerDay    = valToDb(body.aiCallsPerDay);
  if (body.maxProspects     !== undefined) data.maxProspects     = valToDb(body.maxProspects);
  if (Array.isArray(body.features))        data.features         = serializeFeatures(body.features);
  if ('allowedLocations' in body)          data.allowedLocations = body.allowedLocations?.length
    ? JSON.stringify(body.allowedLocations) : null;
  if ('allowedCountries' in body)          data.allowedCountries = body.allowedCountries?.length
    ? JSON.stringify(body.allowedCountries) : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const row = await prisma.planConfig.upsert({
    where: { planId },
    create: {
      planId,
      name: 'Custom',
      searchesPerDay: 5, resultsPerSearch: 20,
      aiCallsPerDay: 15, maxProspects: 30,
      ...data,
    },
    update: data,
  });

  clearPlanCache();
  return NextResponse.json({ ...row, features: resolveFeatures(planId, row.features) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { planId } = params;

  if (planId === 'free') {
    return NextResponse.json(
      { error: 'Cannot delete the free plan — it is the system default for all users.' },
      { status: 400 }
    );
  }

  const row = await prisma.planConfig.findUnique({ where: { planId } });
  if (!row) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  // Downgrade any users still on this plan to free
  await prisma.user.updateMany({
    where: { plan: planId },
    data: { plan: 'free', planExpiresAt: null },
  });

  await prisma.planConfig.delete({ where: { planId } });

  clearPlanCache();
  return NextResponse.json({ ok: true });
}
