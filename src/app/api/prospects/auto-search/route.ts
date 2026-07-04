import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchPlaces } from '@/lib/google-places';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { industry, location, noWebsiteOnly = true, minRating = 0 } = await req.json() as {
      industry: string;
      location: string;
      noWebsiteOnly?: boolean;
      minRating?: number;
    };

    if (!industry?.trim() || !location?.trim()) {
      return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 });
    }

    const query = `${industry.trim()} in ${location.trim()}`;
    const data = await searchPlaces({ query, radius: 10, maxPages: 1 });

    const places = (data.places ?? []) as Array<Record<string, unknown>>;

    const mapped = places.map((p) => {
      const displayName = p.displayName as Record<string, string> | undefined;
      const primaryType = p.primaryTypeDisplayName as Record<string, string> | undefined;
      const loc = p.location as { latitude: number; longitude: number } | undefined;
      return {
        id: p.id as string,
        name: displayName?.text ?? 'Unknown Business',
        address: (p.formattedAddress as string) ?? '',
        phone: p.nationalPhoneNumber as string | undefined,
        website: p.websiteUri as string | undefined,
        hasWebsite: !!p.websiteUri,
        category: primaryType?.text ?? industry,
        location: loc,
        rating: p.rating as number | undefined,
        reviewCount: p.userRatingCount as number | undefined,
      };
    });

    // Apply user filters
    const filtered = mapped.filter((b) => {
      if (noWebsiteOnly && b.hasWebsite) return false;
      if (minRating > 0 && (b.rating ?? 0) < minRating) return false;
      return true;
    });

    if (filtered.length === 0) {
      return NextResponse.json({ found: 0 });
    }

    // Find which businessIds are already saved for this user
    const existingIds = new Set(
      (await prisma.prospect.findMany({
        where: { userId: session.user.id, businessId: { in: filtered.map((b) => b.id) } },
        select: { businessId: true },
      })).map((p) => p.businessId)
    );

    const newOnes = filtered.filter((b) => !existingIds.has(b.id));
    if (newOnes.length === 0) {
      return NextResponse.json({ found: 0 });
    }

    // Save new prospects with source = 'auto-prospect'
    await prisma.prospect.createMany({
      data: newOnes.map((b) => ({
        userId:       session.user.id,
        businessId:   b.id,
        businessName: b.name,
        businessData: b as object,
        stage:        'found',
        source:       'auto-prospect',
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ found: newOnes.length });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/prospects/auto-search]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
