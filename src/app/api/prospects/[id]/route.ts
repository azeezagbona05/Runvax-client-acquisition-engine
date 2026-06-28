import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    stage?: string;
    notes?: string;
    reminderDate?: string | null;
    reminderNote?: string | null;
    outreachSentAt?: string | null;
  };

  const prospect = await prisma.prospect.findUnique({
    where: { id: params.id },
  });

  if (!prospect || prospect.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.prospect.update({
    where: { id: params.id },
    data: {
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.reminderDate !== undefined && { reminderDate: body.reminderDate }),
      ...(body.reminderNote !== undefined && { reminderNote: body.reminderNote }),
      ...(body.outreachSentAt !== undefined && {
        outreachSentAt: body.outreachSentAt ? new Date(body.outreachSentAt) : null,
      }),
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prospect = await prisma.prospect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.prospect.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
