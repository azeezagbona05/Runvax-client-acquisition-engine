import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
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
          content: `You are an expert web designer who creates detailed website briefs for Lovable.dev, an AI website builder that uses React + Tailwind. Your prompts are specific, actionable, and produce beautiful, conversion-optimised websites for local businesses. Always include Nigerian context when the business appears to be Nigerian (naira prices, WhatsApp CTAs, local cultural elements).`,
        },
        {
          role: 'user',
          content: `Generate a complete, detailed Lovable.dev website prompt for this local business that has NO website yet.

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

---LOVABLE PROMPT---
(Write the exact prompt to paste into Lovable.dev. Be highly specific: include the business name, exact color scheme with hex codes, all pages and their sections, content for the hero, features, testimonials, CTA buttons, WhatsApp button with the phone number, footer content, and design style. Make it 350-500 words. Write it as a direct instruction to Lovable, starting with "Build a professional website for [Business Name]...")

---WEBSITE STRATEGY---
(3-5 bullet points explaining the design and content choices made for this specific business type. Keep it brief.)`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ prompt: text });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/generate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
