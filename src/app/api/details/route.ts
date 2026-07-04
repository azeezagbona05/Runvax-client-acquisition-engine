import { NextRequest, NextResponse } from 'next/server';
import { getPlaceDetails, searchPlaces } from '@/lib/google-places';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('id');

    if (!placeId) {
      return NextResponse.json({ error: 'Place ID required' }, { status: 400 });
    }

    const sevenDaysAgo = new Date(Date.now() - CACHE_TTL_MS);

    // ── Cache hit: return stored details if fresh ──
    const cached = await prisma.cachedBusiness.findUnique({
      where: { placeId },
    });

    if (
      cached &&
      cached.detailsRefreshedAt &&
      cached.detailsRefreshedAt >= sevenDaysAgo
    ) {
      const cachedReviews = (cached.reviews as Record<string, unknown>[] | null) ?? [];
      return NextResponse.json({
        details: {
          id: cached.placeId,
          name: cached.name,
          address: cached.address,
          phone: cached.phone,
          website: cached.website,
          hasWebsite: cached.hasWebsite,
          category: cached.category,
          categoryTypes: cached.categoryTypes ?? [],
          location: null,
          rating: cached.rating,
          reviewCount: cached.reviewCount,
          status: null,
          description: cached.description,
          openingHours: cached.openingHours ?? [],
          hoursComplete: Array.isArray(cached.openingHours) && (cached.openingHours as unknown[]).length >= 7,
          lastReviewDate: cachedReviews.length > 0 ? (cachedReviews[0]?.time as string) || null : null,
          competitors: cached.competitors ?? [],
          reviews: cachedReviews,
          psiScore: cached.psiScore ?? undefined,
          psiDesktopScore: cached.psiDesktopScore ?? undefined,
        },
        cached: true,
      });
    }

    // ── Cache miss: fetch from Google ──
    const place = await getPlaceDetails(placeId);

    const displayName = place.displayName as Record<string, string> | undefined;
    const primaryType = place.primaryTypeDisplayName as Record<string, string> | undefined;
    const summary = place.editorialSummary as Record<string, string> | undefined;
    const hours = place.currentOpeningHours as Record<string, string[]> | undefined;

    const rawReviews = (place.reviews as Record<string, unknown>[] | undefined) || [];
    const reviews = rawReviews.slice(0, 4).map((r: Record<string, unknown>) => {
      const auth = r.authorAttribution as Record<string, string> | undefined;
      const text = r.text as Record<string, string> | undefined;
      return {
        author: auth?.displayName || 'Anonymous',
        rating: r.rating as number,
        text: text?.text || '',
        time: (r.relativePublishTimeDescription as string) || '',
      };
    });

    const weekdays = hours?.weekdayDescriptions || [];

    // Competitor detection: search same category nearby
    let competitors: string[] = [];
    const loc = place.location as { latitude: number; longitude: number } | undefined;
    const catDisplay = (primaryType?.text || 'Business') as string;
    if (loc) {
      try {
        const compData = await searchPlaces({
          query: catDisplay,
          lat: loc.latitude,
          lng: loc.longitude,
          radius: 2,
          maxPages: 1,
        });
        competitors = (compData.places as Record<string, unknown>[])
          .filter((p) => {
            const dn = p.displayName as Record<string, string> | undefined;
            return !!p.websiteUri && dn?.text && dn.text !== (displayName?.text || '');
          })
          .slice(0, 3)
          .map((p) => {
            const dn = p.displayName as Record<string, string> | undefined;
            return dn?.text || 'Unknown';
          });
      } catch {
        // competitor fetch is non-critical
      }
    }

    const details = {
      id: place.id,
      name: displayName?.text || 'Unknown Business',
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber,
      phoneIntl: place.internationalPhoneNumber,
      website: place.websiteUri,
      hasWebsite: !!place.websiteUri,
      category: primaryType?.text || 'Business',
      categoryTypes: place.types || [],
      location: place.location,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      status: place.businessStatus,
      description: summary?.text,
      openingHours: weekdays,
      hoursComplete: weekdays.length >= 7,
      lastReviewDate: reviews[0]?.time || null,
      competitors,
      reviews,
    };

    // ── Persist to CachedBusiness (upsert — creates row if not yet seen) ──
    void prisma.cachedBusiness.upsert({
      where: { placeId },
      create: {
        placeId,
        name: details.name,
        category: details.category,
        address: details.address,
        phone: details.phone as string | undefined,
        website: details.website as string | undefined,
        hasWebsite: details.hasWebsite,
        rating: details.rating as number | undefined,
        reviewCount: details.reviewCount as number | undefined,
        description: details.description,
        openingHours: weekdays as unknown as object[],
        categoryTypes: details.categoryTypes as unknown as object[],
        reviews: reviews as object[],
        competitors,
        detailsRefreshedAt: new Date(),
      },
      update: {
        name: details.name,
        category: details.category,
        address: details.address,
        phone: details.phone as string | undefined,
        website: details.website as string | undefined,
        hasWebsite: details.hasWebsite,
        rating: details.rating as number | undefined,
        reviewCount: details.reviewCount as number | undefined,
        description: details.description,
        openingHours: weekdays as unknown as object[],
        categoryTypes: details.categoryTypes as unknown as object[],
        reviews: reviews as object[],
        competitors,
        detailsRefreshedAt: new Date(),
      },
    }).catch(() => {});

    return NextResponse.json({ details, cached: false });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/details]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
