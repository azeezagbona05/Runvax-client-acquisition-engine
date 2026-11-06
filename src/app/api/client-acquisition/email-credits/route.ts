import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { guardInstalled } from '@/lib/v2Setup';
import { TOPUP_PACKS, loadCredits } from '@/lib/emailCredits';
import { PRICING_ENABLED } from '@/lib/promo';

export const dynamic = 'force-dynamic';

/** GET — this account's email reveals: the plan allowance used and left, the wallet, and the top-up packs once prices are switched on. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  return NextResponse.json({ ...(await loadCredits(user.userId)), packs: PRICING_ENABLED ? TOPUP_PACKS : [] });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
