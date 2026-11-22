import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer } from '@/lib/career/store';
import { SOURCE_LABEL } from '@/lib/career/jobs/sources';

export const dynamic = 'force-dynamic';
const ORDER = {
  score: [{ score: 'desc' as const }, { createdAt: 'desc' as const }],
  new: [{ createdAt: 'desc' as const }, { score: 'desc' as const }],
  title: [{ listing: { title: 'asc' as const } }, { score: 'desc' as const }],
  company: [{ listing: { company: 'asc' as const } }, { score: 'desc' as const }],
};
const VIEWS = ['matches', 'saved', 'all', 'dismissed'] as const;

/**
 * GET: the user's own discovered jobs. Every job a search found is saved, so this is the full list.
 *   view   matches (at or above their minimum score, default) | saved | all (not dismissed) | dismissed
 *   q      words in the title, company or location   source  one source
 *   remote 1 = remote only, 0 = on-site only        minScore  only matches at or above this percent
 *   sort   score (default) | new | title | company
 *   offset / limit (default 30, at most 60)
 */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const sp = new URL(req.url).searchParams;
  const view = (VIEWS as readonly string[]).includes(sp.get('view') ?? '') ? sp.get('view')! : 'matches';
  const q = (sp.get('q') ?? '').trim().slice(0, 80); const source = (sp.get('source') ?? '').trim();
  const sortParam = sp.get('sort') ?? 'score'; const sort = (['score', 'new', 'title', 'company'] as const).find((x) => x === sortParam) ?? 'score';
  const remote = sp.get('remote') === '1' ? true : sp.get('remote') === '0' ? false : undefined;
  const minScore = Math.min(100, Math.max(0, Number(sp.get('minScore')) || 0));
  const offset = Math.max(0, Number(sp.get('offset')) || 0); const limit = Math.min(60, Math.max(1, Number(sp.get('limit')) || 30));
  const c = await loadCareer(u.userId);

  const status = view === 'saved' ? { status: 'saved' } : view === 'dismissed' ? { status: 'dismissed' } : { status: { not: 'dismissed' } };
  const listing = { ...(source && SOURCE_LABEL[source] ? { source } : {}), ...(remote !== undefined ? { remote } : {}), ...(q ? { OR: [{ title: { contains: q } }, { company: { contains: q } }, { location: { contains: q } }] } : {}) };
  const where = { userId: u.userId, ...status, ...(view === 'matches' || minScore ? { score: { gte: Math.max(minScore, view === 'matches' ? c.discovery.minScore : 0) } } : {}), ...(Object.keys(listing).length ? { listing } : {}) };

  const [rows, total, discovered, matched, bySource] = await Promise.all([
    prisma.jobMatch.findMany({ where, orderBy: ORDER[sort], skip: offset, take: limit, include: { listing: true, application: { select: { status: true } } } }),
    prisma.jobMatch.count({ where }),
    prisma.jobListing.count({ where: { userId: u.userId } }),
    prisma.jobMatch.count({ where: { userId: u.userId, status: { not: 'dismissed' }, score: { gte: c.discovery.minScore } } }),
    prisma.jobListing.groupBy({ by: ['source'], where: { userId: u.userId }, _count: true }),
  ]);
  return NextResponse.json({
    discovered, matched, minScore: c.discovery.minScore, total, offset, limit,
    sources: bySource.map((s) => ({ id: s.source, label: SOURCE_LABEL[s.source] ?? s.source, count: s._count })),
    jobs: rows.map((m) => ({ id: m.id, score: m.score, reasons: m.reasons as string[], status: m.status, applicationStatus: m.application?.status ?? null, title: m.listing.title, company: m.listing.company, location: m.listing.location, remote: m.listing.remote, url: m.listing.url, source: SOURCE_LABEL[m.listing.source] ?? m.listing.source, sourceId: m.listing.source, postedAt: m.listing.postedAt, foundAt: m.createdAt })),
  });
}
