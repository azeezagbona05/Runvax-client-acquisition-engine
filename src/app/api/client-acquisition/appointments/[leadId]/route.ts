import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { OUTCOMES } from '@/lib/appointments';
import { logAgent } from '@/lib/acqReplies';

export const dynamic = 'force-dynamic';

const date = (v: unknown): Date | null | 'bad' => { if (v === null) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? 'bad' : d; };

/**
 * PATCH { demoAt?, outcome?: 'held'|'missed'|'rescheduled'|null, nextAction?: string|null, nextActionDue?: iso|null, nextActionDone?: boolean }
 * The team records what happened at the meeting and the next step. A new meeting time starts a fresh appointment, so the old outcome is cleared.
 * Nothing here emails the contact.
 */
async function handle(req: NextRequest, leadId: string) {
  const user = await requireCampaignUser(req); if (!user.ok) return user.response;
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const lead = await prisma.outreachLead.findFirst({ where: { id: leadId, userId: user.userId }, select: { id: true, campaignId: true, email: true, name: true, business: true, stage: true } });
  if (!lead) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  const ap: Record<string, unknown> = {};
  if ('outcome' in b) {
    if (b.outcome !== null && !(OUTCOMES as readonly unknown[]).includes(b.outcome)) return NextResponse.json({ error: 'Unknown outcome.' }, { status: 400 });
    ap.outcome = b.outcome;
  }
  if ('nextAction' in b) {
    if (b.nextAction !== null && typeof b.nextAction !== 'string') return NextResponse.json({ error: 'The next step must be text.' }, { status: 400 });
    const t = typeof b.nextAction === 'string' ? b.nextAction.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    ap.nextAction = t || null; ap.nextActionDoneAt = null;                                     // a new or cleared step is open again
    if (!t) ap.nextActionDue = null;
  }
  if ('nextActionDue' in b) { const d = date(b.nextActionDue); if (d === 'bad') return NextResponse.json({ error: 'That due date is not valid.' }, { status: 400 }); ap.nextActionDue = d; }
  if (b.nextActionDone === true) ap.nextActionDoneAt = new Date();
  if (b.nextActionDone === false) ap.nextActionDoneAt = null;

  const leadData: Record<string, unknown> = {};
  if ('demoAt' in b) {
    const d = date(b.demoAt); if (d === 'bad') return NextResponse.json({ error: 'That date is not valid.' }, { status: 400 });
    leadData.demoAt = d; if (d && !lead.stage) leadData.stage = 'demo_booked';
    if (!('outcome' in b)) ap.outcome = null;
  }
  if (!Object.keys(ap).length && !Object.keys(leadData).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  if (Object.keys(leadData).length) await prisma.outreachLead.update({ where: { id: lead.id }, data: leadData });
  if (Object.keys(ap).length) await prisma.leadAppointment.upsert({ where: { leadId: lead.id }, create: { userId: user.userId, leadId: lead.id, ...ap }, update: ap });
  if (typeof b.outcome === 'string') await logAgent(user.userId, 'reply', `${lead.business || lead.name || lead.email}: appointment ${b.outcome}`, 'Recorded by you on the Appointments page.', lead.campaignId, lead.id).catch(() => {});
  return NextResponse.json({ ok: true });
}

export const PATCH = (req: NextRequest, { params }: { params: { leadId: string } }) => guardInstalled(() => handle(req, params.leadId));
