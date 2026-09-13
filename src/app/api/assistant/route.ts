// Runvax support agent — answers product questions from the knowledge base and
// diagnoses account-specific problems from a live account snapshot.
//
// Deliberately does NOT consume the user's daily AI allowance: asking for help
// should never cost someone the credits they came here to spend on outreach.
// Abuse is held back by a per-account hourly message cap instead.

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { generate, extractJson, hasProvider } from '@/lib/ai';
import { rateLimit, getIp } from '@/lib/rateLimiter';
import { retrieveForConversation } from '@/lib/assistant/retrieve';
import { getAccountSnapshot } from '@/lib/assistant/context';
import { KNOWN_ROUTES, SUPPORT_EMAIL } from '@/lib/assistant/knowledge';
import { SYSTEM_PROMPT, buildPrompt, ChatMessage } from '@/lib/assistant/prompt';
import { logAgentActivity } from '@/lib/agentActivity';

export const dynamic = 'force-dynamic';

interface AgentAction {
  label: string;
  href: string;
}

interface AgentReply {
  answer: string;
  actions?: AgentAction[];
  escalate?: boolean;
}

/** Keep prompts bounded regardless of what the client posts. */
const MAX_HISTORY = 8;
const MAX_CHARS_PER_MESSAGE = 2000;
const MESSAGES_PER_HOUR = 40;


function sanitizeActions(raw: unknown): AgentAction[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AgentAction[] = [];
  raw.forEach((item) => {
    if (out.length >= 3 || typeof item !== 'object' || item === null) return;
    const { label, href } = item as Partial<AgentAction>;
    if (typeof label !== 'string' || typeof href !== 'string') return;
    // Only routes we know exist — the model must not be able to invent a link.
    if (!KNOWN_ROUTES.includes(href) || seen.has(href)) return;
    seen.add(href);
    out.push({ label: label.slice(0, 40), href });
  });
  return out;
}

export async function POST(req: NextRequest) {
  if (!hasProvider('openai') && !hasProvider('gemini') && !hasProvider('groq')) {
    return NextResponse.json(
      { error: 'The assistant is not configured on this deployment.' },
      { status: 503 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Normalise whatever the client sent into a bounded, well-typed history.
  const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m): m is ChatMessage =>
      typeof m === 'object' && m !== null &&
      ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
      typeof (m as ChatMessage).content === 'string' &&
      (m as ChatMessage).content.trim().length > 0)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_MESSAGE) }));

  const userMessages = history.filter((m) => m.role === 'user').map((m) => m.content);
  if (userMessages.length === 0) {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  }

  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  const planId = (token?.plan as string) ?? 'free';

  const limited = rateLimit(`assistant:${userId ?? getIp(req)}`, {
    maxRequests: MESSAGES_PER_HOUR,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `You've sent a lot of messages in a short time. Try again in ${Math.ceil(limited.retryAfter / 60)} minutes, or email ${SUPPORT_EMAIL}.`,
        retryAfter: limited.retryAfter,
      },
      { status: 429 },
    );
  }

  const hits = retrieveForConversation(userMessages, 4);
  const snapshot = await getAccountSnapshot(userId, planId);
  const prompt = buildPrompt(history, hits, snapshot);

  try {
    const res = await generate({
      feature: 'assistant',   // override the provider with AI_PROVIDER_ASSISTANT
      system: SYSTEM_PROMPT,
      prompt,
      json: true,
      temperature: 0.3,       // support answers should be consistent, not creative
      maxTokens: 700,
    });

    const parsed = extractJson<AgentReply>(res.text);
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
    if (!answer) throw new Error('Empty answer from provider');

    const escalate = parsed.escalate === true;
    if (userId) {
      await logAgentActivity({
        userId,
        agentKey: 'support',
        action: escalate ? 'escalated' : 'question_answered',
        title: userMessages[userMessages.length - 1],
      });
    }

    return NextResponse.json({
      answer,
      actions: sanitizeActions(parsed.actions),
      escalate,
      sources: hits.map((h) => ({ id: h.article.id, title: h.article.title })),
    });
  } catch (err) {
    console.error('[assistant] generation failed', err);
    return NextResponse.json(
      {
        error: `Something went wrong on my side. Try asking again — or email ${SUPPORT_EMAIL} if it keeps happening.`,
      },
      { status: 500 },
    );
  }
}
