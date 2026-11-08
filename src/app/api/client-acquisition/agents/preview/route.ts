import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkAndIncrementAI } from '@/lib/usage';
import { assistantReply, cleanHistory, MAX_MSG } from '@/lib/agents/chat';
import { configIssues, isKind, sanitizeConfig, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';
import { writePost } from '@/lib/agents/write';
import { knowledgeExcerpts } from '@/lib/knowledge/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { kind, config, message?, history?, topic? }: try an agent before (or after) saving it.
 * Uses the settings sent, so unsaved edits are tested too. Pure preview: nothing is stored, nobody is emailed,
 * nothing is published and no lead is created. Assistant: one reply to `message`. Visibility: one sample article.
 */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`agent-preview:${u.userId}`, { maxRequests: 20, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { kind?: unknown; config?: unknown; message?: unknown; history?: unknown; topic?: unknown };
  if (!isKind(b.kind)) return NextResponse.json({ error: 'Unknown agent kind.' }, { status: 400 });
  const cfg = sanitizeConfig(b.kind, b.config);
  const issues = configIssues(b.kind, cfg).filter((i) => !/Choose where the assistant works/.test(i));
  if (issues.length) return NextResponse.json({ error: `Before you can try it: ${issues[0]}` }, { status: 400 });

  let useAi = true;
  if (process.env.OPENAI_API_KEY) { const g = await checkAndIncrementAI(req); if (!g.ok) useAi = false; }

  if (b.kind === 'assistant') {
    const text = typeof b.message === 'string' ? b.message.trim().slice(0, MAX_MSG) : '';
    if (!text) return NextResponse.json({ error: 'Type a message to the assistant.' }, { status: 400 });
    const history = cleanHistory(b.history); const last = [...history].reverse().find((m) => m.r === 'v')?.t ?? '';
    const excerpts = await knowledgeExcerpts(u.userId, (cfg as AssistantConfig).knowledgeIds, `${text} ${last}`).catch(() => []);
    const out = await assistantReply(cfg as AssistantConfig, history, text, useAi, excerpts);
    // `used` tells the page whether the answer drew on the knowledge base.
    return NextResponse.json({ reply: out.reply, visitor: out.visitor, source: out.source, usedKnowledge: excerpts.length, notice: useAi ? undefined : 'Your daily AI allowance is used up, so the built-in replies answered.' });
  }
  const v = cfg as VisibilityConfig;
  const topic = (typeof b.topic === 'string' ? b.topic.trim().slice(0, 140) : '') || v.topics[0];
  const d = await writePost(v, topic, { useAi });
  return NextResponse.json({ ...d, topic, notice: useAi ? undefined : 'Your daily AI allowance is used up, so the built-in template wrote this.' });
}
