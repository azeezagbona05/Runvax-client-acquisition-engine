import { searchPlaces } from '@/lib/google-places';
import { prisma } from '@/lib/prisma';

export interface AutoProspectCriteria {
  userId: string;
  industry: string;
  location: string;
  noWebsiteOnly?: boolean;
  minRating?: number;
  /** Tags imported prospects as belonging to a campaign. */
  campaignId?: string;
  /** Import at most this many new prospects. */
  limit?: number;
}

export interface AutoProspectResult {
  found: number;
  /** Ids of the prospects created by this run. */
  prospectIds: string[];
}

/**
 * Searches Google Places for one industry/location, filters against the
 * user's criteria, and saves any not-yet-seen businesses as prospects.
 * Shared by the manual "Run now" button and the autonomous daily cron so
 * both take the exact same path.
 */
export async function runAutoProspectSearch({
  userId, industry, location, noWebsiteOnly = true, minRating = 0, campaignId, limit,
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

  if (filtered.length === 0) return { found: 0, prospectIds: [] };

  const existingIds = new Set(
    (await prisma.prospect.findMany({
      where: { userId, businessId: { in: filtered.map((b) => b.id) } },
      select: { businessId: true },
    })).map((p) => p.businessId),
  );

  const newOnes = filtered.filter((b) => !existingIds.has(b.id)).slice(0, limit ?? Infinity);
  if (newOnes.length === 0) return { found: 0, prospectIds: [] };

  await prisma.prospect.createMany({
    data: newOnes.map((b) => ({
      userId,
      businessId:   b.id,
      businessName: b.name,
      businessData: b as object,
      stage:        'found',
      source:       campaignId ? 'campaign' : 'auto-prospect',
      campaignId:   campaignId ?? null,
    })),
    skipDuplicates: true,
  });

  const created = await prisma.prospect.findMany({
    where: { userId, businessId: { in: newOnes.map((b) => b.id) } },
    select: { id: true },
  });

  return { found: newOnes.length, prospectIds: created.map((p) => p.id) };
}
