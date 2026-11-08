import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { configIssues, isKind, sanitizeConfig } from '@/lib/agents/kinds';
import { presentAgent } from '@/lib/agents/present';
import { newSecret, openSecrets, sealSecrets } from '@/lib/agents/store';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const own = (id: string, userId: string) => prisma.customAgent.findFirst({ where: { id, userId } });

export async function GET(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params; const a = await own(id, u.userId);
  if (!a) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const [posts, chats] = await Promise.all([
    a.kind === 'visibility' ? prisma.customAgentPost.findMany({ where: { agentId: a.id, status: { not: 'rejected' } }, orderBy: { createdAt: 'desc' }, take: 60, select: { id: true, slug: true, title: true, summary: true, body: true, status: true, source: true, pushed: true, publishedAt: true, createdAt: true } }) : [],
    a.kind === 'assistant' ? prisma.customAgentChat.findMany({ where: { agentId: a.id }, orderBy: { updatedAt: 'desc' }, take: 40, select: { id: true, channel: true, visitor: true, status: true, messages: true, updatedAt: true } }) : [],
  ]);
  return NextResponse.json({ agent: presentAgent(a, { posts: posts.filter((p) => p.status === 'published').length, drafts: posts.filter((p) => p.status === 'draft').length, chats: chats.length, leads: chats.filter((c) => c.status === 'lead').length }), posts, chats });
}

/** PATCH { name?, status?, config?, secrets? }. Switching on needs a complete setup; secrets are write-only. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params; const a = await own(id, u.userId);
  if (!a || !isKind(a.kind)) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { name?: unknown; status?: unknown; config?: unknown; secrets?: { wpPassword?: unknown; telegramToken?: unknown; rotateWebhookSecret?: unknown } };
  const data: Record<string, unknown> = {};
  if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim().slice(0, 120);
  const cfg = b.config !== undefined ? sanitizeConfig(a.kind, b.config) : sanitizeConfig(a.kind, a.config);
  if (b.config !== undefined) data.config = cfg as unknown as object;
  if (b.secrets) {
    const s = openSecrets(a.secret);
    if (typeof b.secrets.wpPassword === 'string') s.wpPassword = b.secrets.wpPassword.trim().slice(0, 200) || undefined;
    if (typeof b.secrets.telegramToken === 'string') s.telegramToken = b.secrets.telegramToken.trim().slice(0, 200) || undefined;
    if (b.secrets.rotateWebhookSecret) s.webhookSecret = newSecret();
    data.secret = sealSecrets(s);
  }
  if (b.status === 'active' || b.status === 'paused' || b.status === 'draft') {
    if (b.status === 'active') { const issues = configIssues(a.kind, cfg); if (issues.length) return NextResponse.json({ error: issues[0], issues }, { status: 400 }); data.nextRunAt = new Date(); }
    data.status = b.status;
  }
  const saved = await prisma.customAgent.update({ where: { id: a.id }, data });
  return NextResponse.json({ agent: presentAgent(saved) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params; const a = await own(id, u.userId);
  if (!a) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  await prisma.customAgent.delete({ where: { id: a.id } });
  return NextResponse.json({ ok: true });
}
