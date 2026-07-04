import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
import type { ProspectStage } from '@/types';

export const dynamic = 'force-dynamic';

export interface ReplyAnalysis {
  intent: 'interested' | 'price_check' | 'needs_info' | 'wants_demo' | 'not_interested' | 'ghost' | 'won';
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  suggestedStage: ProspectStage;
  stageReason: string;
  followUp: string;
  urgency: 'high' | 'medium' | 'low';
}

export async function POST(req: NextRequest) {
  try {
    const { replyText, businessName, businessCategory, currentStage } = await req.json() as {
      replyText: string;
      businessName: string;
      businessCategory?: string;
      currentStage?: ProspectStage;
    };

    if (!replyText?.trim()) {
      return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const usage = await checkAndIncrementAI(req);
    if (!usage.ok) return usage.error!;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a Nigerian B2B sales intelligence analyst. Analyse this WhatsApp/email reply from a business prospect and extract sales intelligence.

Business: ${businessName}${businessCategory ? ` (${businessCategory})` : ''}
Current pipeline stage: ${currentStage ?? 'contacted'}
Their reply:
"""
${replyText}
"""

Classify the reply and determine the best next action. Consider Nigerian business communication styles — they may be indirect, polite rejections or warm interest depending on phrasing.

Respond ONLY with valid JSON:
{
  "intent": "one of: interested | price_check | needs_info | wants_demo | not_interested | ghost | won",
  "sentiment": "positive | neutral | negative",
  "summary": "one sentence summary of what they actually said/want",
  "suggestedStage": "one of: found | contacted | interested | proposal | won | lost",
  "stageReason": "why this stage fits — 1 short sentence",
  "followUp": "exact follow-up message to send in reply (WhatsApp style, 2-3 sentences max, Nigerian B2B tone)",
  "urgency": "high | medium | low"
}

Stage mapping guide:
- interested = they showed genuine interest, asked questions, want to know more
- price_check = they asked about price/cost → still 'interested' stage
- needs_info = they want more details before deciding → 'interested'
- wants_demo = they want to see your work → 'proposal'
- not_interested = clear rejection → 'lost'
- ghost = vague non-answer, probably ignoring → stay at 'contacted'
- won = they agreed to proceed, said yes, paid → 'won'`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as ReplyAnalysis;
    return NextResponse.json({ result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/reply-intelligence]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
