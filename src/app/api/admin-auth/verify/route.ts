import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCode } from '@/lib/adminCode';
import { clientIp, startAdminSession } from '@/lib/adminSession';
import { rateLimit } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

/** POST { email, code }: the right code starts a 12-hour admin session. Five wrong codes lock the sign-in for 15 minutes (biometric still works). */
export async function POST(req: NextRequest) {
  if (!rateLimit(`admin-verify-ip:${clientIp(req)}`, { maxRequests: 30, windowMs: 15 * 60_000 }).ok) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const { email, code } = await req.json().catch(() => ({})) as { email?: unknown; code?: unknown };
  if (typeof email !== 'string' || typeof code !== 'string') return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  const r = await verifyAdminCode(email, code);
  if (r === 'locked') return NextResponse.json({ error: 'Too many wrong codes. Try again in 15 minutes, or sign in with biometric.' }, { status: 429 });
  if (r !== 'ok') return NextResponse.json({ error: 'That code is wrong or has expired.' }, { status: 400 });
  try {
    const res = NextResponse.json({ ok: true, redirectTo: '/admin' });
    await startAdminSession(req, res, email, 'email code');
    return res;
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not sign you in.' }, { status: 403 }); }
}
