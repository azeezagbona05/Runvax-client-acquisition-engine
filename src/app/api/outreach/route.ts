import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Business } from '@/types';
import { checkAndIncrementAI } from '@/lib/usage';
import { getEffectiveProfile } from '@/lib/userProfile';

export const dynamic = 'force-dynamic';

export type OutreachFramework = 'BAB' | 'AIDA' | 'PAS' | 'STORY';

const FRAMEWORK_GUIDES: Record<OutreachFramework, string> = {
  BAB: `Use the BAB (Before-After-Bridge) framework:
- BEFORE: Paint their current reality — invisible online, losing customers they don't even know they're losing, competitors showing up while they don't.
- AFTER: Paint the dream — showing up when someone in their area searches on Google OR asks ChatGPT for a recommendation, getting enquiries while they sleep.
- BRIDGE: Your website service is the bridge. Not just a website — a full digital presence built for 2026 (SEO + AIEO + GEO).`,

  AIDA: `Use the AIDA (Attention-Interest-Desire-Action) framework:
- ATTENTION: Open with one sharp, specific observation about their business that makes them stop scrolling.
- INTEREST: Build context — in 2026, customers don't just Google, they ask AI tools like ChatGPT and Perplexity "best [niche] near me". Only businesses with optimised websites show up.
- DESIRE: Make them want what you offer — not just a website but a 24/7 digital salesperson, an SEO-ready, AI-indexed presence.
- ACTION: One soft, easy CTA. Not "buy now" — just a conversation starter.`,

  PAS: `Use the PAS (Problem-Agitate-Solution) framework:
- PROBLEM: Identify the core gap — no website means invisible to Google, invisible to AI search engines, invisible to customers who research before they visit.
- AGITATE: Make the cost real — every day without a website, potential customers find competitors. In 2026, even ChatGPT recommends businesses from websites. Without one, you don't exist online.
- SOLUTION: Introduce your service as the relief — a website built for 2026: mobile-first, SEO-optimised, GEO (Generative Engine Optimization) ready so AI tools can discover and recommend them too.`,

  STORY: `Use STORYTELLING — make it personal and relatable:
- Open with a real-sounding story about a similar business in their niche (don't say it's fictional, frame it naturally).
- The business had no website, was losing customers to competitors without realising it.
- They got a proper website — mobile-first, SEO + GEO optimised for AI search — and within weeks started getting enquiries from people who found them on Google and through AI recommendations.
- Naturally connect the story to this prospect's situation.
- End with a gentle, curious question — not a pitch.`,
};

const POSITIONING = `
CORE POSITIONING — THIS IS THE HEART OF EVERY MESSAGE:
We do NOT sell "a website". We build a DIGITAL FRONT DOOR — a digital experience centre.
Frame it as the complete experience a customer has:
- BEFORE coming in-store / in-location: they search Google or ask an AI assistant, they find the business, see the reviews, the photos, the story, the offer — and decide to trust it before they ever walk in.
- DURING: the site answers their questions, shows directions, takes bookings/enquiries 24/7.
- AFTER leaving: it keeps them connected — repeat visits, referrals, reviews, loyalty.
This is a digital experience centre that shapes how people feel about the business at every touchpoint, not a brochure.

REVIEWS / SOCIAL PROOF ANGLE (use when the business HAS Google reviews):
- If they have reviews, point it out specifically: "You've earned [N] Google reviews — that's real trust most businesses dream of."
- Then the gap: that hard-earned trust has nowhere to land. When someone reads those reviews and searches for them, there's no website, no front door — so the trust leaks away to a competitor who has one.
- Make it sting gently: their reputation is already built; they're just not capturing the customers it's attracting.

KEY 2026 DIGITAL PRESENCE CONCEPTS TO WEAVE IN NATURALLY (pick 1-2, don't list them all):
- SEO: Google ranks websites, not social media pages — without a website they rank for nothing
- AIEO (AI Engine Optimization): When people ask ChatGPT, Gemini, or Perplexity "best [their niche] in [their city]", AI tools pull answers from websites. No website = not recommended by AI
- GEO (Generative Engine Optimization): Structuring website content so generative AI engines can discover, understand and recommend the business
- A digital front door works 24/7 — answering questions, building trust, taking enquiries while they sleep

DO NOT use all these terms — pick the most natural one for the niche and weave it in like a knowledgeable friend sharing insight, not a lecture.`;

