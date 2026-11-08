import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkAndIncrementAI } from '@/lib/usage';
import { isKind } from '@/lib/agents/kinds';
import { MAX_PROMPT, planAgent } from '@/lib/agents/write';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST { kind, prompt, url? }: plain English in, agent settings out. Nothing is saved; the page shows the plan for review. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`agent-plan:${u.userId}`, { maxRequests: 10, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: too many requests. Try again in a minute.' }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { kind?: unknown; prompt?: unknown; url?: unknown };
  if (!isKind(b.kind)) return NextResponse.json({ error: 'Choose what kind of agent to build.' }, { status: 400 });
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim().slice(0, MAX_PROMPT) : '';
  if (prompt.length < 10) return NextResponse.json({ error: 'Tell the agent a little more: what your business does and what you want it to do.' }, { status: 400 });
  let useAi = true;
  if (process.env.OPENAI_API_KEY) { const g = await checkAndIncrementAI(req); if (!g.ok) useAi = false; }
  const out = await planAgent(b.kind, prompt, { url: typeof b.url === 'string' ? b.url : '', useAi });
  return NextResponse.json(out);
}
