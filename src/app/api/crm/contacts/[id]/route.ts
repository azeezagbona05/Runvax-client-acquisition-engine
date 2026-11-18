import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { canManage, requireCrm, workspaceUsers } from '@/lib/crm/access';
import { MANUAL_STAGES } from '@/lib/replyIntel';

export const dynamic = 'force-dynamic';

const own = (id: string, ownerId: string) => prisma.outreachLead.findFirst({ where: { id, userId: ownerId }, select: { id: true, campaignId: true, email: true, name: true, business: true, website: true, stage: true } });

/** GET: one contact with its whole story, newest first: emails sent, opens, replies, notes, meetings, tasks. */
export const GET = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const l = await prisma.outreachLead.findFirst({
    where: { id: params.id, userId: ctx.ownerId },
    select: { id: true, email: true, name: true, business: true, website: true, stage: true, status: true, sentAt: true, openedAt: true, openCount: true, clickedAt: true, repliedAt: true, replyClass: true, demoAt: true, dealValue: true, unsubscribedAt: true,
      campaign: { select: { id: true, name: true } }, appointment: true, assignment: true,
      crmTasks: { orderBy: [{ doneAt: 'asc' }, { dueAt: 'asc' }], take: 50 }, crmNotes: { orderBy: { createdAt: 'desc' }, take: 100 },
      replies: { orderBy: { receivedAt: 'desc' }, take: 20, select: { id: true, subject: true, text: true, receivedAt: true, replyClass: true, respondedAt: true } } },
  });
  if (!l) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  const users = await workspaceUsers(ctx.ownerId);
  const nm = (id: string | null) => (id ? users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || 'Former teammate' : null);
  const timeline = [
    ...(l.sentAt ? [{ at: l.sentAt, kind: 'email', text: `Email sent (campaign: ${l.campaign.name})` }] : []),
    ...(l.openedAt ? [{ at: l.openedAt, kind: 'open', text: `Opened the email${l.openCount > 1 ? ` (${l.openCount} times)` : ''}` }] : []),
    ...(l.clickedAt ? [{ at: l.clickedAt, kind: 'click', text: 'Clicked a link' }] : []),
    ...l.replies.map((r) => ({ at: r.receivedAt, kind: 'reply', text: `Replied: ${r.text.replace(/\s+/g, ' ').slice(0, 300)}` })),
    ...l.crmNotes.map((n) => ({ at: n.createdAt, kind: n.kind, text: n.body, by: nm(n.authorId) })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime()).map((e) => ({ ...e, at: e.at.toISOString() }));
  return NextResponse.json({
    contact: { id: l.id, email: l.email, name: l.name, business: l.business, website: l.website, stage: l.stage, campaign: l.campaign, demoAt: l.demoAt?.toISOString() ?? null, dealValue: l.dealValue, unsubscribed: !!l.unsubscribedAt || l.status === 'unsubscribed', appointmentOutcome: l.appointment?.outcome ?? null, assigneeId: l.assignment?.assigneeId ?? null, assigneeName: nm(l.assignment?.assigneeId ?? null) },
    tasks: l.crmTasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, doneAt: t.doneAt?.toISOString() ?? null, assigneeId: t.assigneeId, assigneeName: nm(t.assigneeId) })),
    timeline, users, me: { id: ctx.userId, role: ctx.role },
  });
});

/**
 * PATCH { assigneeId?: userId|null, stage?: 'demo_booked'|'proposal_sent'|'customer'|'lost'|null, dealValue?: int|null }
 * A member may take an unassigned contact or hand back one of their own; only the owner or an admin may assign to someone else or take over.
 */
export const PATCH = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const b = await req.json().catch(() => null) as { assigneeId?: unknown; stage?: unknown; dealValue?: unknown } | null;
  if (!b) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const lead = await own(params.id, ctx.ownerId); if (!lead) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  const users = await workspaceUsers(ctx.ownerId); const nm = (id: string) => users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || 'someone';
  const notes: string[] = [];

  if ('assigneeId' in b) {
    const cur = (await prisma.leadAssignment.findUnique({ where: { leadId: lead.id } }))?.assigneeId ?? null;
    const to = b.assigneeId;
    if (to !== null && (typeof to !== 'string' || !users.some((u) => u.id === to))) return NextResponse.json({ error: 'That person is not on the team.' }, { status: 400 });
    if (!canManage(ctx.role)) {
      const takingFree = cur === null && to === ctx.userId; const handingBack = cur === ctx.userId && to === null;
      if (!takingFree && !handingBack) return NextResponse.json({ error: 'You can take an unassigned contact or hand back your own. Ask the owner or an admin to reassign.' }, { status: 403 });
    }
    if (to === null) await prisma.leadAssignment.deleteMany({ where: { leadId: lead.id } });
    else await prisma.leadAssignment.upsert({ where: { leadId: lead.id }, create: { ownerId: ctx.ownerId, leadId: lead.id, assigneeId: to as string }, update: { assigneeId: to as string, assignedAt: new Date() } });
    notes.push(to === null ? 'Unassigned.' : `Assigned to ${nm(to as string)}.`);
  }
  const data: Record<string, unknown> = {};
  if ('stage' in b) {
    if (b.stage !== null && !(MANUAL_STAGES as readonly unknown[]).includes(b.stage)) return NextResponse.json({ error: 'Unknown stage.' }, { status: 400 });
    data.stage = b.stage; data.closedAt = b.stage === 'customer' || b.stage === 'lost' ? new Date() : null;
    notes.push(b.stage ? `Stage set to ${String(b.stage).replace('_', ' ')}.` : 'Stage cleared.');
  }
  if ('dealValue' in b) {
    if (b.dealValue === null) data.dealValue = null;
    else if (typeof b.dealValue === 'number' && Number.isInteger(b.dealValue) && b.dealValue >= 0 && b.dealValue <= 1_000_000_000) data.dealValue = b.dealValue;
    else return NextResponse.json({ error: 'The deal value must be a whole number.' }, { status: 400 });
    notes.push(`Deal value ${data.dealValue === null ? 'cleared' : `set to ${data.dealValue}`}.`);
  }
  if (Object.keys(data).length) await prisma.outreachLead.update({ where: { id: lead.id }, data });
  if (!notes.length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  await prisma.crmNote.create({ data: { ownerId: ctx.ownerId, leadId: lead.id, authorId: ctx.userId, kind: 'system', body: notes.join(' ') } });
  return NextResponse.json({ ok: true });
});
