import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { canManage, requireCrm, ROLES } from '@/lib/crm/access';

export const dynamic = 'force-dynamic';

/** PATCH { role }: change a teammate's role. DELETE: remove them (their assigned contacts become unassigned). Owner or admin only. */
const guard = async (req: NextRequest, id: string, fn: (ownerId: string, m: { id: string; userId: string | null }) => Promise<NextResponse>) => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  if (!canManage(a.ctx.role)) return NextResponse.json({ error: 'Only the owner or an admin can change the team.' }, { status: 403 });
  const m = await prisma.crmMember.findFirst({ where: { id, ownerId: a.ctx.ownerId }, select: { id: true, userId: true } });
  if (!m) return NextResponse.json({ error: 'Teammate not found.' }, { status: 404 });
  return fn(a.ctx.ownerId, m);
};

export const PATCH = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => guard(req, params.id, async (_o, m) => {
  const b = await req.json().catch(() => ({})) as { role?: unknown };
  if (!(ROLES as readonly unknown[]).includes(b.role)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  await prisma.crmMember.update({ where: { id: m.id }, data: { role: b.role as string } });
  return NextResponse.json({ ok: true });
}));

export const DELETE = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => guard(req, params.id, async (ownerId, m) => {
  if (m.userId) await prisma.leadAssignment.deleteMany({ where: { ownerId, assigneeId: m.userId } });
  if (m.userId) await prisma.crmTask.updateMany({ where: { ownerId, assigneeId: m.userId, doneAt: null }, data: { assigneeId: null } });
  await prisma.crmMember.delete({ where: { id: m.id } });
  return NextResponse.json({ ok: true });
}));
