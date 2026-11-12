import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { logEvent } from '@/lib/career/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const rows = await prisma.careerInterview.findMany({ where: { userId: u.userId }, orderBy: { startsAt: 'asc' }, take: 100 });
  return NextResponse.json({ interviews: rows });
}

/** POST { company, title, startsAt, kind?, location?, notes?, applicationId? }: add an interview by hand. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { company?: unknown; title?: unknown; startsAt?: unknown; kind?: unknown; location?: unknown; notes?: unknown; applicationId?: unknown };
  const company = String(b.company ?? '').trim().slice(0, 160), title = String(b.title ?? '').trim().slice(0, 200); const at = new Date(String(b.startsAt ?? ''));
  if (!company || !title) return NextResponse.json({ error: 'Add the company and the role.' }, { status: 400 });
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: 'Choose a valid date and time.' }, { status: 400 });
  let applicationId: string | null = null;
  if (typeof b.applicationId === 'string' && b.applicationId) { const a = await prisma.jobApplication.findFirst({ where: { id: b.applicationId, userId: u.userId }, select: { id: true } }); if (!a) return NextResponse.json({ error: 'Application not found.' }, { status: 404 }); applicationId = a.id; }
  if ((await prisma.careerInterview.count({ where: { userId: u.userId } })) >= 200) return NextResponse.json({ error: 'That is a lot of interviews. Delete old ones first.' }, { status: 400 });
  const i = await prisma.careerInterview.create({ data: { userId: u.userId, applicationId, company, title, startsAt: at, kind: ['phone', 'video', 'onsite'].includes(String(b.kind)) ? String(b.kind) : 'other', location: String(b.location ?? '').slice(0, 300), notes: String(b.notes ?? '').slice(0, 2000) } });
  await logEvent(u.userId, 'follow_up', 'interview_added', `${title} at ${company}`);
  return NextResponse.json({ interview: i }, { status: 201 });
}
