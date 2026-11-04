import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { addLeads } from '@/lib/outreachLeads';
import { logAgent } from '@/lib/acqReplies';

export const dynamic = 'force-dynamic';

/**
 * POST — upload leads. Body: { leads: [{ email, name?, business?, website? }] }.
 * Adding to a finished campaign reopens it as paused: new people only go out after the user presses Run again.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;

  const campaign = await prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId }, select: { id: true, status: true } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { leads?: unknown };
  const result = await addLeads(campaign.id, user.userId, body.leads);
  if (result.added > 0 && campaign.status === 'completed') {
    await prisma.outreachCampaign.update({ where: { id: campaign.id }, data: { status: 'paused' } });
  }
  if (result.added > 0) await logAgent(user.userId, 'audience', `Reviewed ${result.added + (result.duplicates ?? 0)} contacts and added ${result.added}`, `${result.duplicates ?? 0} duplicates and ${result.invalid ?? 0} invalid addresses left out.`, campaign.id);
  return NextResponse.json(result);
}
