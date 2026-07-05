import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paystack';
import { prisma } from '@/lib/prisma';
import { createTransporter, paymentConfirmationHtml, paymentFailedHtml } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';

export const dynamic = 'force-dynamic';

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
        const renewalDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);

        const [, user] = await Promise.all([
          prisma.payment.upsert({
            where: { reference: ref },
            create: { userId, reference: ref, plan, amount: event.data.amount ?? 0, status: 'success' },
            update: { status: 'success' },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { plan, planExpiresAt: renewalDate },
            select: { email: true, name: true },
          }),
        ]);

        if (user.email && process.env.SMTP_HOST) {
          const appName = getAppName();
          const renewalStr = renewalDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
          createTransporter().sendMail({
            from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
            to: user.email,
            subject: `Payment confirmed — you're on ${plan.charAt(0).toUpperCase() + plan.slice(1)} 🎉`,
            html: paymentConfirmationHtml(user.name ?? 'there', plan, event.data.amount ?? 0, renewalStr, getAppUrl(), appName),
          }).catch(() => {});
        }
        break;
      }

      // Subscription cancelled or payment failed — downgrade to free
      case 'subscription.disable':
      case 'invoice.payment_failed': {
        const subCode = event.data.subscription_code;
        if (!subCode) break;

        const affected = await prisma.user.findMany({
          where: { paystackSubscriptionCode: subCode },
          select: { id: true, email: true, name: true, plan: true },
        });

        await prisma.user.updateMany({
          where: { paystackSubscriptionCode: subCode },
          data: { plan: 'free', planExpiresAt: null },
        });

        if (process.env.SMTP_HOST) {
          const appName = getAppName();
          const appUrl = getAppUrl();
          for (const u of affected) {
            if (!u.email) continue;
            createTransporter().sendMail({
              from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
              to: u.email,
              subject: `Action needed — your ${appName} plan has been downgraded`,
              html: paymentFailedHtml(u.name ?? 'there', u.plan, appUrl, appName),
            }).catch(() => {});
          }
        }
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
