import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { CV_MAX_BYTES, cvToText } from '@/lib/career/cvText';
import { parseCv } from '@/lib/career/parse';
import { loadCareer, logEvent } from '@/lib/career/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST multipart { file }: read a PDF/DOCX CV and build a draft profile. The profile stays unconfirmed until the candidate reviews it. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const rl = rateLimit(`career-cv:${u.userId}`, { maxRequests: 8, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'You have uploaded several CVs in the last hour. Please try again later.' }, { status: 429 });
  const f = await req.formData().catch(() => null); const file = f?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a CV file to upload.' }, { status: 400 });
  if (file.size > CV_MAX_BYTES) return NextResponse.json({ error: 'That file is over 4 MB. Export a smaller PDF or Word file.' }, { status: 400 });
  try {
    const { text, mime } = await cvToText(file.name, new Uint8Array(await file.arrayBuffer()));
    const r = await parseCv(text);
    await prisma.careerDocument.create({ data: { userId: u.userId, kind: 'uploaded', name: file.name.slice(0, 200), mime, text, chars: text.length } });
    // What was read from the CV is kept untouched, so edits, rewrites and suggestions can always be reverted to it.
    await prisma.careerDocument.deleteMany({ where: { userId: u.userId, kind: 'baseline' } });
    await prisma.careerDocument.create({ data: { userId: u.userId, kind: 'baseline', name: 'Read from CV', mime: 'application/json', text: JSON.stringify(r.profile), chars: 0 } });
    await prisma.careerProfile.upsert({ where: { userId: u.userId }, create: { userId: u.userId, profile: r.profile as object, source: r.source }, update: { profile: r.profile as object, source: r.source, confirmedAt: null } });
    await logEvent(u.userId, 'cv_intelligence', 'cv_parsed', `${file.name}: ${r.profile.experience.length} roles, ${r.profile.skills.length} skills (${r.source === 'ai' ? 'AI reader' : 'basic reader'})${r.removed.length ? `; ${r.removed.length} unsupported item(s) dropped` : ''}`);
    return NextResponse.json({ ...(await loadCareer(u.userId)), note: r.note, removed: r.removed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'That file could not be read.';
    await logEvent(u.userId, 'cv_intelligence', 'cv_failed', msg, false);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
