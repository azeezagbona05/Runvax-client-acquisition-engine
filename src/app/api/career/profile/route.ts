import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer, logEvent } from '@/lib/career/store';
import { sanitizeProfile } from '@/lib/career/types';

export const dynamic = 'force-dynamic';

/** PUT { profile, confirm? }: the candidate's own edits. `confirm: true` marks the profile as verified; any later edit un-confirms it. */
export async function PUT(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { profile?: unknown; confirm?: unknown };
  const cur = await prisma.careerProfile.findUnique({ where: { userId: u.userId } });
  if (!cur) return NextResponse.json({ error: 'Upload your CV first.' }, { status: 400 });
  const profile = b.profile !== undefined ? sanitizeProfile(b.profile) : sanitizeProfile(cur.profile);
  if (b.confirm === true && !profile.experience.length && !profile.education.length && !profile.skills.length) return NextResponse.json({ error: 'The profile is empty. Add at least your experience, education or skills before confirming.' }, { status: 400 });
  const edited = b.profile !== undefined;
  await prisma.careerProfile.update({ where: { userId: u.userId }, data: { profile: profile as object, source: edited ? 'manual' : cur.source, confirmedAt: b.confirm === true ? new Date() : edited ? null : cur.confirmedAt } });
  await logEvent(u.userId, 'cv_intelligence', b.confirm === true ? 'profile_confirmed' : 'profile_edited', b.confirm === true ? 'Candidate confirmed the profile as accurate' : 'Candidate edited the profile');
  return NextResponse.json(await loadCareer(u.userId));
}
