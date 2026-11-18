import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCrm, workspaceUsers } from '@/lib/crm/access';

export const dynamic = 'force-dynamic';

/** GET ?scope=mine|all&done=0|1: tasks, overdue and soonest first. */
export const GET = (req: NextRequest) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a; const sp = new URL(req.url).searchParams;
  const mine = sp.get('scope') !== 'all'; const done = sp.get('done') === '1';
  const [tasks, users] = await Promise.all([
    prisma.crmTask.findMany({ where: { ownerId: ctx.ownerId, doneAt: done ? { not: null } : null, ...(mine ? { OR: [{ assigneeId: ctx.userId }, { assigneeId: null }] } : {}) }, orderBy: done ? { doneAt: 'desc' } : [{ dueAt: 'asc' }, { createdAt: 'asc' }], take: 200, include: { lead: { select: { id: true, email: true, name: true, business: true } } } }),
    workspaceUsers(ctx.ownerId),
  ]);
  const nm = (id: string | null) => (id ? users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || 'Former teammate' : null);
  const now = Date.now();
  return NextResponse.json({ tasks: tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, doneAt: t.doneAt?.toISOString() ?? null, assigneeId: t.assigneeId, assigneeName: nm(t.assigneeId), overdue: !t.doneAt && !!t.dueAt && t.dueAt.getTime() < now, contact: t.lead ? { id: t.lead.id, label: t.lead.business || t.lead.name || t.lead.email } : null })) });
});

/** POST { title, leadId?, dueAt?, assigneeId? } */
export const POST = (req: NextRequest) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const b = await req.json().catch(() => ({})) as { title?: unknown; leadId?: unknown; dueAt?: unknown; assigneeId?: unknown };
  const title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  if (!title) return NextResponse.json({ error: 'Describe the task.' }, { status: 400 });
  let dueAt: Date | null = null;
  if (b.dueAt !== undefined && b.dueAt !== null && b.dueAt !== '') { dueAt = new Date(String(b.dueAt)); if (Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: 'That due date is not valid.' }, { status: 400 }); }
  let leadId: string | null = null;
  if (typeof b.leadId === 'string' && b.leadId) { const l = await prisma.outreachLead.findFirst({ where: { id: b.leadId, userId: ctx.ownerId }, select: { id: true } }); if (!l) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 }); leadId = l.id; }
  let assigneeId: string | null = ctx.userId;
  if ('assigneeId' in b) {
    if (b.assigneeId === null || b.assigneeId === '') assigneeId = null;
    else if (typeof b.assigneeId === 'string' && (await workspaceUsers(ctx.ownerId)).some((u) => u.id === b.assigneeId)) assigneeId = b.assigneeId;
    else return NextResponse.json({ error: 'That person is not on the team.' }, { status: 400 });
  }
  const t = await prisma.crmTask.create({ data: { ownerId: ctx.ownerId, leadId, assigneeId, title, dueAt, createdBy: ctx.userId } });
  return NextResponse.json({ id: t.id }, { status: 201 });
});
