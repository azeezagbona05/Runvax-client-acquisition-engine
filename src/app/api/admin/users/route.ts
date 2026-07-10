import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
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
