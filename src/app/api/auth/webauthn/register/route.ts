import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const RP_NAME = 'ProspectAI';
const RP_ID  = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
  : 'localhost';
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// GET — generate registration options (challenge)
export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Get existing credentials so we can exclude them
  const existing = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email ?? user.id,
    userDisplayName: user.name ?? user.email ?? 'ProspectAI User',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // Store challenge in DB (expires in 5 min)
  await prisma.user.update({
    where: { id: userId },
    data: { webauthnChallenge: options.challenge } as object,
  }).catch(() => {
    // Column may not exist yet — ignore gracefully; we store in cookie instead
  });

  const res = NextResponse.json(options);
  res.cookies.set('wa_challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });
  return res;
}

// POST — verify registration response
export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const challenge = req.cookies.get('wa_challenge')?.value;
  if (!challenge) return NextResponse.json({ error: 'Challenge expired — try again' }, { status: 400 });

  const body = await req.json() as { response: RegistrationResponseJSON; deviceName?: string };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ? JSON.stringify(credential.transports) : null,
      deviceName: body.deviceName ?? 'Device',
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('wa_challenge');
  return res;
}
