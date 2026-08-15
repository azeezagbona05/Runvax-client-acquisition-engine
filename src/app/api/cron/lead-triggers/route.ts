import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectTriggers, type BusinessThen } from '@/lib/triggers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Scans cached businesses for buying signals and persists them as LeadTriggers.
// Called by Vercel Cron daily at 5am WAT (4am UTC) — before the onboarding-email
// cron at 7am UTC, so any digest built later in the day has fresh triggers.

function guardCron(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// How far back to look for the comparison snapshot. Long enough that real change
// is visible, short enough that the signal is still actionable.
const LOOKBACK_DAYS = 30;
// Businesses per pass. The cron has 60s; this keeps a single run well inside it
// and the cursor means successive days continue through the table.
const BATCH = 2000;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const asOf = new Date();
  const windowStart = new Date(asOf.getTime() - LOOKBACK_DAYS * 86_400_000);
  const cutoffDate = windowStart.toISOString().slice(0, 10);

  try {
    // Only businesses seen recently are worth scanning — stale rows are on their
    // way out under the 90-day retention policy anyway.
    const businesses = await prisma.cachedBusiness.findMany({
      where: { lastSeenAt: { gte: windowStart } },
      select: {
        placeId: true, name: true, category: true, city: true, country: true,
        rating: true, reviewCount: true, hasWebsite: true, firstSeenAt: true,
      },
      take: BATCH,
      orderBy: { lastSeenAt: 'desc' },
    });

    if (businesses.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0, triggers: 0 });
    }

    // One query for the whole batch's history, then pick the OLDEST snapshot per
    // business in JS. Ascending order means the first row seen per placeId is the
    // oldest, so change is measured across the full window rather than day-to-day.
    const snapshots = await prisma.businessSnapshot.findMany({
      where: {
        placeId: { in: businesses.map((b) => b.placeId) },
        date: { gte: cutoffDate },
      },
      select: { placeId: true, date: true, rating: true, reviewCount: true, hasWebsite: true },
      orderBy: { date: 'asc' },
    });

    // When each (city, category) segment was first indexed. Without this,
    // firstSeenAt makes every business in a freshly-searched area look newly
    // opened — on this dataset that was 1662 false positives out of 3236.
    const segments = await prisma.cachedBusiness.groupBy({
      by: ['city', 'category'],
      _min: { firstSeenAt: true },
    });
    const segmentStart = new Map<string, Date>();
    for (const s of segments) {
      if (s._min.firstSeenAt) segmentStart.set(`${s.city ?? ''}::${s.category}`, s._min.firstSeenAt);
    }

    const oldest = new Map<string, BusinessThen>();
    for (const s of snapshots) {
      if (!oldest.has(s.placeId)) {
        oldest.set(s.placeId, {
          date: s.date,
          rating: s.rating,
          reviewCount: s.reviewCount,
          hasWebsite: s.hasWebsite,
        });
      }
    }

    const detected = businesses.flatMap((b) =>
      detectTriggers(
        {
          placeId: b.placeId, name: b.name, category: b.category, city: b.city,
          country: b.country, rating: b.rating, reviewCount: b.reviewCount,
          hasWebsite: b.hasWebsite, firstSeenAt: b.firstSeenAt,
          segmentFirstSeenAt: segmentStart.get(`${b.city ?? ''}::${b.category}`),
        },
        oldest.get(b.placeId),
        asOf,
      ),
    );

    // Upsert rather than insert: the unique (placeId, type) constraint keeps one
    // live trigger per signal per business, refreshed each run instead of
    // accumulating a duplicate every night.
    let written = 0;
    for (const t of detected) {
      try {
        await prisma.leadTrigger.upsert({
          where: { placeId_type: { placeId: t.placeId, type: t.type } },
          create: {
            placeId: t.placeId, type: t.type, businessName: t.businessName,
            category: t.category, city: t.city, country: t.country,
            detail: t.detail, strength: t.strength, detectedAt: asOf,
          },
          update: { detail: t.detail, strength: t.strength, detectedAt: asOf, businessName: t.businessName },
        });
        written++;
      } catch {
        // One bad row must not abort the whole nightly run.
      }
    }

    // Expire triggers that haven't re-fired in a full lookback window — a
    // "just opened" business is not still just-opened a month later.
    const { count: expired } = await prisma.leadTrigger.deleteMany({
      where: { detectedAt: { lt: windowStart } },
    });

    const byType: Record<string, number> = {};
    for (const t of detected) byType[t.type] = (byType[t.type] ?? 0) + 1;

    return NextResponse.json({
      ok: true,
      scanned: businesses.length,
      withHistory: oldest.size,
      triggers: written,
      expired,
      byType,
      ms: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[/api/cron/lead-triggers]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
