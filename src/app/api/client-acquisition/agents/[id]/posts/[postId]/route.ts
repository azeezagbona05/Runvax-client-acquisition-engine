import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { htmlToText, sanitizeHtml } from '@/lib/agents/html';
import { publishPost } from '@/lib/agents/run';

export const dynamic = 'force-dynamic';

/** PATCH { action: 'publish' | 'reject' | 'unpublish' | 'edit', title?, summary?, body? } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; postId: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id, postId } = await ctx.params;
  const agent = await prisma.customAgent.findFirst({ where: { id, userId: u.userId } });
  const post = agent ? await prisma.customAgentPost.findFirst({ where: { id: postId, agentId: agent.id } }) : null;
  if (!agent || !post) return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { action?: unknown; title?: unknown; summary?: unknown; body?: unknown };
  if (b.action === 'edit') {
    const title = typeof b.title === 'string' ? b.title.replace(/<[^>]*>/g, '').trim().slice(0, 190) : post.title;
    const summary = typeof b.summary === 'string' ? b.summary.replace(/<[^>]*>/g, '').trim().slice(0, 380) : post.summary;
    const body = typeof b.body === 'string' ? sanitizeHtml(b.body) : post.body;
    if (!title || htmlToText(body).length < 20) return NextResponse.json({ error: 'An article needs a title and some text.' }, { status: 400 });
    const saved = await prisma.customAgentPost.update({ where: { id: post.id }, data: { title, summary, body, source: post.source === 'ai' ? 'ai' : 'manual' } });
    return NextResponse.json({ post: { id: saved.id, title: saved.title, status: saved.status } });
  }
  if (b.action === 'publish') { const pushed = await publishPost(agent, post); return NextResponse.json({ ok: true, pushed }); }
  if (b.action === 'unpublish') { await prisma.customAgentPost.update({ where: { id: post.id }, data: { status: 'draft' } }); return NextResponse.json({ ok: true }); }
  if (b.action === 'reject') { await prisma.customAgentPost.update({ where: { id: post.id }, data: { status: 'rejected' } }); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
