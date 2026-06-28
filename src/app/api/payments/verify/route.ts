import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/paystack';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Paystack redirects here after payment: /api/payments/verify?reference=xxx
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference');
  if (!reference) {
    return NextResponse.redirect(new URL('/pricing?error=missing_reference', req.url));
  }

  try {
    const tx = await verifyTransaction(reference);

    if (tx.status !== 'success') {
      return NextResponse.redirect(new URL(`/pricing?error=payment_failed`, req.url));
    }

    // Extract plan from metadata
    const plan = (tx.metadata?.plan as string | undefined) ?? 'pro';
    const userId = tx.metadata?.userId as string | undefined;

    if (!userId) {
      return NextResponse.redirect(new URL('/pricing?error=missing_user', req.url));
    }

    // Upsert payment record
    await prisma.payment.upsert({
      where: { reference },
      create: {
        userId,
        reference,
        plan,
        amount: tx.amount,
        status: 'success',
      },
      update: { status: 'success' },
    });

    // Upgrade the user's plan
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        paystackCustomerCode: tx.customer.customer_code ?? null,
        paystackSubscriptionCode: tx.subscription?.subscription_code ?? null,
        // Plan active for 35 days (5 day buffer on monthly)
        planExpiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.redirect(new URL('/dashboard?upgraded=1', req.url));
  } catch (err: unknown) {
    console.error('Payment verify error:', err);
    return NextResponse.redirect(new URL('/pricing?error=verify_failed', req.url));
  }
}