const NIGERIANCONTEXT = `
NIGERIAN BUSINESS CONTEXT:
- Nigerians trust WhatsApp — always mention WhatsApp integration
- Most discovery happens through referrals and Google Maps — position website as the next step
- Business owners are busy — keep the message SHORT, warm, and respectful of their time
- Avoid sounding like a mass message — reference something specific about THEIR business
- Use warm Nigerian English tone — not formal British English, not American slang
- Never start with "Hope this message finds you well" or "My name is..."
- Don't preach — share insight like a knowledgeable friend, not a salesman`;

export async function POST(req: NextRequest) {
  const { business, framework = 'PAS' }: { business: Business; framework?: OutreachFramework } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 });
  }

  const usage = await checkAndIncrementAI();
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const frameworkGuide = FRAMEWORK_GUIDES[framework] || FRAMEWORK_GUIDES.PAS;

  const businessContext = `
BUSINESS RESEARCH:
- Name: ${business.name}
- Type/Niche: ${business.category}
- Location: ${business.address || 'Nigeria'}
- Phone: ${business.phone || 'unknown'}
- Has website: ${business.hasWebsite ? `Yes — ${business.website}` : 'NO — this is a prime opportunity'}
- Google Rating: ${business.rating ? `${business.rating}/5 stars with ${business.reviewCount} reviews` : 'not found — possibly not well-established on Google yet'}
- About: ${business.description || 'local business'}`;

  const systemPrompt = `You are a world-class copywriter specialising in outreach for Nigerian web developers and digital agencies. You write messages that feel like they came from a genuine, knowledgeable friend — not a spammer or salesperson.

Your messages:
✅ Are specific to the exact business and niche — never generic
✅ Show the prospect you actually looked at their business
✅ Educate without preaching — one sharp insight, delivered naturally
✅ Position the offer as a DIGITAL FRONT DOOR / digital experience centre — the experience customers have before, during and after visiting — NEVER as "just a website"
✅ Have a soft, curious CTA — opening a conversation, not closing a sale
✅ Sound like a human wrote them, not a template
✅ Never use phrases like "I hope this message finds you well", "My name is X and I...", "Are you interested in..."

${POSITIONING}
${NIGERIANCONTEXT}`;

  const userPrompt = `${businessContext}

COPYWRITING FRAMEWORK TO USE: ${framework}
${frameworkGuide}

${business.reviewCount ? `IMPORTANT: This business has ${business.reviewCount} Google reviews (${business.rating}/5). OPEN by acknowledging this specific number as earned trust, then reveal the gap — that trust has no digital front door to land on. Use the real number.` : `This business has few/no Google reviews — focus on visibility and being found, not on review count.`}

Write TWO outreach messages using the ${framework} framework:

---WHATSAPP---
[WhatsApp message — MAX 90 words. Warm, specific, one insight about their digital gap, soft CTA question. Add 1-2 natural emojis. Use the ${framework} structure but make it feel completely natural — not like a template.]

---EMAIL-SUBJECT---
[Subject line — max 8 words. Intriguing, specific, not salesy. No "Check this out" or "Quick question".]

---EMAIL-BODY---
[Email — MAX 200 words. Use the ${framework} framework fully. Open with a hook specific to their business. Weave in 1-2 of the 2026 digital presence concepts (GEO/AIEO/SEO) naturally. End with ONE clear, low-friction CTA.]

SENDER IDENTITY (use this in signatures and closing):
- Name / Agency: ${profile.businessName} (${profile.senderName})
- WhatsApp: ${profile.whatsapp}
- City: ${profile.city}
- Tagline: ${profile.tagline}
- Services: ${profile.services}

Sign the email naturally as ${profile.senderName} from ${profile.businessName}.
For WhatsApp, do NOT add a formal signature — just end naturally.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const whatsappMatch = text.match(/---WHATSAPP---([\s\S]*?)---EMAIL-SUBJECT---/);
    const subjectMatch = text.match(/---EMAIL-SUBJECT---([\s\S]*?)---EMAIL-BODY---/);
    const bodyMatch = text.match(/---EMAIL-BODY---([\s\S]*?)$/);

    return NextResponse.json({
      whatsapp: whatsappMatch?.[1]?.trim() ?? '',
      emailSubject: subjectMatch?.[1]?.trim() ?? '',
      emailBody: bodyMatch?.[1]?.trim() ?? '',
      framework,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
