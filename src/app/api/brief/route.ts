import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
import { getEffectiveProfile } from '@/lib/userProfile';

export async function POST(req: NextRequest) {
  const { industry, location }: { industry: string; location: string } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const usage = await checkAndIncrementAI();
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are a market research expert for web development businesses in Nigeria in 2026.

A ${profile.services} provider (${profile.businessName}, based in ${profile.city}) wants to prospect for clients in:
- Industry: ${industry}
- Location: ${location}, Nigeria

Give a focused, realistic market intelligence brief. Be brutally honest about pricing — Nigerian buyers in different areas have VERY different budgets (Lekki vs Ayobo is night and day). Do not be generic.

Respond ONLY with valid JSON in this exact structure:
{
  "clientProfile": "2-3 sentences describing these businesses: their size, revenue level, digital sophistication, and how price-conscious they are",
  "pricingTiers": {
    "budget": { "range": "₦X – ₦Y", "who": "who pays this and why", "approach": "how to pitch at this price" },
    "mid": { "range": "₦X – ₦Y", "who": "who pays this and why", "approach": "how to pitch at this price" },
    "premium": { "range": "₦X – ₦Y", "who": "who pays this and why", "approach": "how to pitch at this price" }
  },
  "recommendedEntry": "budget|mid|premium",
  "whyNow": ["reason 1 specific to this industry+location in 2026", "reason 2", "reason 3"],
  "valueProps": ["best value proposition 1 for this exact audience", "value prop 2", "value prop 3"],
  "objections": [
    { "objection": "most common objection they'll give", "response": "best counter-response (1-2 sentences)" },
    { "objection": "second objection", "response": "counter-response" },
    { "objection": "third objection", "response": "counter-response" }
  ],
  "messagingTone": "1 sentence on tone: formal/casual, aspiration vs practical, what language to use",
  "strategicInsight": "1 non-obvious insight about this specific market that most web developers miss — something that will make the developer more successful",
  "openingLine": "A single WhatsApp opening line (under 30 words) crafted specifically for this industry + location. Natural, not salesy."
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a Nigeria market research expert. Return only valid JSON. Be specific, practical, and honest about pricing realities in different Nigerian locations.' },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
