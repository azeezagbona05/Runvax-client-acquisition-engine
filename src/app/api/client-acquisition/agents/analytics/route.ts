import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';

export const dynamic = 'force-dynamic';

/** GET ?days=30: conversations per day, leads, and a row per agent, for the Studio Analytics page. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const days = Math.min(90, Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get('days'))) || 30));
  const since = new Date(Date.now() - days * 86_400_000);
  const [chats, agents, articles] = await Promise.all([
    prisma.customAgentChat.findMany({ where: { userId: u.userId, createdAt: { gte: since } }, select: { agentId: true, channel: true, status: true, createdAt: true } }),
    prisma.customAgent.findMany({ where: { userId: u.userId }, select: { id: true, name: true, kind: true, status: true } }),
    prisma.customAgentPost.groupBy({ by: ['agentId'], where: { userId: u.userId, status: 'published', publishedAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const perDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) perDay.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), 0);
  for (const c of chats) { const k = c.createdAt.toISOString().slice(0, 10); if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1); }
  const art = new Map(articles.map((a) => [a.agentId, a._count._all]));
  const isLead = (s: string) => s === 'lead' || s === 'handoff';
  return NextResponse.json({
    days,
    conversations: chats.length,
    leads: chats.filter((c) => isLead(c.status)).length,
    handoffs: chats.filter((c) => c.status === 'handoff').length,
    channels: { website: chats.filter((c) => c.channel !== 'telegram').length, telegram: chats.filter((c) => c.channel === 'telegram').length },
    series: Array.from(perDay.entries()).map(([date, count]) => ({ date, count })),
    agents: agents.map((a) => { const mine = chats.filter((c) => c.agentId === a.id); return { id: a.id, name: a.name, kind: a.kind, status: a.status, conversations: mine.length, leads: mine.filter((c) => isLead(c.status)).length, articles: art.get(a.id) ?? 0 }; }),
  });
}
