import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  initializeTransaction,
  planCodeForPlan,
  amountForPlan,
  generateReference,
} from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan } = await req.json() as { plan: 'pro' | 'agency' };
  if (!['pro', 'agency'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 500 });
  }

  let planCode: string;
  try {
    planCode = planCodeForPlan(plan);
  } catch {
    return NextResponse.json(
      { error: `Plan code not configured for "${plan}". Add it to .env.` },
      { status: 500 }
    );
  }

  const reference = generateReference(session.user.id);
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const data = await initializeTransaction({
      email: session.user.email,
      amount: amountForPlan(plan),
      reference,
      plan: planCode,
      callback_url: `${appUrl}/api/payments/verify?reference=${reference}`,
      metadata: {
        userId: session.user.id,
        plan,
        cancel_action: `${appUrl}/pricing`,
      },
    });

    return NextResponse.json({ url: data.authorization_url });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initialize payment' },
      { status: 500 }
    );
  }
}
