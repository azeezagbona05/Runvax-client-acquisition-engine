import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { searchPlaces } from '@/lib/google-places';
import { checkAndIncrementSearch } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, lat, lng, radius = 5 } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Use getToken (reads JWT cookie directly) — more reliable than getServerSession in App Router
    const token = await getToken({ req });
    const userId = (token?.id ?? token?.sub) as string | undefined;
    const isGuest = !userId;

    let resultsLimit = 20;
    let searchMeta: {
      searchesRemaining?: number;
      searchesUsed?: number;
      searchesLimit?: number;
      plan?: string;
    } = {};

    if (isGuest) {
      // Guest: allow 1 free preview search — 20 results, no tracking
      resultsLimit = 20;
    } else {
      // Authenticated: enforce daily search limit + plan result cap
      const usage = await checkAndIncrementSearch(req);
      if (!usage.ok) return usage.error!;
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

    const allBusinesses = (data.places || []).map((place: unknown) => {
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

    const businesses = resultsLimit === Infinity
      ? allBusinesses
      : allBusinesses.slice(0, resultsLimit);

    return NextResponse.json({
      businesses,
      total: businesses.length,
      isGuest,
      // Infinity can't survive JSON (becomes null) — send an explicit flag instead
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
