import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer } from '@/lib/career/store';
import { computeAnalytics } from '@/lib/career/manage/analytics';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const c = await loadCareer(u.userId);
  return NextResponse.json(await computeAnalytics(u.userId, c.discovery.minScore));
}
