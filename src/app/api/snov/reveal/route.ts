import { useUserKeys } from '@/lib/integrations/keys';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { prisma } from '@/lib/prisma';
import { revealEmail, revealPath, snovBalance, snovEnabled } from '@/lib/snov';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PER_REQUEST = 10;

/**
 * POST { urls: string[] } (up to 10 reveal links from a Discover search) — gets each person's name and email.
 * Costs 1 Snov credit per person whose email is found, so it is paid plans only, capped per request and per hour.
 * Answers { results: { [url]: { name?, email?, smtpStatus?, linkedin? } }, balance }. A person with no email is left out of results.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  await useUserKeys(user.userId);
  if (!snovEnabled()) return NextResponse.json({ error: 'Snov.io is not switched on.' }, { status: 501 });
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
  if (!u || u.plan === 'free') return NextResponse.json({ error: 'Revealing emails is available on paid plans.' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { urls?: unknown };
  const urls = Array.isArray(body.urls) ? Array.from(new Set(body.urls.filter((x): x is string => typeof x === 'string' && !!revealPath(x)))).slice(0, PER_REQUEST) : [];
  if (!urls.length) return NextResponse.json({ error: 'Nothing to reveal.' }, { status: 400 });

  // The ceiling on credit spend per person: best effort, in memory.
  if (!rateLimit(`snov-reveal:${user.userId}`, { maxRequests: 300, windowMs: 3_600_000 }).ok) {
    return NextResponse.json({ error: 'Reveal limit reached for this hour. Try again later.' }, { status: 429 });
  }

  const results: Record<string, { name?: string; email?: string; smtpStatus?: string; linkedin?: string }> = {};
  let stopped: string | undefined;
  // Two at a time: each reveal is a start plus a poll, and Snov allows 60 requests a minute.
  for (let i = 0; i < urls.length; i += 2) {
    const group = urls.slice(i, i + 2);
    const settled = await Promise.allSettled(group.map((url) => revealEmail(url)));
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value?.email) results[group[j]] = { name: r.value.name, email: r.value.email, smtpStatus: r.value.smtpStatus, linkedin: r.value.linkedin };
      if (r.status === 'rejected' && /not enough credits/i.test(r.reason instanceof Error ? r.reason.message : '')) stopped = 'Snov.io is out of credits.';
    });
    if (stopped) break;
  }
  return NextResponse.json({ results, balance: await snovBalance(), ...(stopped ? { stopped } : {}) });
}
