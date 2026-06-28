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

  const { plan } = await req.json() as { plan: string };
  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const planExpiresAt = plan === 'free'
    ? null
    : new Date(Date.now() + 35 * 24 * 60 * 60 * 1000); // +35 days for paid plans

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { plan, planExpiresAt },
    select: { id: true, email: true, plan: true, planExpiresAt: true },
  });

  return NextResponse.json(user);
}
