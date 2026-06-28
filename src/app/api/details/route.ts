import { NextRequest, NextResponse } from 'next/server';
import { getPlaceDetails } from '@/lib/google-places';

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
      openingHours: hours?.weekdayDescriptions || [],
      reviews: ((place.reviews as Record<string, unknown>[] | undefined) || [])
        .slice(0, 4)
        .map((r: Record<string, unknown>) => {
          const auth = r.authorAttribution as Record<string, string> | undefined;
          const text = r.text as Record<string, string> | undefined;
          return {
            author: auth?.displayName || 'Anonymous',
            rating: r.rating,
            text: text?.text || '',
            time: r.relativePublishTimeDescription || '',
          };
        }),
    };

    return NextResponse.json({ details });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/details]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
