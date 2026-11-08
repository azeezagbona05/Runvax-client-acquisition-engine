import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkAndIncrementAI } from '@/lib/usage';
import { CAMPAIGN_MESSAGE, UNSUPPORTED_MESSAGE, classifyRequest } from '@/lib/agents/classify';
import { isKind } from '@/lib/agents/kinds';
import { MAX_PROMPT, planAgent } from '@/lib/agents/write';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { prompt, url?, kind? }: plain English in, agent settings out. Nothing is saved; the page shows the plan for review.
 * With no `kind`, RUNVAX first works out what is being asked for. Something it cannot build yet gets `supported: false` and a
 * plain message (and the request is noted for the admins); a campaign-shaped request is pointed to the campaign builder.
 */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`agent-plan:${u.userId}`, { maxRequests: 10, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: too many requests. Try again in a minute.' }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { kind?: unknown; prompt?: unknown; url?: unknown };
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim().slice(0, MAX_PROMPT) : '';
  if (prompt.length < 10) return NextResponse.json({ error: 'Tell the agent a little more: what your business does and what you want it to do.' }, { status: 400 });
  let useAi = true;
  if (process.env.OPENAI_API_KEY) { const g = await checkAndIncrementAI(req); if (!g.ok) useAi = false; }

  let kind = isKind(b.kind) ? b.kind : null;
  if (!kind) {
    const seen = await classifyRequest(prompt, { useAi });
    if (seen.kind === 'campaign') return NextResponse.json({ supported: false, reason: 'campaign', message: CAMPAIGN_MESSAGE, link: '/client-acquisition/automation' });
    if (seen.kind === 'unsupported') {
      // For the admins: what people ask for that RUNVAX cannot build yet. Best effort, and never blocks the answer.
      await prisma.adminAuditLog.create({ data: { actorEmail: 'agent-builder', action: 'unsupported_agent_request', title: 'Someone asked for an agent RUNVAX cannot build yet', detail: `user ${u.userId}: ${prompt.slice(0, 400)}` } }).catch(() => {});
      return NextResponse.json({ supported: false, reason: 'not_yet', message: UNSUPPORTED_MESSAGE });
    }
    kind = seen.kind;
  }
  const out = await planAgent(kind, prompt, { url: typeof b.url === 'string' ? b.url : '', useAi });
  return NextResponse.json({ supported: true, kind, ...out });
}
