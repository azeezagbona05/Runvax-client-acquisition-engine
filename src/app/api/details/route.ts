import { NextRequest, NextResponse } from 'next/server';
import { getPlaceDetails, searchPlaces } from '@/lib/google-places';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('id');

    if (!placeId) {
      return NextResponse.json({ error: 'Place ID required' }, { status: 400 });
    }

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

    // Competitor detection: search same category nearby, find ones WITH websites
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
        // competitor fetch is non-critical — ignore errors
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

    return NextResponse.json({ details });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/details]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
