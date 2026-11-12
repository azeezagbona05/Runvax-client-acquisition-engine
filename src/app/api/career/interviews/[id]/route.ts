import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { logEvent } from '@/lib/career/store';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** PATCH { status?, startsAt?, location?, notes?, kind? } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const i = await prisma.careerInterview.findFirst({ where: { id, userId: u.userId } }); if (!i) return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { status?: unknown; startsAt?: unknown; location?: unknown; notes?: unknown; kind?: unknown };
  const data: Record<string, unknown> = {};
  if (b.status !== undefined) { if (!['scheduled', 'done', 'cancelled'].includes(String(b.status))) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 }); data.status = b.status; }
  if (b.startsAt !== undefined) { const d = new Date(String(b.startsAt)); if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Choose a valid date and time.' }, { status: 400 }); data.startsAt = d; data.reminderSentAt = null; }
  if (b.location !== undefined) data.location = String(b.location).slice(0, 300);
  if (b.notes !== undefined) data.notes = String(b.notes).slice(0, 2000);
  if (b.kind !== undefined && ['phone', 'video', 'onsite', 'other'].includes(String(b.kind))) data.kind = b.kind;
  if (!Object.keys(data).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  await prisma.careerInterview.update({ where: { id }, data });
  await logEvent(u.userId, 'follow_up', b.status ? `interview_${b.status}` : 'interview_edited', `${i.title} at ${i.company}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const r = await prisma.careerInterview.deleteMany({ where: { id, userId: u.userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
}
