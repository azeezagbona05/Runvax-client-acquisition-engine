import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';

export const dynamic = 'force-dynamic';

/** GET ?status=lead|handoff|open&agent=<id>: the latest conversations across all of the person's chat agents. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const q = new URL(req.url).searchParams;
  const status = q.get('status'); const agent = q.get('agent');
  const chats = await prisma.customAgentChat.findMany({
    where: { userId: u.userId, ...(status && ['open', 'lead', 'handoff', 'closed'].includes(status) ? { status } : {}), ...(agent ? { agentId: agent } : {}) },
    orderBy: { updatedAt: 'desc' }, take: 100,
    select: { id: true, agentId: true, channel: true, visitor: true, status: true, messages: true, updatedAt: true, agent: { select: { name: true } } },
  });
  return NextResponse.json({
    chats: chats.map((c) => ({ id: c.id, agentId: c.agentId, agentName: c.agent.name, channel: c.channel, visitor: c.visitor, status: c.status, messages: (Array.isArray(c.messages) ? c.messages : []).slice(-30), updatedAt: c.updatedAt.toISOString() })),
  });
}
