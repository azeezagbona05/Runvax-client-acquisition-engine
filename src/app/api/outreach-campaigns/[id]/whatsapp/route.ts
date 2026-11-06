import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignSender, requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { sendWhatsAppBatch, waState } from '@/lib/waCampaign';

export const dynamic = 'force-dynamic';

/** GET — what WhatsApp can do for this campaign right now: contacts with a phone, how many are waiting, today's limit. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  try { return NextResponse.json(await waState(user.userId, params.id)); }
  catch { return NextResponse.json({ blocker: 'WhatsApp for campaigns is not switched on yet.', withPhone: 0, waiting: 0, sent: 0, sentToday: 0, cap: 0, failed: 0 }); }
}

/** POST — sends the next few WhatsApp messages (approved template) to contacts who have a phone number. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignSender(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-wa:${user.userId}`, { maxRequests: 20, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  try {
    const r = await sendWhatsAppBatch(user.userId, params.id);
    return 'error' in r ? NextResponse.json(r, { status: 422 }) : NextResponse.json(r);
  } catch { return NextResponse.json({ error: 'WhatsApp for campaigns is not switched on yet.' }, { status: 503 }); }
}
