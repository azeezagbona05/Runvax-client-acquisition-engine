import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.status !== 'active' && body.status !== 'paused') {
    return NextResponse.json({ error: 'status must be active or paused' }, { status: 400 });
  }

  const result = await prisma.campaign.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: { status: body.status },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Deleting a campaign keeps its prospects — only the standing instruction goes.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await prisma.campaign.deleteMany({ where: { id: params.id, userId: session.user.id } });
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
