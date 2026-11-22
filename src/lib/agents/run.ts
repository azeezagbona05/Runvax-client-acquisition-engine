import { prisma } from '@/lib/prisma';
import { checkAndIncrementAIForUser } from '@/lib/usage';
import type { CustomAgent, CustomAgentPost } from '@prisma/client';
import { slugify } from './html';
import { nextRunFrom, sanitizeConfig, type VisibilityConfig } from './kinds';
import { pushAll, type PostOut, type PushResult } from './publish';
import { openSecrets } from './store';
import { runReview } from './seoReview';

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

/**
 * One run of a visibility agent: reads the owner's website and stores a visibility review (status "report").
 * Reports are private to the owner. They are never published or pushed anywhere, and the public feeds only serve "published" rows.
 */
export async function runVisibilityAgent(agent: CustomAgent, user: { id: string; plan: string }, _o: { count?: number } = {}): Promise<{ created: CustomAgentPost[]; notice?: string }> {
  const cfg = sanitizeConfig('visibility', agent.config) as VisibilityConfig;
  if (!cfg.business.url) return { created: [], notice: 'Add your website address in Settings first.' };
  const last = await prisma.customAgentPost.findFirst({ where: { agentId: agent.id, status: 'report' }, orderBy: { createdAt: 'desc' }, select: { summary: true } });
  const previousScore = last ? Number(last.summary.match(/Score (\d+)\/100/)?.[1] ?? NaN) : NaN;
  const gate = await checkAndIncrementAIForUser(user.id, user.plan).catch(() => ({ ok: false }));
  const r = await runReview(cfg, { useAi: gate.ok, previousScore: Number.isFinite(previousScore) ? previousScore : null });
  if ('error' in r) return { created: [], notice: r.error };
  const row = await prisma.customAgentPost.create({ data: { agentId: agent.id, userId: agent.userId, slug: await uniqueSlug(agent.id, r.title), title: r.title, summary: r.summary, body: r.body, keywords: r.keywords, source: r.source, status: 'report' } });
  await prisma.customAgent.update({ where: { id: agent.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunFrom(cfg) } });
  return { created: [row], notice: gate.ok ? r.notice : r.notice ?? 'Your daily AI allowance is used up, so the built-in checklist wrote this review.' };
}
