import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI, logTokenUsage } from '@/lib/usage';
import { Business } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set in .env.local' }, { status: 500 });
    }
    const usage = await checkAndIncrementAI(req);
    if (!usage.ok) return usage.error!;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { business }: { business: Business } = await req.json();
    if (!business?.name) {
      return NextResponse.json({ error: 'Business data required' }, { status: 400 });
    }

    const reviewsText = business.reviews?.length
      ? business.reviews.map((r) => `"${r.text.slice(0, 120)}..." — ${r.author} (${r.rating}★)`).join('\n')
      : 'No reviews available';

    const hoursText = business.openingHours?.length
      ? business.openingHours.join(', ')
      : 'Not specified';

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `You are an expert web designer who writes detailed website build prompts for AI website builders (such as Lovable, Bolt, v0, and Cursor) that use React + Tailwind. Your prompts are specific, actionable, and produce beautiful, conversion-optimised websites for local businesses. Adapt to the business's location: use the right currency and a WhatsApp/contact CTA, and reflect local cultural context (e.g. naira & WhatsApp for Nigeria, USD for the US, GBP for the UK).`,
        },
        {
          role: 'user',
          content: `Generate a complete, detailed website build prompt for this local business that has NO website yet. Base every detail on the real business information below.

BUSINESS DETAILS:
- Name: ${business.name}
- Industry: ${business.category}
- Types: ${business.categoryTypes?.join(', ') || 'General business'}
- Address: ${business.address}
- Phone: ${business.phone || 'Not available'}
- Rating: ${business.rating ? `${business.rating}/5 (${business.reviewCount} reviews)` : 'Not rated yet'}
- Description: ${business.description || 'Local business seeking online presence for the first time'}
- Opening Hours: ${hoursText}
- Customer Reviews:
${reviewsText}

Create TWO sections in your response:

---WEBSITE PROMPT---
(Write the exact prompt to paste into an AI website builder like Lovable, Bolt, or v0. Be highly specific: include the business name, exact color scheme with hex codes, all pages and their sections, content for the hero, services, testimonials drawn from the real reviews, CTA buttons, a contact/WhatsApp button with the phone number, opening hours, footer content, and design style. Make it 350-500 words. Write it as a direct instruction to the builder, starting with "Build a professional website for [Business Name]...")

---WEBSITE STRATEGY---
(3-5 bullet points explaining the design and content choices made for this specific business type. Keep it brief.)`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';

    // Log token usage fire-and-forget
    if (usage.userId && completion.usage) {
      void logTokenUsage(usage.userId, 'openai', completion.usage.prompt_tokens, completion.usage.completion_tokens);
    }

    return NextResponse.json({ prompt: text });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/generate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
