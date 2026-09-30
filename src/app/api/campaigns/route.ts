import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_CAMPAIGNS = 5;
const MAX_DAILY_CAP = 30;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const industry = String(body.industry ?? '').trim().slice(0, 100);
  const location = String(body.location ?? '').trim().slice(0, 100);
  if (!industry || !location) {
    return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 });
  }

  const count = await prisma.campaign.count({ where: { userId } });
  if (count >= MAX_CAMPAIGNS) {
    return NextResponse.json({ error: `You can have up to ${MAX_CAMPAIGNS} campaigns` }, { status: 400 });
  }

  const cap = Number(body.dailyCap);
  const campaign = await prisma.campaign.create({
    data: {
      userId,
      name: String(body.name ?? '').trim().slice(0, 100) || `${industry} in ${location}`,
      industry,
      location,
      noWebsiteOnly: body.noWebsiteOnly !== false,
      minRating: Math.min(Math.max(Number(body.minRating) || 0, 0), 5),
      dailyCap: Number.isFinite(cap) && cap > 0 ? Math.min(Math.floor(cap), MAX_DAILY_CAP) : 20,
    },
  });
  return NextResponse.json({ campaign }, { status: 201 });
}
