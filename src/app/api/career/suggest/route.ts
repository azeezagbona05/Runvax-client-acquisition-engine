import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { logEvent } from '@/lib/career/store';
import { suggestSetup } from '@/lib/career/suggest';
import { sanitizeProfile } from '@/lib/career/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST: propose the rest of the setup from the candidate's uploaded CV. Saves nothing: the wizard shows it and the candidate edits and saves. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`career-suggest:${u.userId}`, { maxRequests: 12, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'That is a lot of suggestions in an hour. Try again later.' }, { status: 429 });
  const [prof, doc] = await Promise.all([prisma.careerProfile.findUnique({ where: { userId: u.userId } }), prisma.careerDocument.findFirst({ where: { userId: u.userId, kind: 'uploaded' }, orderBy: { createdAt: 'desc' }, select: { text: true } })]);
  if (!prof) return NextResponse.json({ error: 'Upload your CV first.' }, { status: 400 });
  const s = await suggestSetup(sanitizeProfile(prof.profile), doc?.text ?? '');
  await logEvent(u.userId, 'orchestrator', 'setup_suggested', `Suggested ${s.preferences.titles.length} title(s), level ${s.preferences.level}${s.source === 'ai' ? ' (AI)' : ''}`);
  return NextResponse.json({ suggestion: s });
}
