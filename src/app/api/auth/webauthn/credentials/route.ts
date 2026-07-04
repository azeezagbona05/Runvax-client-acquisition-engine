import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const creds = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { id: true, deviceName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(creds);
}

export async function DELETE(req: NextRequest) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  await prisma.webAuthnCredential.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
