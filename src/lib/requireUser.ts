import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

/** Signed-in check for utility routes that cost money or contact third parties. Signed out → 401. */
export async function requireUser(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { ok: true, userId };
}

/**
 * Signed in AND email verified. Opening a prospect (and writing outreach for it) spends real
 * money on Google lookups and AI, so it is for verified accounts only. Signed out → 401,
 * unverified → 403 with code EMAIL_UNVERIFIED.
 *
 * The session token can be stale for a few minutes after someone verifies in another tab, so a
 * token that still says "unverified" is double-checked against the database before refusing.
 */
export async function requireVerifiedUser(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const base = await requireUser(req);
  if (!base.ok) return base;
  const token = await getToken({ req });
  if (token?.emailVerified) return base;
  try {
    const u = await prisma.user.findUnique({ where: { id: base.userId }, select: { emailVerified: true } });
    if (u?.emailVerified) return base;
  } catch { /* fall through to refusal: fail closed */ }
  return {
    ok: false,
    response: NextResponse.json({ error: 'Verify your email to open prospects. We sent you a verification link.', code: 'EMAIL_UNVERIFIED' }, { status: 403 }),
  };
}
