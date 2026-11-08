import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';

export const dynamic = 'force-dynamic';

/** GET ?days=7: what the AI agents did for the Home screen: conversations (with the change from the period before), leads, and the latest agent events. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const days = Math.min(90, Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get('days'))) || 7));
  const now = Date.now(); const since = new Date(now - days * 86_400_000); const before = new Date(now - 2 * days * 86_400_000);
  const [conversations, previous, leads, active, total, chats, agents, posts] = await Promise.all([
    prisma.customAgentChat.count({ where: { userId: u.userId, createdAt: { gte: since } } }),
    prisma.customAgentChat.count({ where: { userId: u.userId, createdAt: { gte: before, lt: since } } }),
    prisma.customAgentChat.count({ where: { userId: u.userId, status: 'lead', updatedAt: { gte: since } } }),
    prisma.customAgent.count({ where: { userId: u.userId, status: 'active' } }),
    prisma.customAgent.count({ where: { userId: u.userId } }),
    prisma.customAgentChat.findMany({ where: { userId: u.userId, status: 'lead' }, orderBy: { updatedAt: 'desc' }, take: 3, select: { id: true, updatedAt: true, visitor: true, agent: { select: { name: true } } } }),
    prisma.customAgent.findMany({ where: { userId: u.userId }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, name: true, kind: true, createdAt: true } }),
    prisma.customAgentPost.findMany({ where: { userId: u.userId, status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 3, select: { id: true, title: true, publishedAt: true, createdAt: true, agent: { select: { name: true } } } }),
  ]);
  const events = [
    ...chats.map((c) => { const v = (c.visitor ?? {}) as { name?: string; company?: string }; return { id: 'c' + c.id, kind: 'lead' as const, title: 'New lead from a chat', detail: [v.name, v.company].filter(Boolean).join(' · ') || c.agent.name, at: c.updatedAt.toISOString() }; }),
    ...agents.map((a) => ({ id: 'a' + a.id, kind: 'agent' as const, title: a.kind === 'assistant' ? 'Sales Assistant created' : 'Visibility Agent created', detail: a.name, at: a.createdAt.toISOString() })),
    ...posts.map((p) => ({ id: 'p' + p.id, kind: 'article' as const, title: 'Article published', detail: p.title, at: (p.publishedAt ?? p.createdAt).toISOString() })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const pct = previous > 0 ? Math.round(((conversations - previous) / previous) * 100) : null;
  return NextResponse.json({ days, conversations, previous, changePct: pct, leads, activeAgents: active, agents: total, events });
}
