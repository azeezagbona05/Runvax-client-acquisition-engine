import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { EMPLOYER_KINDS } from '@/lib/career/manage/classify';

export const dynamic = 'force-dynamic';

/**
 * Pilot report: per Career Agent user, only COUNTS (no CV text, no job content, no emails of employers). Answers: are relevant jobs found,
 * are applications sent, do employers reply, and how much AI writing each user costs.
 */
export async function GET() {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  try {
    const prefs = await prisma.careerPreference.findMany({ select: { userId: true, status: true, deployedAt: true, user: { select: { email: true } } }, orderBy: { updatedAt: 'desc' }, take: 200 });
    const ids = prefs.map((p) => p.userId);
    const [listings, matches, apps, resp, ivs, events, ai] = await Promise.all([
      prisma.jobListing.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: true }),
      prisma.jobMatch.groupBy({ by: ['userId'], where: { userId: { in: ids }, score: { gte: 75 } }, _count: true }),
      prisma.jobApplication.groupBy({ by: ['userId', 'status'], where: { userId: { in: ids } }, _count: true }),
      prisma.careerResponse.groupBy({ by: ['userId', 'kind'], where: { userId: { in: ids } }, _count: true }),
      prisma.careerInterview.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: true }),
      prisma.careerAgentEvent.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: true, _max: { createdAt: true } }),
      prisma.careerAgentEvent.groupBy({ by: ['userId'], where: { userId: { in: ids }, OR: [{ detail: { contains: '(AI writer)' } }, { detail: { contains: '(AI reader)' } }, { detail: { contains: '(AI coach)' } }, { detail: { contains: '(AI)' } }] }, _count: true }),
    ]);
    const n = <T extends { userId: string; _count: number }>(rows: T[], id: string, f: (r: T) => boolean = () => true) => rows.filter((r) => r.userId === id && f(r)).reduce((a, r) => a + r._count, 0);
    const users = prefs.map((p) => {
      const applied = n(apps as Array<{ userId: string; status: string; _count: number }>, p.userId, (r) => r.status === 'applied');
      const replies = n(resp as Array<{ userId: string; kind: string; _count: number }>, p.userId, (r) => EMPLOYER_KINDS.includes(r.kind as never));
      return { email: p.user.email, status: p.status, deployedAt: p.deployedAt, jobsFound: n(listings, p.userId), matched: n(matches, p.userId), prepared: n(apps, p.userId), applied, replies, interviews: n(ivs, p.userId), aiWrites: n(ai, p.userId), actions: n(events, p.userId), lastActive: events.find((e) => e.userId === p.userId)?._max.createdAt ?? null };
    });
    const sum = (k: 'jobsFound' | 'matched' | 'prepared' | 'applied' | 'replies' | 'interviews' | 'aiWrites') => users.reduce((a, u) => a + u[k], 0);
    return NextResponse.json({ totals: { users: users.length, active: users.filter((u) => u.status === 'active').length, jobsFound: sum('jobsFound'), matched: sum('matched'), prepared: sum('prepared'), applied: sum('applied'), replies: sum('replies'), interviews: sum('interviews'), aiWrites: sum('aiWrites') }, users });
  } catch (e) { console.error('[admin/career-pilot]', e); return NextResponse.json({ error: 'The Career pilot report is unavailable. Have migrations 16 to 19 been applied?' }, { status: 503 }); }
}
