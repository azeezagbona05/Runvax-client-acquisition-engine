import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer } from '@/lib/career/store';
import { recommend } from '@/lib/career/manage/recommend';
import { EMPLOYER_KINDS } from '@/lib/career/manage/classify';
import { accessFor } from '@/lib/career/jobs/match';

export const dynamic = 'force-dynamic';

/** GET: this week's recommendations, worked out from the candidate's own matches, applications and replies. Read-only. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const c = await loadCareer(u.userId); if (!c.profile) return NextResponse.json({ recommendations: [] });
  const week = new Date(Date.now() - 7 * 86400_000);
  const [matches, applied, waiting, last7] = await Promise.all([
    prisma.jobMatch.findMany({ where: { userId: u.userId, status: { not: 'dismissed' } }, orderBy: { createdAt: 'desc' }, take: 200, select: { score: true, listing: { select: { title: true, description: true, location: true, remote: true } } } }),
    prisma.jobApplication.findMany({ where: { userId: u.userId, status: 'applied' }, select: { responses: { select: { kind: true } } } }),
    prisma.jobApplication.count({ where: { userId: u.userId, status: 'prepared' } }),
    prisma.jobApplication.count({ where: { userId: u.userId, status: 'applied', appliedAt: { gte: week } } }),
  ]);
  const { country, locations } = c.preferences;
  const jobs = matches.map((m) => ({ title: m.listing.title, text: `${m.listing.title}\n${m.listing.description}`, score: m.score, restricted: accessFor({ location: m.listing.location, remote: m.listing.remote }, country, locations).access === 'restricted' }));
  const replied = applied.filter((a) => a.responses.some((r) => EMPLOYER_KINDS.includes(r.kind as never))).length;
  return NextResponse.json({ recommendations: recommend({ profile: c.profile, titles: c.preferences.titles, minScore: c.discovery.minScore, jobs, applied: applied.length, replied, waitingApprovals: waiting, appliedLast7Days: last7 }) });
}
