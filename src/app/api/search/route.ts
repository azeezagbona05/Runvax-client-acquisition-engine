import { NextRequest, NextResponse } from 'next/server';
import { searchPlaces } from '@/lib/google-places';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, lat, lng, radius = 5 } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const data = await searchPlaces({ query, lat, lng, radius });

    const businesses = (data.places || []).map((place: unknown) => {
      const p = place as Record<string, unknown>;
      const displayName = p.displayName as Record<string, string> | undefined;
      const primaryType = p.primaryTypeDisplayName as Record<string, string> | undefined;
      const location = p.location as { latitude: number; longitude: number } | undefined;
      return {
        id: p.id,
        name: displayName?.text || 'Unknown Business',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber,
        phoneIntl: p.internationalPhoneNumber,
        website: p.websiteUri,
        hasWebsite: !!p.websiteUri,
        category: primaryType?.text || 'Business',
        location,
        rating: p.rating,
        reviewCount: p.userRatingCount,
        status: p.businessStatus,
      };
    });

    return NextResponse.json({ businesses, total: businesses.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/search]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
