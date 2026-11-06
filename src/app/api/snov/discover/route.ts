import { useUserKeys } from '@/lib/integrations/keys';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { prisma } from '@/lib/prisma';
import { SnovFilterError, searchProspects, snovEnabled, type ManagementLevel } from '@/lib/snov';
import { loadCredits } from '@/lib/emailCredits';
import { SNOV_INDUSTRIES } from '@/lib/snovDiscover';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LEVELS: ManagementLevel[] = ['c_level', 'vp_level', 'director_level', 'manager_level', 'staff'];
const LOC_TYPES = ['city', 'state', 'country', 'region', 'subregion'] as const;

async function paidUser(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return { error: user.response };
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
  if (!u || u.plan === 'free') return { error: NextResponse.json({ error: 'Discover with Snov is available on paid plans.' }, { status: 403 }) };
  await useUserKeys(user.userId);
  return { userId: user.userId };
}

/** GET: is the lookup switched on, how many email reveals this account has left, and the industries to choose from. */
export async function GET(req: NextRequest) {
  const who = await paidUser(req);
  if ('error' in who) return who.error;
  if (!snovEnabled()) return NextResponse.json({ available: false });
  return NextResponse.json({ available: true, balance: (await loadCredits(who.userId)).total, industries: SNOV_INDUSTRIES });
}

/**
 * POST { industry?, specialties?, location?: { locality, type }, levels?, jobTitles?, size?, page? } — finds people at
 * companies by industry, place and seniority. Free on Snov's side. Answers 422 with Snov's own suggestions when a
 * location or industry is not in its list, so the page can offer the right spelling.
 */
export async function POST(req: NextRequest) {
  const who = await paidUser(req);
  if ('error' in who) return who.error;
  if (!snovEnabled()) return NextResponse.json({ error: 'Snov.io is not switched on.' }, { status: 501 });
  if (!rateLimit(`snov-discover:${who.userId}`, { maxRequests: 20, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });

  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 10).map((x) => x.trim().slice(0, n)) : []);
  const loc = b.location as { locality?: unknown; type?: unknown } | undefined;
  const locality = str(loc?.locality, 120);
  const type = LOC_TYPES.find((t) => t === loc?.type) ?? 'state';
  const levels = list(b.levels, 20).filter((l): l is ManagementLevel => (LEVELS as string[]).includes(l));
  const page = Math.max(1, Math.min(500, Math.floor(Number(b.page)) || 1));

  try {
    const result = await searchProspects({
      industry: str(b.industry, 80), specialties: list(b.specialties, 60), ...(locality ? { location: { locality, type } } : {}),
      levels, jobTitles: list(b.jobTitles, 60), size: str(b.size, 20),
    }, page);
    return NextResponse.json({ ...result, balance: (await loadCredits(who.userId)).total });
  } catch (e) {
    if (e instanceof SnovFilterError) return NextResponse.json({ error: e.message, field: e.field, suggestions: e.suggestions }, { status: 422 });
    console.error('[snov-discover]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Snov.io did not answer. Try again in a moment.' }, { status: 502 });
  }
}
