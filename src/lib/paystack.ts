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
  amount: number;       // in kobo (₦9,999 = 999900)
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
  amount: number;       // in kobo
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

export function amountForPlan(plan: 'pro' | 'agency'): number {
  return plan === 'pro' ? 999900 : 2499900; // kobo
}

export function generateReference(userId: string): string {
  return `aip_${userId.slice(-8)}_${Date.now()}`;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require('crypto') as typeof import('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY ?? '')
    .update(body)
    .digest('hex');
  return hash === signature;
}
