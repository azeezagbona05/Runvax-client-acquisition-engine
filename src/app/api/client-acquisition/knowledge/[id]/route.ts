import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { refreshWebsite } from '@/lib/knowledge/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** GET: one source with its first few pieces of text, so the owner can see what was learned. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params; const s = await prisma.knowledgeSource.findFirst({ where: { id, userId: u.userId } });
  if (!s) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const chunks = await prisma.knowledgeChunk.findMany({ where: { sourceId: s.id }, orderBy: { idx: 'asc' }, take: 6, select: { label: true, text: true } });
  return NextResponse.json({ source: { id: s.id, kind: s.kind, name: s.name, meta: s.meta ?? {}, chars: s.chars }, sample: chunks.map((c) => ({ label: c.label, text: c.text.slice(0, 400) })) });
}

/** POST { action: 'refresh' }: read a website again. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`knowledge-add:${u.userId}`, { maxRequests: 8, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const { id } = await ctx.params; const { action } = await req.json().catch(() => ({})) as { action?: unknown };
  if (action !== 'refresh') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  try { const r = await refreshWebsite(u.userId, id); return NextResponse.json({ ok: true, pages: (r.source.meta as { pages?: number } | null)?.pages ?? 0, note: r.note }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 300) : 'Could not read that website again.' }, { status: 400 }); }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params; const r = await prisma.knowledgeSource.deleteMany({ where: { id, userId: u.userId } });
  return NextResponse.json({ ok: r.count > 0 });
}
