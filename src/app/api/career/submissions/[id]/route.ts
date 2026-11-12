import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { cancelQueued } from '@/lib/career/submit/queue';

export const dynamic = 'force-dynamic';

/** DELETE: cancel a submission that has not started. A running or finished one cannot be cancelled. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params;
  return (await cancelQueued(u.userId, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'It already started, or is not waiting any more.' }, { status: 400 });
}
