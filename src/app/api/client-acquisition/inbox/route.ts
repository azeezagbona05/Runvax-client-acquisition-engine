import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadAcqData } from '@/lib/acqData';
import { ms, needsFollowUpLead } from '@/lib/acqInbox';

export const dynamic = 'force-dynamic';

/**
 * GET — replies waiting for a decision, the ones marked interested or not, and people who went
 * quiet and are due a follow-up. Replies arrive in the user's own mailbox, so a reply here means
 * the user marked it (RUNVAX can't read their inbox yet).
 */
async function handleGet(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const { campaigns, leads } = await loadAcqData(user.userId);
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const shape = (l: (typeof leads)[number]) => ({
    id: l.id, campaignId: l.campaignId, campaignName: byId.get(l.campaignId)?.name ?? 'Campaign',
    email: l.email, name: l.name ?? null, business: l.business ?? null, website: l.website ?? null,
    repliedAt: l.repliedAt ? new Date(l.repliedAt).toISOString() : null,
    sentAt: l.sentAt ? new Date(l.sentAt).toISOString() : null,
    outcome: l.outcome ?? null, opens: l.openCount ?? 0,
  });

  const replies = leads.filter((l) => l.repliedAt).sort((a, b) => ms(b.repliedAt) - ms(a.repliedAt)).map(shape);
  const followUps = leads
    .filter((l) => { const c = byId.get(l.campaignId); return c ? needsFollowUpLead(l, c) : false; })
    .sort((a, b) => ms(a.lastSentAt ?? a.sentAt) - ms(b.lastSentAt ?? b.sentAt))
    .slice(0, 200).map(shape);
  return NextResponse.json({ replies, followUps });
}

export const GET = (req: NextRequest) => guardInstalled(() => handleGet(req));
