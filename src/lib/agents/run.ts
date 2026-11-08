import { prisma } from '@/lib/prisma';
import { checkAndIncrementAIForUser } from '@/lib/usage';
import type { CustomAgent, CustomAgentPost } from '@prisma/client';
import { slugify } from './html';
import { nextRunFrom, sanitizeConfig, type VisibilityConfig } from './kinds';
import { pushAll, type PostOut, type PushResult } from './publish';
import { openSecrets } from './store';
import { writePost } from './write';

export const toPostOut = (p: Pick<CustomAgentPost, 'id' | 'slug' | 'title' | 'summary' | 'body' | 'keywords' | 'publishedAt'>): PostOut => ({
  id: p.id, slug: p.slug, title: p.title, summary: p.summary, body: p.body, keywords: Array.isArray(p.keywords) ? (p.keywords as string[]) : [], publishedAt: (p.publishedAt ?? new Date()).toISOString(),
});

async function uniqueSlug(agentId: string, title: string): Promise<string> {
  const base = slugify(title); let slug = base;
  for (let i = 2; i < 50 && (await prisma.customAgentPost.findUnique({ where: { agentId_slug: { agentId, slug } }, select: { id: true } })); i++) slug = `${base}-${i}`;
  return slug;
}

/** Marks a post published and pushes it to the connected destinations. Returns the push results (also saved on the post). */
export async function publishPost(agent: CustomAgent, post: CustomAgentPost): Promise<PushResult[]> {
  const cfg = sanitizeConfig('visibility', agent.config) as VisibilityConfig;
  const publishedAt = post.publishedAt ?? new Date();
  const pushed = await pushAll({ id: agent.id, name: agent.name }, cfg, openSecrets(agent.secret), toPostOut({ ...post, publishedAt }));
  await prisma.customAgentPost.update({ where: { id: post.id }, data: { status: 'published', publishedAt, pushed: pushed as unknown as object } });
  return pushed;
}

/** One run of a visibility agent: writes `count` articles (default = the agent's setting). Articles written from the built-in template are never auto-published. */
export async function runVisibilityAgent(agent: CustomAgent, user: { id: string; plan: string }, o: { count?: number } = {}): Promise<{ created: CustomAgentPost[]; notice?: string }> {
  const cfg = sanitizeConfig('visibility', agent.config) as VisibilityConfig;
  if (!cfg.topics.length) return { created: [], notice: 'Add at least one topic first.' };
  const count = Math.min(3, Math.max(1, o.count ?? cfg.postsPerRun));
  const recent = await prisma.customAgentPost.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: 'desc' }, take: 40, select: { title: true } });
  const done = await prisma.customAgentPost.count({ where: { agentId: agent.id } });
  const created: CustomAgentPost[] = []; let notice: string | undefined;
  for (let i = 0; i < count; i++) {
    const topic = cfg.topics[(done + i) % cfg.topics.length];
    const gate = await checkAndIncrementAIForUser(user.id, user.plan).catch(() => ({ ok: false }));
    if (!gate.ok) notice = 'Your daily AI allowance is used up, so the built-in writer drafted this for you to review.';
    const d = await writePost(cfg, topic, { recentTitles: [...recent.map((r) => r.title), ...created.map((c) => c.title)], useAi: gate.ok });
    const auto = cfg.approval === 'auto' && d.source === 'ai';
    const row = await prisma.customAgentPost.create({ data: { agentId: agent.id, userId: agent.userId, slug: await uniqueSlug(agent.id, d.title), title: d.title, summary: d.summary, body: d.body, keywords: d.keywords, source: d.source, status: 'draft' } });
    created.push(auto ? { ...row, ...(await publishAndReload(agent, row)) } : row);
  }
  await prisma.customAgent.update({ where: { id: agent.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunFrom(cfg) } });
  return { created, notice };
}
async function publishAndReload(agent: CustomAgent, row: CustomAgentPost) { await publishPost(agent, row); return (await prisma.customAgentPost.findUnique({ where: { id: row.id } })) ?? row; }
