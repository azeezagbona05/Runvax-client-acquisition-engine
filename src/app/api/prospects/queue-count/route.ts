import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ count: 0 });

    const count = await prisma.prospect.count({
      where: {
        userId: session.user.id,
        source: 'auto-prospect',
        stage: 'found',
      },
    });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
