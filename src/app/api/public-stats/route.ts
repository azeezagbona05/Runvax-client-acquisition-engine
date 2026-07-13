import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

// Public, PII-free usage numbers shown as social proof on marketing pages.
export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [businessesThisMonth, countries] = await Promise.all([
    prisma.cachedBusiness.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.cachedBusiness.findMany({
      distinct: ['country'],
      select: { country: true },
    }),
  ]);

  return NextResponse.json({
    businessesThisMonth,
    countryCount: countries.length,
  });
}
