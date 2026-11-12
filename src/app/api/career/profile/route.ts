import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer, logEvent } from '@/lib/career/store';
import { sanitizeProfile } from '@/lib/career/types';

export const dynamic = 'force-dynamic';

/** PUT { profile, confirm? }: the candidate's own edits. `confirm: true` marks the profile as verified; any later edit un-confirms it. */
export async function PUT(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { profile?: unknown; confirm?: unknown; revert?: unknown };
  const cur = await prisma.careerProfile.findUnique({ where: { userId: u.userId } });
  if (!cur) return NextResponse.json({ error: 'Upload your CV first.' }, { status: 400 });
  if (b.revert === true) {
    const base = await prisma.careerDocument.findFirst({ where: { userId: u.userId, kind: 'baseline' }, orderBy: { createdAt: 'desc' }, select: { text: true } });
    let original: ReturnType<typeof sanitizeProfile> | null = null; try { original = base ? sanitizeProfile(JSON.parse(base.text)) : null; } catch { original = null; }
    if (!original) return NextResponse.json({ error: 'There is no original CV version to go back to. Upload your CV again.' }, { status: 400 });
    await prisma.careerProfile.update({ where: { userId: u.userId }, data: { profile: original as object, confirmedAt: null } });
    await logEvent(u.userId, 'cv_intelligence', 'profile_reverted', 'Candidate went back to the version read from the CV');
    return NextResponse.json(await loadCareer(u.userId));
  }
  const profile = b.profile !== undefined ? sanitizeProfile(b.profile) : sanitizeProfile(cur.profile);
  if (b.confirm === true && !profile.experience.length && !profile.education.length && !profile.skills.length) return NextResponse.json({ error: 'The profile is empty. Add at least your experience, education or skills before confirming.' }, { status: 400 });
  const edited = b.profile !== undefined;
  await prisma.careerProfile.update({ where: { userId: u.userId }, data: { profile: profile as object, source: edited ? 'manual' : cur.source, confirmedAt: b.confirm === true ? new Date() : edited ? null : cur.confirmedAt } });
  await logEvent(u.userId, 'cv_intelligence', b.confirm === true ? 'profile_confirmed' : 'profile_edited', b.confirm === true ? 'Candidate confirmed the profile as accurate' : 'Candidate edited the profile');
  return NextResponse.json(await loadCareer(u.userId));
}
