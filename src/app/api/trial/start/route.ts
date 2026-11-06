import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { TRIAL_PLAN } from '@/lib/promo';
import { grantTrial } from '@/lib/trial';

export const dynamic = 'force-dynamic';

/** POST — start the free Pro trial for the signed-in account (see grantTrial for the rules). */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const r = await grantTrial(auth.userId);
  if (r.ok) return NextResponse.json({ ok: true, plan: TRIAL_PLAN, expiresAt: r.expiresAt.toISOString() });

  const fail: Record<string, [string, number]> = {
    OFFER_ENDED: ['The free Pro trial offer has ended', 410],
    UNAVAILABLE: ['Account unavailable', 403],
    EMAIL_UNVERIFIED: ['Verify your email first, then start your trial', 403],
    ALREADY_PAID: ['You are already on a paid plan', 409],
    TRIAL_USED: ['You have already used your free trial', 409],
    ERROR: ['Could not start the trial — try again', 500],
  };
  const [error, status] = fail[r.code];
  return NextResponse.json({ error, code: r.code === 'EMAIL_UNVERIFIED' || r.code === 'TRIAL_USED' ? r.code : undefined }, { status });
}
