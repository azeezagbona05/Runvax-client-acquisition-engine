import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string; leadId: string } };

/**
 * PATCH { replied?: boolean, outcome?: 'interested' | 'not_interested' | null }
 * Record (or undo) that this person answered, and what the sender made of the reply.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const body = await req.json().catch(() => ({})) as { replied?: unknown; outcome?: unknown };

  const data: Record<string, unknown> = {};
  const where: Record<string, unknown> = { id: params.leadId, campaignId: params.id, userId: user.userId };
  if (body.replied !== undefined) {
    if (typeof body.replied !== 'boolean') return NextResponse.json({ error: 'replied must be true or false' }, { status: 400 });
    data.repliedAt = body.replied ? new Date() : null;
    if (body.replied) where.sentAt = { not: null };
    else data.outcome = null;
  }
  if (body.outcome !== undefined) {
    if (body.outcome !== null && body.outcome !== 'interested' && body.outcome !== 'not_interested') {
      return NextResponse.json({ error: "outcome must be 'interested', 'not_interested' or null" }, { status: 400 });
    }
    data.outcome = body.outcome;
    // Deciding on a reply means it was a reply.
    if (body.outcome !== null) where.sentAt = { not: null };
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const res = await prisma.outreachLead.updateMany({ where, data });
  if (res.count === 0) return NextResponse.json({ error: 'Only people you have emailed can be marked as replied.' }, { status: 404 });
  // Deciding on a reply means it was a reply, but an existing reply time is kept.
  if (typeof body.outcome === 'string' && body.replied === undefined) {
    await prisma.outreachLead.updateMany({ where: { id: params.leadId, userId: user.userId, repliedAt: null }, data: { repliedAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE — take someone off the list. Anyone already emailed is kept for the history, but won't be emailed again. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const where = { id: params.leadId, campaignId: params.id, userId: user.userId };
  const lead = await prisma.outreachLead.findFirst({ where, select: { sentAt: true } });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (lead.sentAt) {
    await prisma.outreachLead.updateMany({ where, data: { status: 'skipped', error: 'Removed by you' } });
  } else {
    await prisma.outreachLead.deleteMany({ where });
  }
  return NextResponse.json({ ok: true });
}
