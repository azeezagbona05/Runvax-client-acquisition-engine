import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { logEvent } from '@/lib/career/store';

export const dynamic = 'force-dynamic';

/** PATCH { status: 'new' | 'saved' | 'dismissed' }: the candidate's own triage. Scoped to their user id. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({})) as { status?: unknown };
  if (b.status !== 'new' && b.status !== 'saved' && b.status !== 'dismissed') return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  const m = await prisma.jobMatch.findFirst({ where: { id, userId: u.userId }, include: { listing: { select: { title: true, company: true } } } });
  if (!m) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  await prisma.jobMatch.update({ where: { id }, data: { status: b.status } });
  await logEvent(u.userId, 'job_matching', `job_${b.status}`, `${m.listing.title} at ${m.listing.company}`);
  return NextResponse.json({ ok: true });
}
