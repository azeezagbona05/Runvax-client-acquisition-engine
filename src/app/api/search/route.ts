import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { searchPlaces } from '@/lib/google-places';
import { checkAndIncrementSearch, checkLocationRestriction, logGooglePlacesReqs } from '@/lib/usage';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function buildCacheKey(query: string, country: string, radius: number, lat?: number, lng?: number) {
  const parts = [query.toLowerCase().trim(), country, String(radius)];
  if (lat !== undefined && lng !== undefined) {
    // Round to 2 decimal places (~1 km grid) so nearby GPS searches share the same cache
    parts.push(String(Math.round(lat * 100) / 100));
    parts.push(String(Math.round(lng * 100) / 100));
  }
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, lat, lng, radius = 5, location, country, forceRefresh } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const token = await getToken({ req });
    const userId = (token?.id ?? token?.sub) as string | undefined;
    const isGuest = !userId;

    const cacheKey = buildCacheKey(query, country ?? 'NG', radius, lat, lng);
    const sevenDaysAgo = new Date(Date.now() - CACHE_TTL_MS);

    // ── Cache hit path (authenticated users only, skippable with forceRefresh) ──
    if (!isGuest && !forceRefresh) {
      const cached = await prisma.searchCache.findFirst({
        where: { cacheKey, createdAt: { gte: sevenDaysAgo } },
      });

      if (cached) {
        // Still enforce location restriction even on cache hits
        if (location || country) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
          });
          const locCheck = await checkLocationRestriction(
            userId!, user?.plan ?? 'free',
            (location as string) || '',
            (country as string) || undefined,
          );
          if (!locCheck.ok) return locCheck.error!;
        }

        const results = cached.results as Array<Record<string, unknown>>;
        const cachedIds = results.map((r) => r.id as string).filter(Boolean);
        const psiRows = await prisma.cachedBusiness.findMany({
          where: { placeId: { in: cachedIds } },
          select: { placeId: true, psiScore: true, psiDesktopScore: true },
        });
        const psiMap = new Map(psiRows.map((r) => [r.placeId, r]));
        const enriched = results.map((r) => {
          const p = psiMap.get(r.id as string);
          return { ...r, psiScore: p?.psiScore ?? undefined, psiDesktopScore: p?.psiDesktopScore ?? undefined };
        });
        return NextResponse.json({
          businesses: enriched,
          total: enriched.length,
          isGuest: false,
          cached: true,
          cachedAt: cached.createdAt.toISOString(),
        });
      }
    }

    // ── Cache miss — proceed with Google Places API ──
    let resultsLimit = 20;
    let searchMeta: {
      searchesRemaining?: number;
      searchesUsed?: number;
      searchesLimit?: number;
      plan?: string;
    } = {};

    if (isGuest) {
      resultsLimit = 20;
    } else {
      const usage = await checkAndIncrementSearch(req);
      if (!usage.ok) return usage.error!;

      if (location || country) {
        const locCheck = await checkLocationRestriction(
          usage.userId!, usage.plan!,
          (location as string) || '',
          (country as string) || undefined,
        );
        if (!locCheck.ok) return locCheck.error!;
      }
      resultsLimit = usage.resultsPerSearch ?? 20;
      searchMeta = {
        searchesRemaining: usage.remaining,
        searchesUsed:      usage.used,
        searchesLimit:     usage.limit,
        plan:              usage.plan,
      };
    }

    const maxPages = resultsLimit === Infinity ? 3 : Math.ceil(resultsLimit / 20);
    const data = await searchPlaces({ query, lat, lng, radius, maxPages });

    const pagesUsed = Math.min(maxPages, Math.ceil((data.places?.length ?? 0) / 20) || 1);
    if (userId) void logGooglePlacesReqs(userId, pagesUsed);

    const allBusinesses = (data.places || []).map((place: unknown) => {
      const p = place as Record<string, unknown>;
      const displayName = p.displayName as Record<string, string> | undefined;
      const primaryType = p.primaryTypeDisplayName as Record<string, string> | undefined;
      const loc = p.location as { latitude: number; longitude: number } | undefined;
      return {
        id: p.id,
        name: displayName?.text || 'Unknown Business',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber,
        phoneIntl: p.internationalPhoneNumber,
        website: p.websiteUri,
        hasWebsite: !!p.websiteUri,
        category: primaryType?.text || 'Business',
        location: loc,
        rating: p.rating,
        reviewCount: p.userRatingCount,
        status: p.businessStatus,
      };
    });

    const businesses = resultsLimit === Infinity
      ? allBusinesses
      : allBusinesses.slice(0, resultsLimit);

    // ── Write to cache + proprietary SMB database (fire-and-forget) ──
    if (userId && businesses.length > 0) {
      void (async () => {
        try {
          const now = new Date();
          const cityFromQuery = (location as string | undefined) ?? '';
          const countryCode = (country as string | undefined) ?? 'NG';

          await Promise.all([
            // Save search result set to cache (upsert refreshes createdAt)
            prisma.searchCache.upsert({
              where: { cacheKey },
              create: { cacheKey, query, country: countryCode, radius, results: businesses as object[], createdAt: now },
              update: { results: businesses as object[], createdAt: now },
            }),

            // Write individual businesses to proprietary African SMB database
            ...businesses.map((b) =>
              prisma.cachedBusiness.upsert({
                where: { placeId: b.id as string },
                create: {
                  placeId: b.id as string,
                  name: b.name,
                  category: b.category,
                  address: b.address as string | undefined,
                  city: cityFromQuery,
                  country: countryCode,
                  phone: b.phone as string | undefined,
                  website: b.website as string | undefined,
                  hasWebsite: b.hasWebsite,
                  rating: b.rating as number | undefined,
                  reviewCount: b.reviewCount as number | undefined,
                  timesSearched: 1,
                },
                update: {
                  website: b.website as string | undefined,
                  hasWebsite: b.hasWebsite,
                  rating: b.rating as number | undefined,
                  reviewCount: b.reviewCount as number | undefined,
                  timesSearched: { increment: 1 },
                },
              })
            ),
          ]);

          // Lazily clean up cache entries older than 7 days
          void prisma.searchCache.deleteMany({
            where: { createdAt: { lt: new Date(Date.now() - CACHE_TTL_MS) } },
          }).catch(() => {});
        } catch { /* never block the response */ }
      })();
    }

    // Inject any previously-checked PSI scores (fast indexed lookup)
    const freshIds = businesses.map((b) => b.id as string).filter(Boolean);
    const psiRows = freshIds.length > 0
      ? await prisma.cachedBusiness.findMany({
          where: { placeId: { in: freshIds } },
          select: { placeId: true, psiScore: true, psiDesktopScore: true },
        })
      : [];
    const psiMap = new Map(psiRows.map((r) => [r.placeId, r]));
    const businessesWithPsi = businesses.map((b) => {
      const p = psiMap.get(b.id as string);
      return { ...b, psiScore: p?.psiScore ?? undefined, psiDesktopScore: p?.psiDesktopScore ?? undefined };
    });

    return NextResponse.json({
      businesses: businessesWithPsi,
      total: businessesWithPsi.length,
      isGuest,
      cached: false,
      unlimitedResults: resultsLimit === Infinity,
      resultsLimit: resultsLimit === Infinity ? null : resultsLimit,
      ...searchMeta,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/search]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
