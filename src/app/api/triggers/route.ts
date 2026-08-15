import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { TriggerType } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;

/**
 * GET /api/triggers
 *   ?city=Lagos          filter to one city
 *   ?type=review_surge   filter to one signal
 *   ?all=1               skip the personalised filter and return everything
 *   ?limit=50
 *
 * By default results are scoped to the cities the user actually prospects, taken
 * from their SearchHistory — an alert about a city they have never searched is
 * noise, and noise is what makes people stop reading alerts.
 *
 * 'website_gained' is excluded by default: it is a real signal but a negative
 * one, useful for suppressing leads rather than surfacing them.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const city = sp.get('city')?.trim();
  const type = sp.get('type')?.trim() as TriggerType | null;
  const all = sp.get('all') === '1';
  const limit = Math.min(Number(sp.get('limit')) || 30, MAX_LIMIT);

  try {
    let cities: string[] = [];
    if (!city && !all) {
      const history = await prisma.searchHistory.findMany({
        where: { userId: session.user.id },
        select: { location: true },
        orderBy: { searchedAt: 'desc' },
        take: 20,
      });
      cities = Array.from(new Set(history.map((h) => h.location.trim()).filter(Boolean)));
    }

    const rows = await prisma.leadTrigger.findMany({
      where: {
        ...(type ? { type } : { type: { not: 'website_gained' } }),
        ...(city ? { city: { contains: city } } : {}),
        // No search history yet means no personalisation is possible — fall back
        // to showing everything rather than an empty list.
        ...(!city && !all && cities.length > 0 ? { city: { in: cities } } : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      triggers: rows.map((r) => ({
        placeId: r.placeId,
        type: r.type,
        businessName: r.businessName,
        category: r.category,
        city: r.city,
        detail: r.detail,
        strength: r.strength,
        detectedAt: r.detectedAt.toISOString(),
      })),
      personalised: cities.length > 0 && !city && !all,
    });
  } catch (err) {
    console.error('[/api/triggers]', err);
    return NextResponse.json({ triggers: [] });
  }
}
