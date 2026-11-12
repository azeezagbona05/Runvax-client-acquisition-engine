import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { loadCareer } from '@/lib/career/store';
import { runDiscovery } from '@/lib/career/jobs/discover';
import { autoSubmitFor } from '@/lib/career/submit/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST: search now. Only a deployed (active) agent searches; it reads public job sources and stores what fits. It never applies to anything. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const c = await loadCareer(u.userId);
  if (c.status !== 'active') return NextResponse.json({ error: c.status === 'paused' ? 'The agent is paused. Resume it to search.' : 'Deploy your Career Agent first.' }, { status: 400 });
  if (!rateLimit(`career-discover:${u.userId}`, { maxRequests: 6, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'You searched several times in the last hour. Please wait a little.' }, { status: 429 });
  const result = await runDiscovery(u.userId);
  if (result.skipped) return NextResponse.json({ error: result.skipped }, { status: 400 });
  const auto = await autoSubmitFor(u.userId).catch(() => ({ prepared: 0, queued: 0 }));
  return NextResponse.json({ result, auto });
}
