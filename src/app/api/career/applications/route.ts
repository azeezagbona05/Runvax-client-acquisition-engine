import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { loadCareer } from '@/lib/career/store';
import { prepareApplication } from '@/lib/career/apply/prepare';
import { presentApplication } from '@/lib/career/apply/present';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET: the user's prepared applications, newest first. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const rows = await prisma.jobApplication.findMany({ where: { userId: u.userId }, orderBy: { updatedAt: 'desc' }, take: 100, include: { match: { include: { listing: true } }, submissions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  return NextResponse.json({ applications: rows.map(presentApplication) });
}

/** POST { matchIds: string[] } (up to 5 at a time): prepare applications. Writes drafts only; nothing is sent. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { matchIds?: unknown };
  const ids = Array.isArray(b.matchIds) ? Array.from(new Set(b.matchIds.filter((x): x is string => typeof x === 'string'))).slice(0, 5) : [];
  if (!ids.length) return NextResponse.json({ error: 'Choose a job to prepare an application for.' }, { status: 400 });
  const c = await loadCareer(u.userId);
  if (c.status !== 'active') return NextResponse.json({ error: c.status === 'paused' ? 'The agent is paused. Resume it to prepare applications.' : 'Deploy your Career Agent first.' }, { status: 400 });
  if (!rateLimit(`career-prepare:${u.userId}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'You prepared a lot of applications in the last hour. Please wait a little.' }, { status: 429 });
  const results: Array<{ matchId: string; ok: boolean; error?: string; reused?: boolean }> = [];
  for (const id of ids) { const r = await prepareApplication(u.userId, id); results.push(r.ok ? { matchId: id, ok: true, reused: r.reused } : { matchId: id, ok: false, error: r.error }); }
  if (results.every((r) => !r.ok)) return NextResponse.json({ error: results[0].error ?? 'Could not prepare that application.' }, { status: 400 });
  return NextResponse.json({ results });
}
