import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { guardCron } from '@/lib/cron';
import { getAllPosts } from '@/lib/blog';
import { getGithubConfig, openContentDraftPR } from '@/lib/github';
import { logAgentActivity } from '@/lib/agentActivity';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Nova (SEO agent) working while nobody's watching: once a week, drafts a new
// blog post and opens a PR — never publishes directly. This is a statically
// built site, so a running function can't write into the live deployment;
// merging the PR is the human review step that actually ships the post.
// Called by Vercel Cron weekly, Monday 9am WAT (8am UTC).
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/generate-post", "schedule": "0 8 * * 1" }] }

// Runvax admin account — AgentActivity requires a userId, and this cron has
// no per-user context, so its own entries are attributed to the platform
// account whose email is ADMIN_EMAILS[0] (falls back gracefully if unset).
async function platformUserId(): Promise<string | null> {
  const email = (process.env.ADMIN_EMAILS ?? '').split(',')[0]?.trim().toLowerCase();
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

interface DraftedPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  body: string; // markdown body, no frontmatter
}

async function draftPost(existingTitles: string[]): Promise<DraftedPost> {
  const keywordSpec = fs.readFileSync(
    path.join(process.cwd(), 'content/blog/keyword-targets.md'), 'utf8',
  );
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `You are Nova, an SEO content agent for Runvax (an AI-powered prospecting/outreach tool for web designers and AI agencies).

Here is the full content strategy and keyword target list:
"""
${keywordSpec}
"""

Here are titles already published (do not repeat these or anything near-duplicate):
${existingTitles.map((t) => `- ${t}`).join('\n')}

Pick exactly ONE unpublished topic from the pillar/cluster plan above (prefer a cluster post that has a clear hub already published) and write the full post.

Return strict JSON: {
  "slug": "kebab-case-url-slug",
  "title": "...",
  "description": "...(one sentence, for meta description)...",
  "category": "...(matches the pillar name)...",
  "tags": ["...", "..."],
  "body": "...(full markdown body, 1200-1800 words, TLDR-first per the GEO guidance in the spec, no frontmatter, start directly with content)..."
}`,
    }],
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? '{}') as DraftedPost;
}

function toMdx(post: DraftedPost): string {
  const date = new Date().toISOString().slice(0, 10);
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: "${date}"`,
    `category: ${JSON.stringify(post.category)}`,
    `tags: ${JSON.stringify(post.tags ?? [])}`,
    'draft: true',
    '---',
    '',
  ].join('\n');
  return frontmatter + post.body;
}

export async function GET(req: NextRequest) {
  if (!guardCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const githubConfig = getGithubConfig();
  if (!githubConfig) {
    return NextResponse.json({
      error: 'GITHUB_TOKEN / GITHUB_REPO not configured — Nova can draft but cannot open a PR yet.',
    }, { status: 500 });
  }

  try {
    const existingTitles = getAllPosts().map((p) => p.title);
    const drafted = await draftPost(existingTitles);
    if (!drafted.slug || !drafted.title || !drafted.body) {
      throw new Error('Model returned an incomplete draft');
    }

    const mdx = toMdx(drafted);
    const date = new Date().toISOString().slice(0, 10);
    const branch = `nova/${drafted.slug}-${date}`;
    const filePath = `content/blog/${drafted.slug}.mdx`;

    const prUrl = await openContentDraftPR(githubConfig, {
      branch,
      filePath,
      fileContent: mdx,
      prTitle: `Nova: new post — ${drafted.title}`,
      prBody: `Autonomously drafted by Nova (SEO agent). Review the content, flip \`draft: true\` to \`false\` in the frontmatter, and merge to publish.\n\n**Title:** ${drafted.title}\n**Description:** ${drafted.description}\n**Category:** ${drafted.category}`,
    });

    const userId = await platformUserId();
    if (userId) {
      await logAgentActivity({
        userId,
        agentKey: 'seo',
        action: 'draft_prepared',
        title: `Drafted a new post: ${drafted.title}`,
        detail: prUrl,
      });
    }

    return NextResponse.json({ ok: true, title: drafted.title, prUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    console.error('[/api/cron/generate-post]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
