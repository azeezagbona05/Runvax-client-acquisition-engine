import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer } from '@/lib/career/store';
import { SOURCE_LABEL } from '@/lib/career/jobs/sources';

export const dynamic = 'force-dynamic';

/** GET ?view=matches|saved|all: the user's own discovered jobs, best first. `matches` hides anything under their minimum score and anything dismissed. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const view = new URL(req.url).searchParams.get('view') ?? 'matches';
  const c = await loadCareer(u.userId);
  const where = { userId: u.userId, ...(view === 'saved' ? { status: 'saved' } : view === 'all' ? { status: { not: 'dismissed' } } : { status: { not: 'dismissed' }, score: { gte: c.discovery.minScore } }) };
  const [rows, discovered, matched] = await Promise.all([
    prisma.jobMatch.findMany({ where, orderBy: [{ score: 'desc' }, { createdAt: 'desc' }], take: 100, include: { listing: true, application: { select: { status: true } } } }),
    prisma.jobListing.count({ where: { userId: u.userId } }),
    prisma.jobMatch.count({ where: { userId: u.userId, status: { not: 'dismissed' }, score: { gte: c.discovery.minScore } } }),
  ]);
  return NextResponse.json({
    discovered, matched, minScore: c.discovery.minScore,
    jobs: rows.map((m) => ({ id: m.id, score: m.score, reasons: m.reasons as string[], status: m.status, applicationStatus: m.application?.status ?? null, title: m.listing.title, company: m.listing.company, location: m.listing.location, remote: m.listing.remote, url: m.listing.url, source: SOURCE_LABEL[m.listing.source] ?? m.listing.source, postedAt: m.listing.postedAt, foundAt: m.createdAt })),
  });
}
