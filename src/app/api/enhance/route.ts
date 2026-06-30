import { NextRequest, NextResponse } from 'next/server';
import { checkAndIncrementAI } from '@/lib/usage';
import { generate, hasProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const MODES: Record<string, string> = {
  improve:    'Improve this message — make it sharper, more persuasive and more natural, while keeping its meaning and any facts/numbers intact.',
  shorter:    'Make this message noticeably shorter and punchier. Cut filler, keep the core hook, value and CTA.',
  persuasive: 'Make this more persuasive and compelling — a stronger hook and clearer value — while staying warm and human, never pushy.',
  friendlier: 'Make this warmer and friendlier, like a helpful friend rather than a salesperson. Soften any hard-sell language.',
  urgency:    'Add tasteful urgency and a reason to act now, without being pushy, spammy or using fake scarcity.',
  grammar:    'Fix only spelling, grammar, punctuation and flow. Do NOT change the tone, length, structure or meaning.',
};

export async function POST(req: NextRequest) {
  if (!hasProvider('openai') && !hasProvider('gemini')) {
    return NextResponse.json({ error: 'No AI provider configured' }, { status: 500 });
  }

  const { text, mode, kind, context } = await req.json() as {
    text: string;
    mode: string;
    kind?: 'whatsapp' | 'email' | 'generic';
    context?: Record<string, unknown>;
  };

  if (!text?.trim()) return NextResponse.json({ error: 'No text to enhance' }, { status: 400 });
  const instruction = MODES[mode] ?? MODES.improve;

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const channelRule =
    kind === 'whatsapp'
      ? 'This is a WhatsApp message: keep it short (ideally under ~120 words), use WhatsApp formatting (*bold*, _italic_), short paragraphs separated by blank lines, and end with a soft question.'
      : kind === 'email'
      ? 'This is an outreach email: keep it concise, skimmable, with short paragraphs and one clear CTA.'
      : 'Keep the format appropriate to the message.';

  const system = `You are an elite outreach copywriter for web developers pitching local businesses.
Rewrite the user's draft per the instruction. Keep their intent, facts and any names/numbers.
${channelRule}
Conventions: if you mention a "digital front door", write it as "digital front door (website)". If you mention AI tools or AI search, name examples in brackets "(like ChatGPT, Claude, Google AI)".
Return ONLY the rewritten message text — no preamble, no explanations, no surrounding quotes.`;

  const ctx = context && Object.keys(context).length
    ? `\n\nContext about the prospect (use only if helpful): ${JSON.stringify(context)}`
    : '';

  try {
    const result = await generate({
      feature: 'enhance',
      system,
      prompt: `INSTRUCTION: ${instruction}${ctx}\n\nDRAFT TO REWRITE:\n${text}`,
      maxTokens: 900,
      temperature: 0.8,
    });
    return NextResponse.json({ text: result.text.trim() });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to enhance' }, { status: 500 });
  }
}
