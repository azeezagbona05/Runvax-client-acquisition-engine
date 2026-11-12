import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer, logEvent } from '@/lib/career/store';
import { sanitizeDiscovery, sanitizePermissions, sanitizePreferences } from '@/lib/career/types';

export const dynamic = 'force-dynamic';

/** GET: everything the Career Agent page needs (the signed-in user's own data only). */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  return NextResponse.json(await loadCareer(u.userId));
}

/** PUT { preferences?, discovery?, permissions? }: save steps 2 to 4. Saved as a draft; the agent only runs after Deploy. */
export async function PUT(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { preferences?: unknown; discovery?: unknown; permissions?: unknown };
  const cur = await prisma.careerPreference.findUnique({ where: { userId: u.userId } });
  const data = {
    preferences: sanitizePreferences(b.preferences ?? cur?.preferences) as object,
    discovery: sanitizeDiscovery(b.discovery ?? cur?.discovery) as object,
    permissions: sanitizePermissions(b.permissions ?? cur?.permissions) as object,
  };
  const changedMode = b.permissions !== undefined && (data.permissions as { mode: string }).mode !== (cur ? sanitizePermissions(cur.permissions).mode : 'prepare');
  await prisma.careerPreference.upsert({ where: { userId: u.userId }, create: { userId: u.userId, ...data }, update: data });
  await logEvent(u.userId, 'orchestrator', 'settings_saved', changedMode ? `Application permission set to "${(data.permissions as { mode: string }).mode}"` : 'Preferences saved');
  return NextResponse.json(await loadCareer(u.userId));
}

/** DELETE: remove all of the user's career data (CVs, profile, settings, jobs, applications, replies, interviews, log). */
export async function DELETE(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  await prisma.$transaction([
    prisma.careerResponse.deleteMany({ where: { userId: u.userId } }), prisma.careerInterview.deleteMany({ where: { userId: u.userId } }),
    prisma.jobApplication.deleteMany({ where: { userId: u.userId } }), prisma.jobMatch.deleteMany({ where: { userId: u.userId } }), prisma.jobListing.deleteMany({ where: { userId: u.userId } }),
    prisma.careerAgentEvent.deleteMany({ where: { userId: u.userId } }), prisma.careerDocument.deleteMany({ where: { userId: u.userId } }),
    prisma.careerProfile.deleteMany({ where: { userId: u.userId } }), prisma.careerPreference.deleteMany({ where: { userId: u.userId } }),
  ]);
  return NextResponse.json({ ok: true });
}
