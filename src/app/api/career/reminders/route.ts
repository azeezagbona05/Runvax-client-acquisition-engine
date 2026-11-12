import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { computeReminders } from '@/lib/career/manage/reminders';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  return NextResponse.json({ reminders: await computeReminders(u.userId) });
}
