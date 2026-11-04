import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadAcqData } from '@/lib/acqData';
import { activityFeed, type ActivityType } from '@/lib/acqOverview';

export const dynamic = 'force-dynamic';

const TYPES: ActivityType[] = ['sent', 'followup', 'opened', 'clicked', 'replied', 'imported'];

/** GET ?type=&limit= — the full activity feed, newest first. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const type = req.nextUrl.searchParams.get('type') as ActivityType | null;
  const limit = Math.min(300, Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get('limit')) || 100)));
  const { campaigns, leads } = await loadAcqData(user.userId);
  const all = activityFeed(leads, campaigns, 5000);
  const events = (type && TYPES.includes(type) ? all.filter((e) => e.type === type) : all).slice(0, limit);
  return NextResponse.json({ events });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
