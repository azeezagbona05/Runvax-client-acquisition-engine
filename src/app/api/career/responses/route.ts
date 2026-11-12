import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { logEvent } from '@/lib/career/store';
import { KIND_LABEL, RESPONSE_KINDS, type ResponseKind } from '@/lib/career/manage/classify';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const rows = await prisma.careerResponse.findMany({ where: { userId: u.userId }, orderBy: { receivedAt: 'desc' }, take: 100, include: { application: { include: { match: { include: { listing: { select: { title: true, company: true } } } } } } } });
  return NextResponse.json({ responses: rows.map((r) => ({ id: r.id, applicationId: r.applicationId, kind: r.kind, label: KIND_LABEL[r.kind as ResponseKind] ?? r.kind, subject: r.subject, summary: r.summary, receivedAt: r.receivedAt, title: r.application.match.listing.title, company: r.application.match.listing.company })) });
}

/**
 * POST { applicationId, kind, subject?, summary?, receivedAt?, interview?: { startsAt, kind?, location?, notes? } }: the candidate confirms what a reply was.
 * Only the short summary is kept. The application must be one the candidate marked as applied, so replies are never attached to work that was not sent.
 */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { applicationId?: unknown; kind?: unknown; subject?: unknown; summary?: unknown; receivedAt?: unknown; interview?: { startsAt?: unknown; kind?: unknown; location?: unknown; notes?: unknown } };
  if (typeof b.applicationId !== 'string') return NextResponse.json({ error: 'Choose which application this is about.' }, { status: 400 });
  if (!RESPONSE_KINDS.includes(b.kind as ResponseKind)) return NextResponse.json({ error: 'Choose what kind of reply it is.' }, { status: 400 });
  const a = await prisma.jobApplication.findFirst({ where: { id: b.applicationId, userId: u.userId }, include: { match: { include: { listing: { select: { title: true, company: true } } } } } });
  if (!a) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (a.status !== 'applied') return NextResponse.json({ error: 'Mark this application as applied first. Replies are only logged against applications you sent.' }, { status: 400 });
  const at = typeof b.receivedAt === 'string' ? new Date(b.receivedAt) : new Date();
  if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 86_400_000) return NextResponse.json({ error: 'That date does not look right.' }, { status: 400 });
  const kind = b.kind as ResponseKind;
  let iv: Date | null = null;
  if (kind === 'interview' && b.interview?.startsAt !== undefined && b.interview.startsAt !== '') { iv = new Date(String(b.interview.startsAt)); if (Number.isNaN(iv.getTime())) return NextResponse.json({ error: 'The interview date does not look right.' }, { status: 400 }); }
  const label = `${a.match.listing.title} at ${a.match.listing.company}`;
  const [r] = await prisma.$transaction([
    prisma.careerResponse.create({ data: { userId: u.userId, applicationId: a.id, kind, subject: String(b.subject ?? '').slice(0, 200), summary: String(b.summary ?? '').slice(0, 600), receivedAt: at } }),
    ...(iv ? [prisma.careerInterview.create({ data: { userId: u.userId, applicationId: a.id, company: a.match.listing.company, title: a.match.listing.title, kind: ['phone', 'video', 'onsite'].includes(String(b.interview?.kind)) ? String(b.interview?.kind) : 'other', startsAt: iv, location: String(b.interview?.location ?? '').slice(0, 300), notes: String(b.interview?.notes ?? '').slice(0, 2000) } })] : []),
  ]);
  await logEvent(u.userId, 'follow_up', kind === 'followed_up' ? 'follow_up_sent' : 'response_logged', `${KIND_LABEL[kind]}: ${label}${iv ? ` (interview ${iv.toISOString().slice(0, 16).replace('T', ' ')})` : ''}`);
  return NextResponse.json({ id: r.id, interviewCreated: !!iv });
}
