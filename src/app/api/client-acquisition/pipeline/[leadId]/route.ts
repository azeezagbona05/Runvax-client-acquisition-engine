import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { MANUAL_STAGES } from '@/lib/replyIntel';
import { logAgent } from '@/lib/acqReplies';

export const dynamic = 'force-dynamic';

/** PATCH { stage: 'demo_booked'|'proposal_sent'|'customer'|'lost'|null, demoAt?, dealValue? } — the user records how the deal is going. These stop follow-ups. */
async function handlePatch(req: NextRequest, leadId: string) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const b = await req.json().catch(() => null) as { stage?: unknown; demoAt?: unknown; dealValue?: unknown } | null;
  if (!b) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const data: Record<string, unknown> = {};
  if ('stage' in b) {
    if (b.stage !== null && !(MANUAL_STAGES as readonly unknown[]).includes(b.stage)) return NextResponse.json({ error: 'Unknown stage.' }, { status: 400 });
    data.stage = b.stage;
    data.closedAt = b.stage === 'customer' || b.stage === 'lost' ? new Date() : null;
  }
  if ('demoAt' in b) {
    if (b.demoAt === null) data.demoAt = null;
    else { const d = new Date(String(b.demoAt)); if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'That date is not valid.' }, { status: 400 }); data.demoAt = d; }
  }
  if ('dealValue' in b) {
    if (b.dealValue === null) data.dealValue = null;
    else if (typeof b.dealValue === 'number' && Number.isInteger(b.dealValue) && b.dealValue >= 0 && b.dealValue <= 1_000_000_000) data.dealValue = b.dealValue;
    else return NextResponse.json({ error: 'The deal value must be a whole number.' }, { status: 400 });
  }
  const lead = await prisma.outreachLead.findFirst({ where: { id: leadId, userId: user.userId }, select: { id: true, campaignId: true, email: true, business: true, name: true } });
  if (!lead) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  await prisma.outreachLead.update({ where: { id: lead.id }, data });
  if (typeof b.stage === 'string') await logAgent(user.userId, 'reply', `${lead.business || lead.name || lead.email} marked ${b.stage.replace('_', ' ')}`, 'Follow-ups to this contact have stopped.', lead.campaignId, lead.id);
  return NextResponse.json({ ok: true });
}

export const PATCH = (req: NextRequest, { params }: { params: { leadId: string } }) => guardInstalled(() => handlePatch(req, params.leadId));
