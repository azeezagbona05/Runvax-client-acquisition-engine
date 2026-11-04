import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkInbox } from '@/lib/acqInboxReader';
import { notifyOwnerOfReply } from '@/lib/acqNotify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST — reads the user's mailbox and files replies from their campaign contacts. */
async function handlePost(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-inbox:${user.userId}`, { maxRequests: 6, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const r = await checkInbox(user.userId, { notifyOwner: notifyOwnerOfReply });
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 422 });
}

export const POST = (req: NextRequest) => guardInstalled(() => handlePost(req));
