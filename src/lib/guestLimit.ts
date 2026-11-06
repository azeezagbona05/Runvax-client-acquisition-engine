import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getIp } from './rateLimiter';

/** Free searches a signed-out visitor gets per day, and how many of the results they see before signing up. */
export const GUEST_SEARCHES_PER_DAY = 2;
export const GUEST_PREVIEW_RESULTS = 5;

const COOKIE = 'rv_gs';
const secret = () => process.env.NEXTAUTH_SECRET ?? 'dev-secret';
const today = () => new Date().toISOString().slice(0, 10);
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('hex').slice(0, 24);

function readCount(req: NextRequest): number {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return 0;
  const [day, count, sig] = raw.split('.');
  if (day !== today() || !sig) return 0;
  const want = Buffer.from(sign(`${day}.${count}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return 0; // tampered cookie counts as nothing used... but the IP limit below still applies
  return Number(count) || 0;
}

/**
 * Server-side cap on signed-out searches: a signed cookie (stops casual resets) plus a per-IP counter
 * (stops a visitor who just deletes cookies; best-effort on serverless, like the other limiters).
 */
export function checkGuestSearch(req: NextRequest): { ok: true; next: number } | { ok: false } {
  const used = readCount(req);
  if (used >= GUEST_SEARCHES_PER_DAY) return { ok: false };
  const ip = rateLimit(`guest-search:${getIp(req)}`, { maxRequests: GUEST_SEARCHES_PER_DAY * 3, windowMs: 24 * 60 * 60 * 1000 });
  if (!ip.ok) return { ok: false };
  return { ok: true, next: used + 1 };
}

export function setGuestCookie(res: NextResponse, count: number): void {
  const v = `${today()}.${count}`;
  res.cookies.set(COOKIE, `${v}.${sign(v)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 24 * 60 * 60 });
}
