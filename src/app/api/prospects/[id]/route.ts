import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { FollowUpStep } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    stage?: string;
    notes?: string;
    reminderDate?: string | null;
    reminderNote?: string | null;
    outreachSentAt?: string | null;
    followUpSequence?: FollowUpStep[] | null;
  };

  const prospect = await prisma.prospect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.userId !== userId) {
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
      ...(body.followUpSequence !== undefined && {
        followUpSequence: body.followUpSequence === null || body.followUpSequence?.length === 0
          ? Prisma.JsonNull
          : (body.followUpSequence as unknown as Prisma.InputJsonValue),
      }),
    },
  });

  // Fire-and-forget: record outcome in the moat database when a deal is won
  if (body.stage === 'won' && prospect.stage !== 'won') {
    const bizData = prospect.businessData as Record<string, unknown>;
    const placeId = (bizData?.id as string | undefined) ?? prospect.businessId;
    const dealValue = (bizData?.estimatedPriceMin as number | undefined) ?? 0;
    void prisma.cachedBusiness.updateMany({
      where: { placeId },
      data: {
        timesConverted: { increment: 1 },
        totalDealValue: { increment: dealValue },
      },
    }).catch(() => { /* not critical */ });
  }

  // Fire-and-forget: record first contact in moat database
  if (body.stage === 'contacted' && prospect.stage === 'found') {
    const bizData = prospect.businessData as Record<string, unknown>;
    const placeId = (bizData?.id as string | undefined) ?? prospect.businessId;
    void prisma.cachedBusiness.updateMany({
      where: { placeId },
      data: { timesContacted: { increment: 1 } },
    }).catch(() => { /* not critical */ });
  }

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prospect = await prisma.prospect.findUnique({ where: { id: params.id } });
  if (!prospect || prospect.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.prospect.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
