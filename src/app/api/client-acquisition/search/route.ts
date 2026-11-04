import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadAcqData } from '@/lib/acqData';

export const dynamic = 'force-dynamic';

/** GET ?q= — quick search across campaigns and leads for the top bar. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ campaigns: [], leads: [] });

  const { campaigns, leads } = await loadAcqData(user.userId);
  const names = new Map(campaigns.map((c) => [c.id, c.name]));
  return NextResponse.json({
    campaigns: campaigns.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4).map((c) => ({ id: c.id, name: c.name, status: c.status })),
    leads: leads
      .filter((l) => [l.email, l.name, l.business].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 6)
      .map((l) => ({ id: l.id, campaignId: l.campaignId, campaignName: names.get(l.campaignId) ?? 'Campaign', email: l.email, business: l.business ?? l.name ?? null })),
  });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
