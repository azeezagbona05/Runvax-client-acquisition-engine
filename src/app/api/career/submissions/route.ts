import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { OFF_MESSAGE, queueSubmissions, submitEnabled } from '@/lib/career/submit/queue';
import { targetFor } from '@/lib/career/submit/platform';

export const dynamic = 'force-dynamic';

/** GET: whether submitting is switched on, and which of the user's applications have a supported form. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const apps = await prisma.jobApplication.findMany({ where: { userId: u.userId }, select: { id: true, match: { select: { listing: { select: { source: true, externalId: true, url: true } } } } }, take: 200 });
  return NextResponse.json({ enabled: submitEnabled(), message: submitEnabled() ? '' : OFF_MESSAGE, supported: apps.filter((a) => targetFor(a.match.listing)).map((a) => a.id) });
}

/** POST { applicationIds, mode?: 'submit' | 'check' }: queue approved applications for the worker (or a dry-run check). Nothing is sent from here. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { applicationIds?: unknown; mode?: unknown };
  const ids = Array.isArray(b.applicationIds) ? b.applicationIds.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
  if (!ids.length) return NextResponse.json({ error: 'Choose an application.' }, { status: 400 });
  if (!rateLimit(`career-submit:${u.userId}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'That is a lot of requests in an hour. Please wait a little.' }, { status: 429 });
  const results = await queueSubmissions(u.userId, ids, b.mode === 'check' ? 'check' : 'user');
  if (results.every((r) => !r.ok)) return NextResponse.json({ error: results[0].error ?? 'Could not queue that.', results }, { status: 400 });
  return NextResponse.json({ results });
}
