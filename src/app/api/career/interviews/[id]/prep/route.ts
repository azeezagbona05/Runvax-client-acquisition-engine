import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { loadCareer, logEvent } from '@/lib/career/store';
import { prepInterview } from '@/lib/career/manage/coach';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST: interview preparation built from the candidate's confirmed profile and the job text. Saved on the interview so it is there next time. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const i = await prisma.careerInterview.findFirst({ where: { id, userId: u.userId }, include: { application: { include: { match: { include: { listing: { select: { description: true } } } } } } } });
  if (!i) return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
  const c = await loadCareer(u.userId);
  if (!c.profile || !c.profileConfirmed) return NextResponse.json({ error: 'Confirm your profile first. Preparation is only built from a confirmed profile.' }, { status: 400 });
  if (!rateLimit(`career-coach:${u.userId}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'That is a lot of preparation in an hour. Try again later.' }, { status: 429 });
  const prep = await prepInterview(c.profile, { title: i.title, company: i.company, description: i.application?.match.listing.description ?? `${i.title} at ${i.company}. ${i.notes}` });
  await prisma.careerInterview.update({ where: { id }, data: { prep: prep as object } });
  await logEvent(u.userId, 'interview_coach', 'prep_written', `${i.title} at ${i.company} (${prep.source === 'ai' ? 'AI' : 'basic'} coach)`);
  return NextResponse.json({ prep });
}
