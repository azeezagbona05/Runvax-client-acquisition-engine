import { useUserKeys } from '@/lib/integrations/keys';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { prisma } from '@/lib/prisma';
import { findDecisionMakers, paidProvidersConfigured } from '@/lib/dmFinder';
import { webSearchConfigured } from '@/lib/webSearch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function cityOf(address?: string): string {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? '';
}
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);

/**
 * POST — find the decision-makers (and their emails) for a business that is not saved yet, such as a row in the
 * prospect finder. Body: { name, address?, website?, category?, categoryTypes?, deep? }.
 * Free sources always run. `deep: true` adds the paid sources (Hunter, Snov.io, Apollo, Apify), which spend real
 * credits, so it needs a paid plan and is limited per user per hour. Nothing is stored.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  await useUserKeys(user.userId);
  const body = await req.json().catch(() => ({})) as { name?: unknown; address?: unknown; website?: unknown; category?: unknown; categoryTypes?: unknown; deep?: unknown };
  const name = clip(body.name, 120)?.trim();
  if (!name) return NextResponse.json({ error: 'Business name required' }, { status: 400 });

  const deep = body.deep === true;
  if (!rateLimit(`dm-lookup:${user.userId}`, { maxRequests: 60, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  if (deep) {
    if (!paidProvidersConfigured()) return NextResponse.json({ error: 'No paid lookup sources are configured' }, { status: 501 });
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
    if (!u || u.plan === 'free') return NextResponse.json({ error: 'The deeper search is available on paid plans' }, { status: 403 });
    // Paid sources spend credits: a per-hour ceiling per user (best effort; resets if the server restarts).
    if (!rateLimit(`dm-lookup-deep:${user.userId}`, { maxRequests: 40, windowMs: 3_600_000 }).ok) {
      return NextResponse.json({ error: 'Deeper search limit reached for this hour. Try again later.' }, { status: 429 });
    }
  }

  const result = await findDecisionMakers({
    businessName: name, city: cityOf(clip(body.address, 200)), website: clip(body.website, 300),
    category: clip(body.category, 80),
    categoryTypes: Array.isArray(body.categoryTypes) ? body.categoryTypes.filter((t): t is string => typeof t === 'string').slice(0, 10).map((t) => t.slice(0, 60)) : [],
  }, { deep });

  return NextResponse.json({
    candidates: result.candidates.slice(0, 5).map((c) => ({
      name: c.name, title: c.title, source: c.source, confidence: c.confidence,
      ...(c.email ? { email: c.email, emailStatus: c.emailStatus } : {}), ...(c.phone ? { phone: c.phone } : {}), ...(c.linkedin ? { linkedin: c.linkedin } : {}), ...(c.sourcePage ? { sourcePage: c.sourcePage } : {}),
      ...(c.match ? { match: c.match } : {}), ...(c.evidence ? { evidence: c.evidence } : {}),
    })),
    searchOn: webSearchConfigured(),
    ran: result.ran, paidAvailable: result.paidAvailable, channels: result.channels,
  });
}
