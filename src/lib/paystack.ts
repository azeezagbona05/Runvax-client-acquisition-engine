import { getPlanConfig } from './plans';
import { priceToCharge, type ChargeCurrency } from './planDefaults';

const BASE = 'https://api.paystack.co';

function headers() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function paystackFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options?.headers ?? {}) },
  });
  const json = await res.json() as { status: boolean; message: string; data: T };
  if (!json.status) throw new Error(json.message ?? 'Paystack error');
  return json.data;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(params: {
  email: string;
  amount: number;       // smallest unit of `currency` (cents for USD, kobo for NGN)
  currency?: ChargeCurrency;
  reference: string;
  plan?: string;        // PLN_xxx plan code for subscriptions
  metadata?: Record<string, unknown>;
  callback_url?: string;
}) {
  return paystackFetch<InitializeResult>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface VerifyResult {
  status: string;       // 'success' | 'failed' | 'abandoned'
  reference: string;
  amount: number;       // smallest unit of the transaction currency
  currency?: string;
  customer: { email: string; customer_code: string };
  subscription?: { subscription_code: string; status: string };
  metadata?: Record<string, unknown>;
}

export async function verifyTransaction(reference: string) {
  return paystackFetch<VerifyResult>(`/transaction/verify/${reference}`);
}

export async function disableSubscription(subscriptionCode: string, emailToken: string) {
  return paystackFetch<{ message: string }>('/subscription/disable', {
    method: 'POST',
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
}

export function planCodeForPlan(plan: 'pro' | 'agency'): string {
  const code = plan === 'pro'
    ? process.env.PAYSTACK_PRO_PLAN_CODE
    : process.env.PAYSTACK_AGENCY_PLAN_CODE;
  if (!code) throw new Error(`Plan code for "${plan}" not configured. Add PAYSTACK_${plan.toUpperCase()}_PLAN_CODE to .env.local`);
  return code;
}

/**
 * The amount and currency to charge (US dollars, in cents), derived from the same plan price the pricing
 * page shows (DB row first, ./planDefaults as fallback) so the two can't drift.
 *
 * Note: this only sets the *first* charge. Every renewal is billed at the amount
 * configured on the Paystack plan (PLN_xxx), so a price change here must be
 * mirrored on the plan in the Paystack dashboard. USD charging also needs USD enabled on
 * the Paystack account and PAYSTACK_*_PLAN_CODE pointing at plans created in USD.
 */
export async function amountForPlan(plan: 'pro' | 'agency'): Promise<{ amount: number; currency: ChargeCurrency }> {
  const { price } = await getPlanConfig(plan);
  const charge = priceToCharge(price);
  if (charge == null) {
    throw new Error(`No valid price configured for "${plan}" (got ${JSON.stringify(price)}) — set it in the admin panel.`);
  }
  return charge;
}

export function generateReference(userId: string): string {
  return `aip_${userId.slice(-8)}_${Date.now()}`;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[paystack] PAYSTACK_SECRET_KEY is not set — rejecting webhook');
    return false;
  }
  if (!signature) return false;
  const crypto = require('crypto') as typeof import('crypto');
  const hash = crypto
    .createHmac('sha512', secret)
    .update(body)
    .digest('hex');
  // timingSafeEqual requires equal-length buffers; mismatched length = definitely not equal
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
