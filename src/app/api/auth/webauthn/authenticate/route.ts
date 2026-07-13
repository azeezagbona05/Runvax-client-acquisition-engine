import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/prisma';
import { encode } from 'next-auth/jwt';

export const dynamic = 'force-dynamic';

function getOriginAndRpId(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configured || req.headers.get('origin') || 'http://localhost:3000';
  const rpId = new URL(origin).hostname;
  return { origin, rpId };
}

// GET — generate authentication options (challenge)
// Called with ?email= so we can look up the user's credentials
export async function GET(req: NextRequest) {
  const emailParam = req.nextUrl.searchParams.get('email');
  if (!emailParam) return NextResponse.json({ error: 'email required' }, { status: 400 });
  const email = emailParam.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, webAuthnCredentials: { select: { credentialId: true, transports: true } } },
  });

  if (!user || user.webAuthnCredentials.length === 0) {
    return NextResponse.json({ error: 'No biometric registered for this account' }, { status: 404 });
  }

  const { rpId } = getOriginAndRpId(req);

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'preferred',
    allowCredentials: user.webAuthnCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : undefined,
    })),
  });

  const res = NextResponse.json({ ...options, userId: user.id });
  res.cookies.set('wa_auth_challenge', `${user.id}::${options.challenge}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });
  return res;
}

// POST — verify authentication response and issue a session
export async function POST(req: NextRequest) {
  const raw = req.cookies.get('wa_auth_challenge')?.value;
  if (!raw) return NextResponse.json({ error: 'Challenge expired — try again' }, { status: 400 });

  const [userId, challenge] = raw.split('::');

  const body = await req.json() as { response: AuthenticationResponseJSON };

  // Find credential in DB
  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: body.response.id },
    include: { user: { select: { id: true, email: true, name: true, plan: true } } },
  });

  if (!cred || cred.userId !== userId) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
  }

  const { origin, rpId } = getOriginAndRpId(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransport[]) : undefined,
      },
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  // Update counter to prevent replay attacks
  await prisma.webAuthnCredential.update({
    where: { id: cred.id },
    data: { counter: verification.authenticationInfo.newCounter },
  });

  // Issue a NextAuth session JWT so the user is fully logged in
  const secret = process.env.NEXTAUTH_SECRET!;
  const sessionToken = await encode({
    token: {
      sub: cred.user.id,
      id: cred.user.id,
      email: cred.user.email,
      name: cred.user.name,
      plan: (cred.user as { plan?: string }).plan ?? 'free',
    },
    secret,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  const res = NextResponse.json({ ok: true, redirectTo: '/' });
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
  res.cookies.delete('wa_auth_challenge');
  return res;
}
