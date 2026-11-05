import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { prisma } from '@/lib/prisma';
import { snovEnabled, verifyEmails } from '@/lib/snov';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST { emails: string[] } (up to 10) — checks whether each address exists, with Snov.io.
 * Answers { results: { "<email>": "valid" | "invalid" | "unknown" } }. An address Snov did not answer for is left out.
 * Costs a Snov credit per address, so paid plans only.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`dm-verify:${user.userId}`, { maxRequests: 20, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!snovEnabled()) return NextResponse.json({ error: 'Email checking is not switched on yet.' }, { status: 501 });
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
  if (!u || u.plan === 'free') return NextResponse.json({ error: 'Checking emails is available on paid plans.' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { emails?: unknown };
  const emails = Array.isArray(body.emails)
    ? Array.from(new Set(body.emails.filter((e): e is string => typeof e === 'string' && EMAIL_OK.test(e.trim())).map((e) => e.trim().toLowerCase()))).slice(0, 10)
    : [];
  if (!emails.length) return NextResponse.json({ error: 'No email addresses to check.' }, { status: 400 });

  try {
    const found = await verifyEmails(emails);
    const results: Record<string, 'valid' | 'invalid' | 'unknown'> = {};
    for (const [email, r] of Array.from(found)) results[email] = r.smtpStatus === 'not_valid' || r.disposable ? 'invalid' : r.smtpStatus === 'valid' ? 'valid' : 'unknown';
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[dm-verify]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'The email checker did not answer. Try again in a moment.' }, { status: 502 });
  }
}
