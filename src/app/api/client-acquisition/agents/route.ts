import { NextRequest, NextResponse } from 'next/server';
import { getSiteSettings, AGENTS_PAUSED_MESSAGE } from '@/lib/siteSettings';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { AGENT_KINDS, agentLabel, isKind, sanitizeConfig } from '@/lib/agents/kinds';
import { MAX_AGENTS, presentAgent } from '@/lib/agents/present';
import { newPublicKey, newSecret, sealSecrets } from '@/lib/agents/store';

export const dynamic = 'force-dynamic';

/** GET: the user's agents. POST { kind, name, config }: save a new agent as a draft (switch it on from its page). */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const rows = await prisma.customAgent.findMany({ where: { userId: u.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  const drafts = await prisma.customAgentPost.groupBy({ by: ['agentId', 'status'], where: { userId: u.userId }, _count: true });
  const chats = await prisma.customAgentChat.groupBy({ by: ['agentId', 'status'], where: { userId: u.userId }, _count: true });
  const n = (rows_: typeof drafts, id: string, st?: string) => rows_.filter((r) => r.agentId === id && (!st || r.status === st)).reduce((a, r) => a + r._count, 0);
  return NextResponse.json({ agents: rows.map((a) => presentAgent(a, { posts: n(drafts, a.id, 'published'), drafts: n(drafts, a.id, 'draft'), chats: n(chats as typeof drafts, a.id), leads: n(chats as typeof drafts, a.id, 'lead') + n(chats as typeof drafts, a.id, 'handoff'), handoffs: n(chats as typeof drafts, a.id, 'handoff') })), kinds: AGENT_KINDS });
}

export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!(await getSiteSettings()).agentBuilderOpen) return NextResponse.json({ error: AGENTS_PAUSED_MESSAGE, code: 'AGENTS_PAUSED' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { kind?: unknown; name?: unknown; config?: unknown };
  if (!isKind(body.kind)) return NextResponse.json({ error: 'Choose what kind of agent to build.' }, { status: 400 });
  if ((await prisma.customAgent.count({ where: { userId: u.userId } })) >= MAX_AGENTS) return NextResponse.json({ error: `You can have up to ${MAX_AGENTS} agents. Delete one to add another.` }, { status: 400 });
  const config = sanitizeConfig(body.kind, body.config);
  const name = (typeof body.name === 'string' ? body.name.trim() : '').slice(0, 120) || agentLabel(body.kind, config);
  const agent = await prisma.customAgent.create({ data: { userId: u.userId, kind: body.kind, name, status: 'draft', publicKey: newPublicKey(), config: config as unknown as object, secret: sealSecrets({ webhookSecret: newSecret() }) } });
  return NextResponse.json({ agent: presentAgent(agent) }, { status: 201 });
}
