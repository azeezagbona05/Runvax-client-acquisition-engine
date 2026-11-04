import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadAcqData } from '@/lib/acqData';
import { computeOverview } from '@/lib/acqOverview';
import { HARD_DAILY_MAX } from '@/lib/outreachCampaign';
import { loadMailbox } from '@/lib/outreachSender';
import { guardInstalled } from '@/lib/v2Setup';

export const dynamic = 'force-dynamic';

/** GET ?days=7|14|30&tz=<Date#getTimezoneOffset> — everything the Client Acquisition overview shows. */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const days = Number(req.nextUrl.searchParams.get('days'));
  const tz = Number(req.nextUrl.searchParams.get('tz'));
  const { campaigns, leads } = await loadAcqData(user.userId);
  const mailbox = await loadMailbox(user.userId);

  return NextResponse.json({
    mailboxReady: !!mailbox,
    ...computeOverview(leads, campaigns, {
      days: [7, 14, 30].includes(days) ? days : 14,
      tz: Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : 0,
      hardDailyMax: HARD_DAILY_MAX,
    }),
  });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
