import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paystack';
import { prisma } from '@/lib/prisma';

// Paystack sends events here. Set this URL in:
// Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL
// URL: https://YOUR-DOMAIN.vercel.app/api/payments/webhook

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-paystack-signature') ?? '';
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    data: {
      reference?: string;
      status?: string;
      amount?: number;
      customer?: { customer_code?: string; email?: string };
      subscription_code?: string;
      metadata?: Record<string, unknown>;
      plan?: { plan_code?: string };
    };
  };

  try {
    switch (event.event) {
      // Recurring charge succeeded — renew the plan
      case 'charge.success': {
        const ref = event.data.reference;
        const userId = event.data.metadata?.userId as string | undefined;
        if (!ref || !userId) break;

        const plan = (event.data.metadata?.plan as string) ?? 'pro';

        await prisma.payment.upsert({
          where: { reference: ref },
          create: { userId, reference: ref, plan, amount: event.data.amount ?? 0, status: 'success' },
          update: { status: 'success' },
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            planExpiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
        });
        break;
      }

      // Subscription cancelled or payment failed — downgrade to free
      case 'subscription.disable':
      case 'invoice.payment_failed': {
        const subCode = event.data.subscription_code;
        if (!subCode) break;

        await prisma.user.updateMany({
          where: { paystackSubscriptionCode: subCode },
          data: { plan: 'free', planExpiresAt: null },
        });
        break;
      }

      // Subscription created — store subscription code on user
      case 'subscription.create': {
        const subCode = event.data.subscription_code;
        const customerCode = event.data.customer?.customer_code;
        if (!subCode || !customerCode) break;

        await prisma.user.updateMany({
          where: { paystackCustomerCode: customerCode },
          data: { paystackSubscriptionCode: subCode },
        });
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 200 so Paystack doesn't retry endlessly
  }

  return NextResponse.json({ ok: true });
}
