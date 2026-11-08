import { NextRequest, NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/adminSessionShared';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VALID_PLANS = ['free', 'pro', 'agency'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    plan?: string;
    months?: number;
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

    if (body.plan === 'free') {
      updateData.planExpiresAt = null;
      updateData.expiryReminderSentAt = null;
    } else {
      const months = Number.isFinite(body.months) && (body.months as number) > 0
        ? Math.floor(body.months as number)
        : 1; // default: one-month subscription
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + Math.min(months, 24));
      updateData.planExpiresAt = expiry;
      updateData.expiryReminderSentAt = null; // plan was (re)activated — allow future reminders again
    }
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
