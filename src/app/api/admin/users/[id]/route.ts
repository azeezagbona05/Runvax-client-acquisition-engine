import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());
const VALID_PLANS = ['free', 'pro', 'agency'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    plan?: string;
    searchLimitOverride?: number | null;
    blockedLocations?: string[] | null;
    blockedCountries?: string[] | null;
    isSuspended?: boolean;
  };

  const updateData: Record<string, unknown> = {};

  if (body.plan !== undefined) {
    if (!VALID_PLANS.includes(body.plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    updateData.plan = body.plan;
    updateData.planExpiresAt = body.plan === 'free'
      ? null
      : new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
  }

  if ('searchLimitOverride' in body) {
    updateData.searchLimitOverride = body.searchLimitOverride ?? null;
  }

  if ('blockedLocations' in body) {
    updateData.blockedLocations = body.blockedLocations && body.blockedLocations.length > 0
      ? JSON.stringify(body.blockedLocations)
      : null;
  }

  if ('blockedCountries' in body) {
    updateData.blockedCountries = body.blockedCountries && body.blockedCountries.length > 0
      ? JSON.stringify(body.blockedCountries)
      : null;
  }

  if ('isSuspended' in body) {
    updateData.isSuspended = !!body.isSuspended;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, email: true, plan: true, planExpiresAt: true, searchLimitOverride: true, blockedLocations: true, blockedCountries: true, isSuspended: true },
  });

  return NextResponse.json(user);
}
