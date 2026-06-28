import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { searchedAt: 'desc' },
    take: 15,
  });

  return NextResponse.json(
    rows.map((r) => ({
      industry: r.industry,
      location: r.location,
      totalCount: r.totalCount,
      noWebsiteCount: r.noWebsiteCount,
      timestamp: r.searchedAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry, location, totalCount, noWebsiteCount } = await req.json() as {
    industry: string;
    location: string;
    totalCount: number;
    noWebsiteCount: number;
  };

  if (!industry || !location) {
    return NextResponse.json({ error: 'industry and location are required' }, { status: 400 });
  }

  const row = await prisma.searchHistory.upsert({
    where: {
      userId_industry_location: {
        userId: session.user.id,
        industry,
        location,
      },
    },
    create: {
      userId: session.user.id,
      industry,
      location,
      totalCount,
      noWebsiteCount,
    },
    update: {
      totalCount,
      noWebsiteCount,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
