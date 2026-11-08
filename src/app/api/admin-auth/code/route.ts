import { NextRequest, NextResponse } from 'next/server';
import { requestAdminCode } from '@/lib/adminCode';
import { clientIp } from '@/lib/adminSession';
import { rateLimit } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

/** POST { email }: emails a sign-in code if the address is an admin's. The answer is the same for everyone, so this cannot be used to find out who the admins are. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`admin-code-ip:${ip}`, { maxRequests: 10, windowMs: 15 * 60_000 }).ok) return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
  const { email } = await req.json().catch(() => ({})) as { email?: unknown };
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return NextResponse.json({ error: 'Enter your email address.' }, { status: 400 });
  const r = await requestAdminCode(email);
  if (r.reason === 'mail') return NextResponse.json({ error: 'The code could not be sent right now. Try again, or use biometric.' }, { status: 503 });
  return NextResponse.json({ ok: true, message: 'If that address can sign in to the admin area, a code is on its way.' });
}
