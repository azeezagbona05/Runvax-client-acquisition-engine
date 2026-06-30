import { NextRequest, NextResponse } from 'next/server';
import { checkAndIncrementAI, requireFeature } from '@/lib/usage';
import { getEffectiveProfile } from '@/lib/userProfile';
import { generate, extractJson, hasProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';

interface Facts {
  clientProfile: string;
  pricingTiers: {
    budget: { range: string; who: string; approach: string };
    mid: { range: string; who: string; approach: string };
    premium: { range: string; who: string; approach: string };
  };
  recommendedEntry: 'budget' | 'mid' | 'premium';
  whyNow: string[];
  valueProps: string[];
}

interface Copy {
  objections: Array<{ objection: string; response: string }>;
  messagingTone: string;
  strategicInsight: string;
  openingLine: string;
}

export async function POST(req: NextRequest) {
  const { industry, location }: { industry: string; location: string } = await req.json();

  if (!hasProvider('openai') && !hasProvider('gemini')) {
    return NextResponse.json({ error: 'No AI provider configured (set OPENAI_API_KEY or GEMINI_API_KEY)' }, { status: 500 });
  }

  const gate = await requireFeature(req, 'marketBrief');
  if (!gate.ok) return gate.error!;

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const year = new Date().getFullYear();

  try {
    // ── Pass 1 · FACTS — Gemini with live Google Search grounding (falls back to OpenAI) ──
    const factsPrompt = `You are a market research expert for web development businesses, researching the market as of ${year}.

A ${profile.services} provider (${profile.businessName}, based in ${profile.city}) wants to prospect for clients in:
- Industry: ${industry}
- Location: ${location}

Use current, real market information (recent pricing, demand signals, and local context for this exact area). Be brutally honest about pricing — buyers in different areas have VERY different budgets (e.g. in Lagos, Lekki vs Ayobo is night and day). Do not be generic.

Respond ONLY with valid JSON in this exact structure:
{
  "clientProfile": "2-3 sentences: their size, revenue level, digital sophistication, and how price-conscious they are",
  "pricingTiers": {
    "budget": { "range": "₦X – ₦Y (or local currency)", "who": "who pays this and why", "approach": "how to pitch at this price" },
    "mid": { "range": "...", "who": "...", "approach": "..." },
    "premium": { "range": "...", "who": "...", "approach": "..." }
  },
  "recommendedEntry": "budget|mid|premium",
  "whyNow": ["reason 1 specific to this industry+location in ${year}", "reason 2", "reason 3"],
  "valueProps": ["best value proposition 1 for this exact audience", "value prop 2", "value prop 3"]
}`;

    const factsRes = await generate({
      feature: 'brief', // Gemini (grounded) when GEMINI_API_KEY is set; override via AI_PROVIDER_BRIEF
      system: 'You are a market research expert. Use current, real market information from Google Search where helpful. Return ONLY valid JSON in the requested structure. Be specific and honest about pricing realities by location.',
      prompt: factsPrompt,
      json: true,
      search: true,
      maxTokens: 1200,
    });
    const facts = extractJson<Facts>(factsRes.text);

    // ── Pass 2 · COPY — GPT-4o for the persuasion layer (falls back to Gemini if no OpenAI key) ──
    const copyPrompt = `You are a world-class sales copywriter for web developers selling websites to local businesses. Use the market research below to write a sharp, persuasive pitch layer.

MARKET: ${industry} in ${location}
CLIENT PROFILE: ${facts.clientProfile}
RECOMMENDED PRICE ENTRY: ${facts.recommendedEntry} (${facts.pricingTiers?.[facts.recommendedEntry]?.range ?? 'n/a'})
VALUE PROPS: ${(facts.valueProps ?? []).join(' | ')}

Respond ONLY with valid JSON in this exact structure:
{
  "objections": [
    { "objection": "the most common objection THESE clients give", "response": "best counter-response, 1-2 sentences, specific and confident" },
    { "objection": "second objection", "response": "counter-response" },
    { "objection": "third objection", "response": "counter-response" }
  ],
  "messagingTone": "1 sentence on tone: formal/casual, aspirational vs practical, what language/voice to use with this audience",
  "strategicInsight": "1 non-obvious insight about this specific market that most web developers miss",
  "openingLine": "A single WhatsApp opening line (under 30 words) crafted for this industry + location. Natural, warm, not salesy."
}`;

    let copy: Copy;
    try {
      const copyRes = await generate({
        provider: 'openai', // persuasion/copy → GPT-4o
        system: 'You are an elite sales copywriter. Return ONLY valid JSON in the requested structure. Be specific, confident, and human — never generic or salesy.',
        prompt: copyPrompt,
        json: true,
        maxTokens: 900,
      });
      copy = extractJson<Copy>(copyRes.text);
    } catch {
      // If the copy pass fails, still return the grounded facts with safe defaults
      copy = { objections: [], messagingTone: '', strategicInsight: '', openingLine: '' };
    }

    return NextResponse.json({
      ...facts,
      ...copy,
      sources: factsRes.sources ?? [],
      provider: factsRes.provider,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
