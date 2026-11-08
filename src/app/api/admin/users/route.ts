import { NextRequest, NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/adminSessionShared';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { ids?: string[] };
  const ids = (body.ids ?? []).filter((id) => typeof id === 'string' && id.trim());
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No user ids provided' }, { status: 400 });
  }

  // Never allow an admin to delete their own account through bulk delete.
  const targetIds = ids.filter((id) => id !== session.user.id);

  const result = await prisma.user.deleteMany({ where: { id: { in: targetIds } } });
  return NextResponse.json({ ok: true, deleted: result.count });
}

// Bulk suspend/unsuspend — used by the "Suspend Selected" bulk action, and by
// Argus's review_flagged_signups shortcut (which only pre-selects; a human
// always has to click Suspend Selected + confirm to actually get here).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { ids?: string[]; isSuspended?: boolean };
  const ids = (body.ids ?? []).filter((id) => typeof id === 'string' && id.trim());
  if (ids.length === 0 || typeof body.isSuspended !== 'boolean') {
    return NextResponse.json({ error: 'ids and isSuspended are required' }, { status: 400 });
  }

  // Never allow an admin to suspend their own account through a bulk action.
  const targetIds = ids.filter((id) => id !== session.user.id);

  const result = await prisma.user.updateMany({
    where: { id: { in: targetIds } },
    data: { isSuspended: body.isSuspended },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorEmail: session.user.email,
      action: body.isSuspended ? 'bulk_suspended' : 'bulk_unsuspended',
      title: `${body.isSuspended ? 'Suspended' : 'Unsuspended'} ${result.count} user(s)`,
      detail: targetIds.join(', '),
    },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
