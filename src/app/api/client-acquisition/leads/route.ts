import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadAcqData } from '@/lib/acqData';
import { lastActivityAt, leadStage, type LeadListStage } from '@/lib/acqOverview';

export const dynamic = 'force-dynamic';

const PAGE = 25;

/** GET ?campaign=&stage=&q=&page= — every lead across all campaigns (the "Lead Lists" page). */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const sp = req.nextUrl.searchParams;
  const campaign = sp.get('campaign') ?? '';
  const stage = (sp.get('stage') ?? 'all') as LeadListStage;
  const q = (sp.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));

  const { campaigns, leads } = await loadAcqData(user.userId);
  const names = new Map(campaigns.map((c) => [c.id, c.name]));

  const counts: Record<string, number> = { all: 0 };
  const matching = leads
    .filter((l) => !campaign || l.campaignId === campaign)
    .filter((l) => !q || [l.email, l.name, l.business].some((v) => v?.toLowerCase().includes(q)))
    .map((l) => ({ l, st: leadStage(l) }));
  for (const { st } of matching) { counts.all++; counts[st] = (counts[st] ?? 0) + 1; }

  const rows = matching
    .filter(({ st }) => stage === 'all' || st === stage)
    .sort((a, b) => lastActivityAt(b.l) - lastActivityAt(a.l));

  return NextResponse.json({
    total: rows.length, page, pageSize: PAGE, counts,
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
    leads: rows.slice((page - 1) * PAGE, page * PAGE).map(({ l, st }) => ({
      id: l.id, campaignId: l.campaignId, campaignName: names.get(l.campaignId) ?? 'Campaign',
      email: l.email, name: l.name ?? null, business: l.business ?? null, website: l.website ?? null,
      stage: st, opens: l.openCount ?? 0, lastActivityAt: new Date(lastActivityAt(l)).toISOString(),
    })),
  });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
