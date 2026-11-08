import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/prisma';
import { isAdminEmail } from '@/lib/adminSessionShared';
import { clientIp, startAdminSession } from '@/lib/adminSession';
import { rateLimit } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';
const COOKIE = 'wa_admin_challenge';
const NOT_SET = 'Biometric is not set up for this account on this device. Use an email code instead.';

function originAndRpId(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';
  return { origin, rpId: new URL(origin).hostname };
}

/** GET ?email=: a biometric challenge for an admin who has registered one. Same answer for "not an admin" and "no biometric yet". */
export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-bio-ip:${clientIp(req)}`, { maxRequests: 30, windowMs: 15 * 60_000 }).ok) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase();
  const user = isAdminEmail(email) ? await prisma.user.findUnique({ where: { email }, select: { id: true, webAuthnCredentials: { select: { credentialId: true, transports: true } } } }) : null;
  if (!user || user.webAuthnCredentials.length === 0) return NextResponse.json({ error: NOT_SET }, { status: 404 });
  const options = await generateAuthenticationOptions({
    rpID: originAndRpId(req).rpId, userVerification: 'required',
    allowCredentials: user.webAuthnCredentials.map((c) => ({ id: c.credentialId, transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : undefined })),
  });
  const res = NextResponse.json(options);
  res.cookies.set(COOKIE, `${user.id}::${options.challenge}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 300, path: '/' });
  return res;
}

/** POST { response }: checks the biometric and, for an admin, starts a 12-hour admin session. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`admin-bio-ip:${clientIp(req)}`, { maxRequests: 30, windowMs: 15 * 60_000 }).ok) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  const raw = req.cookies.get(COOKIE)?.value; if (!raw) return NextResponse.json({ error: 'That took too long. Try again.' }, { status: 400 });
  const [userId, challenge] = raw.split('::');
  const body = await req.json().catch(() => ({})) as { response?: AuthenticationResponseJSON };
  if (!body.response?.id) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId: body.response.id }, include: { user: { select: { id: true, email: true } } } });
  if (!cred || cred.userId !== userId || !isAdminEmail(cred.user.email)) return NextResponse.json({ error: 'That biometric is not recognised.' }, { status: 400 });
  const { origin, rpId } = originAndRpId(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: true,
      credential: { id: cred.credentialId, publicKey: new Uint8Array(cred.publicKey), counter: cred.counter, transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransport[]) : undefined },
    });
  } catch { return NextResponse.json({ error: 'Biometric check failed. Try again, or use an email code.' }, { status: 400 }); }
  if (!verification.verified) return NextResponse.json({ error: 'Biometric check failed. Try again, or use an email code.' }, { status: 400 });
  await prisma.webAuthnCredential.update({ where: { id: cred.id }, data: { counter: verification.authenticationInfo.newCounter } });
  try {
    const res = NextResponse.json({ ok: true, redirectTo: '/admin' });
    await startAdminSession(req, res, cred.user.email!, 'biometric');
    res.cookies.delete(COOKIE);
    return res;
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not sign you in.' }, { status: 403 }); }
}
