import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getIndustry } from './config/registry';
import { addManualProspect } from './imports/service';
import { placesActivation, buildTextSearchRequest } from './places/adapter';
import { usageToday } from './budget';
import { AdminActionError } from './admin';

/**
 * Discovery candidates: clinics a Places search found, held as place_id plus OUR
 * metadata only. A candidate has no website, phone or name on file, so it cannot
 * become a prospect until an admin supplies those from an INDEPENDENT source
 * (the clinic's own site, an association list, a referral), attested. That is
 * the step that joins the two discovery routes: Places finds, independent
 * sources identify.
 */

const STATUSES = ['pending_research', 'no_independent_source', 'promoted', 'excluded'] as const;

export async function discoveryOverview(userId: string, industryKey: string) {
  const industry = getIndustry(industryKey);
  if (!industry) throw new AdminActionError(`Unknown industry "${industryKey}"`);
  const gate = placesActivation();
  const usage = (await usageToday()).find((u) => u.provider === 'google_places');
  const grouped = await Promise.all(STATUSES.map(async (s) => [s, await prisma.acquisitionCandidate.count({ where: { userId, industryKey, status: s } })] as const));
  const plan = industry.geography.priorityAreas.flatMap((area) =>
    industry.discovery.placesQueries.map((_q, queryIndex) => ({ area, queryIndex, textQuery: buildTextSearchRequest(industry, area, queryIndex).textQuery })));
  return {
    industryKey,
    gate: { allowed: gate.allowed, reasons: gate.reasons },
    budget: { used: usage?.used ?? 0, cap: usage?.cap ?? 0, pausedUntil: usage?.pausedUntil ?? null },
    counts: Object.fromEntries(grouped) as Record<(typeof STATUSES)[number], number>,
    plan,
  };
}

export async function listCandidates(userId: string, params: { industryKey?: string; status?: string } = {}) {
  const where: Record<string, unknown> = { userId };
  if (params.industryKey) where.industryKey = params.industryKey;
  if (params.status && (STATUSES as readonly string[]).includes(params.status)) where.status = params.status;
  const items = await prisma.acquisitionCandidate.findMany({ where, orderBy: { discoveredAt: 'desc' }, take: 200 });
  return items.map((c: { id: string; industryKey: string; placeId: string; area: string | null; status: string; acqProspectId: string | null; discoveredAt: Date }) => ({
    id: c.id, industryKey: c.industryKey, placeId: c.placeId, area: c.area, status: c.status, acqProspectId: c.acqProspectId, discoveredAt: c.discoveredAt,
  }));
}

export const CandidateActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('exclude'), reason: z.string().trim().min(3).max(300) }),
  z.strictObject({
    action: z.literal('promote'),
    business_name: z.string().trim().min(2).max(200),
    website: z.string().trim().min(4).max(300),
    source: z.string().trim().min(2).max(200),
    source_url: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(320).optional(),
    // The two confirmations an admin must give: the data is lawfully obtained, and it did NOT come from Google Maps / Places.
    attest: z.literal(true),
    independentSource: z.literal(true),
  }),
]);

export async function actOnCandidate(userId: string, actor: string, id: string, body: unknown) {
  const a = CandidateActionSchema.parse(body);
  const c = await prisma.acquisitionCandidate.findFirst({ where: { id, userId } });
  if (!c) throw new AdminActionError('Candidate not found');
  if (c.status === 'promoted') throw new AdminActionError('This candidate is already a prospect');

  if (a.action === 'exclude') {
    await prisma.acquisitionCandidate.update({ where: { id: c.id }, data: { status: 'excluded' } });
    return { ok: true as const, status: 'excluded' };
  }

  const industry = getIndustry(c.industryKey);
  if (!industry) throw new AdminActionError('Unknown industry');
  if (c.status === 'excluded') throw new AdminActionError('This candidate was excluded; it cannot be promoted');
  if (/google|maps|places/i.test(`${a.source} ${a.source_url ?? ''}`)) throw new AdminActionError('The source must be independent of Google Maps / Places');

  const row: Record<string, string> = {
    business_name: a.business_name, website: a.website, source: a.source, place_id: c.placeId,
    area: c.area ?? '', city: industry.geography.city,
  };
  if (a.source_url) row.source_url = a.source_url;
  if (a.phone) row.phone = a.phone;
  if (a.email) row.email = a.email;
  const res = await addManualProspect({ userId, industryKey: c.industryKey, row, attestedBy: actor, attest: true });
  const created = res.committed?.acqProspectIds?.[0];
  if (!created) {
    const why = res.preview.results?.[0];
    return { ok: false as const, outcome: why?.outcome ?? 'rejected', reasons: why?.reasons ?? [] };
  }
  await prisma.acquisitionCandidate.update({ where: { id: c.id }, data: { status: 'promoted', acqProspectId: created } });
  return { ok: true as const, status: 'promoted', acqProspectId: created };
}
