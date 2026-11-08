import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { runVisibilityAgent } from '@/lib/agents/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST { count? }: write articles now (a visibility agent). New articles wait for approval unless the agent is set to publish by itself. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`agent-run:${u.userId}`, { maxRequests: 6, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const { id } = await ctx.params; const a = await prisma.customAgent.findFirst({ where: { id, userId: u.userId } });
  if (!a || a.kind !== 'visibility') return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const user = await prisma.user.findUnique({ where: { id: u.userId }, select: { id: true, plan: true } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { count?: unknown };
  const out = await runVisibilityAgent(a, user, { count: Math.floor(Number(b.count)) || undefined });
  return NextResponse.json({ created: out.created.map((p) => ({ id: p.id, title: p.title, status: p.status, source: p.source })), notice: out.notice });
}
