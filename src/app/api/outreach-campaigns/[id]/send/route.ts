import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { sendBatch } from '@/lib/outreachSender';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { kind: 'initial' | 'followup' } — sends the next batch. The page calls this in a loop
 * until nothing is left or the daily limit is reached; the daily cron picks up the rest.
 * Follow-ups are only ever sent when the user asks for them here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`oc-send:${user.userId}`, { maxRequests: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Slow down: too many send requests. Try again in a minute.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as { kind?: string };
  const kind = body.kind === 'followup' ? 'followup' : 'initial';
  const result = await sendBatch({ campaignId: params.id, userId: user.userId, kind });

  const status = result.aborted === 'not_found' ? 404
    : result.aborted === 'no_mailbox' || result.aborted === 'not_started' ? 400
    : result.aborted ? 502 : 200;
  return NextResponse.json(result, { status });
}
