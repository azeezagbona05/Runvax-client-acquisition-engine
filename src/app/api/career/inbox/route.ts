import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { analyseEmail, matchApplications } from '@/lib/career/manage/classify';

export const dynamic = 'force-dynamic';

/**
 * POST { text }: read ONE employer email the candidate pasted and PROPOSE what it is. Saves nothing and stores nothing: the email text is
 * used for this request only. The candidate confirms through /api/career/responses.
 */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { text?: unknown };
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (text.length < 30) return NextResponse.json({ error: 'Paste the whole email (subject and body).' }, { status: 400 });
  const apps = await prisma.jobApplication.findMany({ where: { userId: u.userId, status: { in: ['applied', 'approved', 'prepared'] } }, include: { match: { include: { listing: { select: { title: true, company: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  const rows = apps.map((a) => ({ id: a.id, title: a.match.listing.title, company: a.match.listing.company, status: a.status }));
  const likely = matchApplications(text, rows);
  return NextResponse.json({ analysis: analyseEmail(text), applications: rows, likelyApplicationId: likely[0]?.id ?? null });
}
