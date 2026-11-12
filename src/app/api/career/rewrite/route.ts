import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { logEvent } from '@/lib/career/store';
import { rewriteField, type RewriteKind } from '@/lib/career/rewrite';
import { profileText } from '@/lib/career/tailor';
import { sanitizeProfile } from '@/lib/career/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST { kind: 'summary' | 'headline' | 'bullets', text }: a wording-only rewrite of one field, checked against the candidate's CV. Saves nothing. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`career-rewrite:${u.userId}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'That is a lot of rewrites in an hour. Try again later.' }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { kind?: unknown; text?: unknown };
  if (b.kind !== 'summary' && b.kind !== 'headline' && b.kind !== 'bullets') return NextResponse.json({ error: 'Unknown field.' }, { status: 400 });
  if (typeof b.text !== 'string') return NextResponse.json({ error: 'Nothing to rewrite.' }, { status: 400 });
  const [prof, doc, base] = await Promise.all([
    prisma.careerProfile.findUnique({ where: { userId: u.userId } }),
    prisma.careerDocument.findFirst({ where: { userId: u.userId, kind: 'uploaded' }, orderBy: { createdAt: 'desc' }, select: { text: true } }),
    prisma.careerDocument.findFirst({ where: { userId: u.userId, kind: 'baseline' }, orderBy: { createdAt: 'desc' }, select: { text: true } }),
  ]);
  if (!prof) return NextResponse.json({ error: 'Upload your CV first.' }, { status: 400 });
  // Evidence = the CV text itself plus what the candidate has confirmed/entered, so their own additions can be reworded too.
  const evidence = `${doc?.text ?? ''}\n${profileText(sanitizeProfile(prof.profile))}\n${base?.text ?? ''}`;
  const r = await rewriteField(b.kind as RewriteKind, b.text, evidence);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logEvent(u.userId, 'cv_intelligence', 'field_rewritten', `Rewrote the ${b.kind} with AI (candidate can revert)`);
  return NextResponse.json({ text: r.text });
}
