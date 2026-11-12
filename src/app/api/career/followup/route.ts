import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer } from '@/lib/career/store';
import { followUpDraft } from '@/lib/career/manage/reminders';

export const dynamic = 'force-dynamic';

/** POST { applicationId }: a short follow-up note for the candidate to send themselves. The agent never emails an employer. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { applicationId?: unknown };
  const a = typeof b.applicationId === 'string' ? await prisma.jobApplication.findFirst({ where: { id: b.applicationId, userId: u.userId, status: 'applied' }, include: { match: { include: { listing: { select: { title: true, company: true } } } }, responses: { where: { kind: 'followed_up' }, select: { id: true } } } }) : null;
  if (!a || !a.appliedAt) return NextResponse.json({ error: 'Only applications you marked as applied can be followed up.' }, { status: 404 });
  const c = await loadCareer(u.userId);
  return NextResponse.json({ draft: followUpDraft({ name: c.profile?.name ?? '' }, a.match.listing, a.appliedAt, a.responses.length) });
}
