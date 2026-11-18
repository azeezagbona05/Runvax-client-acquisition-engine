import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { canManage, requireCrm, workspaceUsers } from '@/lib/crm/access';

export const dynamic = 'force-dynamic';

const find = (id: string, ownerId: string) => prisma.crmTask.findFirst({ where: { id, ownerId } });

/** PATCH { done?, title?, dueAt?, assigneeId? }. Anyone on the team can tick a task done; only its creator, assignee, an admin or the owner can change or delete it. */
export const PATCH = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const t = await find(params.id, ctx.ownerId); if (!t) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { done?: unknown; title?: unknown; dueAt?: unknown; assigneeId?: unknown };
  const data: Record<string, unknown> = {};
  if (typeof b.done === 'boolean') { data.doneAt = b.done ? new Date() : null; data.doneBy = b.done ? ctx.userId : null; }
  const edits = 'title' in b || 'dueAt' in b || 'assigneeId' in b;
  if (edits && !(canManage(ctx.role) || t.createdBy === ctx.userId || t.assigneeId === ctx.userId)) return NextResponse.json({ error: 'Only the person who made or owns this task, or an admin, can change it.' }, { status: 403 });
  if ('title' in b) { const s = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim().slice(0, 300) : ''; if (!s) return NextResponse.json({ error: 'Describe the task.' }, { status: 400 }); data.title = s; }
  if ('dueAt' in b) { if (b.dueAt === null || b.dueAt === '') data.dueAt = null; else { const d = new Date(String(b.dueAt)); if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'That due date is not valid.' }, { status: 400 }); data.dueAt = d; } }
  if ('assigneeId' in b) {
    if (b.assigneeId === null || b.assigneeId === '') data.assigneeId = null;
    else if (typeof b.assigneeId === 'string' && (await workspaceUsers(ctx.ownerId)).some((u) => u.id === b.assigneeId)) data.assigneeId = b.assigneeId;
    else return NextResponse.json({ error: 'That person is not on the team.' }, { status: 400 });
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  await prisma.crmTask.update({ where: { id: t.id }, data });
  return NextResponse.json({ ok: true });
});

export const DELETE = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const t = await find(params.id, ctx.ownerId); if (!t) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  if (!(canManage(ctx.role) || t.createdBy === ctx.userId)) return NextResponse.json({ error: 'Only the person who made this task, or an admin, can delete it.' }, { status: 403 });
  await prisma.crmTask.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
});
