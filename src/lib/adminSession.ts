import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { ADMIN_SESSION_MS } from '@/lib/adminSessionShared';

/** The browser's sign-in cookie name, as NextAuth uses it. */
export const sessionCookieName = () => (process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token');

export const clientIp = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

/** Signs an admin in: the account (created on first use), a session cookie good for 12 hours, and a line in the audit log. */
export async function startAdminSession(req: NextRequest, res: NextResponse, rawEmail: string, via: 'email code' | 'biometric'): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const user = (await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, plan: true, isSuspended: true } }))
    ?? await prisma.user.create({ data: { email, name: 'Admin', emailVerified: new Date() }, select: { id: true, name: true, plan: true, isSuspended: true } });
  if (user.isSuspended) throw new Error('This account is suspended.');
  const now = Date.now();
  const token = await encode({
    token: { sub: user.id, id: user.id, email, name: user.name, plan: user.plan, emailVerified: new Date(now).toISOString(), isAdmin: true, adminAt: now, adminVia: via, lastTouch: now },
    secret: process.env.NEXTAUTH_SECRET!, maxAge: ADMIN_SESSION_MS / 1000,
  });
  res.cookies.set(sessionCookieName(), token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: ADMIN_SESSION_MS / 1000, path: '/' });
  await prisma.adminAuditLog.create({ data: { actorEmail: email, action: 'admin_login', title: `Admin signed in with ${via === 'biometric' ? 'biometric' : 'an email code'}`, detail: `from ${clientIp(req)}` } }).catch(() => {});
}
