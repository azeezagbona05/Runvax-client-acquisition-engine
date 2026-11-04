import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkAndIncrementAI } from '@/lib/usage';
import { MAX_PROMPT, planAutomation } from '@/lib/automationAi';
import { sanitizeAutomation, summarize, engineSupport } from '@/lib/automation';
import { logAgent } from '@/lib/acqReplies';
import { OFFICIAL_TEMPLATES } from '@/lib/templateLibrary';
import { strategyFor } from '@/lib/templateEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { prompt, current? } — the campaign-setup agent. Turns plain English into an automation plan
 * (and edits the current one when `current` is sent). Uses OpenAI when available, within the plan's
 * daily AI allowance; otherwise the built-in planner. Nothing is saved here: the page applies the plan.
 */
export async function POST(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`auto-plan:${user.userId}`, { maxRequests: 12, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Slow down: too many requests. Try again in a minute.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as { prompt?: unknown; current?: unknown; brief?: unknown; templateId?: unknown };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT) : '';
  const current = body.current ? sanitizeAutomation(body.current) : null;

  // The AI counts against the plan's daily allowance; when it is used up the built-in planner still answers.
  let useAi = true;
  let limitNotice: string | undefined;
  if (process.env.OPENAI_API_KEY) {
    const gate = await checkAndIncrementAI(req);
    if (!gate.ok) { useAi = false; limitNotice = 'Your daily AI allowance is used up, so the built-in planner answered.'; }
  }

  const template = typeof body.templateId === 'string' ? OFFICIAL_TEMPLATES.find((t) => t.id === body.templateId) : undefined;
  const result = await planAutomation(prompt, current, { useAi, brief: body.brief, template });
  const automation = result.automation;
  await logAgent(user.userId, 'strategist', current ? 'Revised the campaign plan' : 'Planned a campaign', `${automation.emails.length} emails, built by ${result.source === 'ai' ? 'AI' : 'the built-in planner'}.`);
  return NextResponse.json({
    strategy: template && automation.brief ? strategyFor(template, automation.brief, automation) : null,
    automation, brief: result.brief ?? automation.brief ?? null, source: result.source, notice: limitNotice ?? result.notice,
    summary: summarize(automation), engine: engineSupport(automation),
  });
}
