import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
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

  const upsertArgs = {
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
  };

  let row;
  try {
    row = await prisma.searchHistory.upsert(upsertArgs);
  } catch (err) {
    // Prisma's upsert isn't atomic on MySQL — a concurrent request for the
    // same (userId, industry, location) can win the create race and cause
    // this one to hit the unique constraint. Retry as the row now exists.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      row = await prisma.searchHistory.upsert(upsertArgs);
    } else {
      throw err;
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
