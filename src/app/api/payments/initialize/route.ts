import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PRICING_ENABLED } from '@/lib/promo';
import {
  initializeTransaction,
  planCodeForPlan,
  amountForPlan,
  generateReference,
} from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Pricing is switched off for the launch: never start a charge.
  if (!PRICING_ENABLED) return NextResponse.json({ error: 'Paid plans are not available right now' }, { status: 503 });
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

  // Charge the same price the pricing page advertises, not a hardcoded amount.
  let charge: Awaited<ReturnType<typeof amountForPlan>>;
  try {
    charge = await amountForPlan(plan);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : `No price configured for "${plan}".` },
      { status: 500 }
    );
  }

  const reference = generateReference(session.user.id);
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  try {
    const data = await initializeTransaction({
      email: session.user.email,
      amount: charge.amount,
      currency: charge.currency,
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
