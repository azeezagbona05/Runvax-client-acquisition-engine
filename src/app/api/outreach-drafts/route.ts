import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const drafts = await prisma.outreachDraft.findMany({
    where: { userId: session.user.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { prospect: { select: { id: true, businessName: true, businessData: true } } },
  });

  return NextResponse.json({ drafts });
}
