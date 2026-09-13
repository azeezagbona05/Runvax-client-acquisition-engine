import { searchPlaces } from '@/lib/google-places';
import { prisma } from '@/lib/prisma';

export interface AutoProspectCriteria {
  userId: string;
  industry: string;
  location: string;
  noWebsiteOnly?: boolean;
  minRating?: number;
}

export interface AutoProspectResult {
  found: number;
}

/**
 * Searches Google Places for one industry/location, filters against the
 * user's criteria, and saves any not-yet-seen businesses as prospects.
 * Shared by the manual "Run now" button and the autonomous daily cron so
 * both take the exact same path.
 */
export async function runAutoProspectSearch({
  userId, industry, location, noWebsiteOnly = true, minRating = 0,
}: AutoProspectCriteria): Promise<AutoProspectResult> {
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

  const filtered = mapped.filter((b) => {
    if (noWebsiteOnly && b.hasWebsite) return false;
    if (minRating > 0 && (b.rating ?? 0) < minRating) return false;
    return true;
  });

  if (filtered.length === 0) return { found: 0 };

  const existingIds = new Set(
    (await prisma.prospect.findMany({
      where: { userId, businessId: { in: filtered.map((b) => b.id) } },
      select: { businessId: true },
    })).map((p) => p.businessId),
  );

  const newOnes = filtered.filter((b) => !existingIds.has(b.id));
  if (newOnes.length === 0) return { found: 0 };

  await prisma.prospect.createMany({
    data: newOnes.map((b) => ({
      userId,
      businessId:   b.id,
      businessName: b.name,
      businessData: b as object,
      stage:        'found',
      source:       'auto-prospect',
    })),
    skipDuplicates: true,
  });

  return { found: newOnes.length };
}
