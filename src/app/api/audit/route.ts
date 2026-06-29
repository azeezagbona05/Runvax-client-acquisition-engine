import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Business } from '@/types';
import { checkAndIncrementAI } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    const usage = await checkAndIncrementAI(req);
    if (!usage.ok) return usage.error!;

    const { business }: { business: Business } = await req.json();
    if (!business?.name) {
      return NextResponse.json({ error: 'Business data required' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const competitorNote = business.competitors?.length
      ? `Nearby competitors WITH websites: ${business.competitors.join(', ')}`
      : 'No specific competitor data available';

    const prompt = `You are a web consultant auditing a local business's digital presence to help a web designer pitch them.

BUSINESS:
- Name: ${business.name}
- Category: ${business.category}
- Location: ${business.address}
- Has website: ${business.hasWebsite ? `Yes — ${business.website}` : 'NO WEBSITE'}
- Google rating: ${business.rating ? `${business.rating}/5 (${business.reviewCount} reviews)` : 'Not rated'}
- Last review: ${business.lastReviewDate || 'Unknown'}
- Opening hours on Google: ${business.hoursComplete ? 'Yes, complete' : 'Not listed or incomplete'}
- Description on Google: ${business.description ? 'Yes' : 'Not provided'}
- ${competitorNote}

Write a SHORT, punchy digital presence audit (max 250 words) that a web designer would share with this business owner to show them EXACTLY what they're missing.

Structure it as:

**YOUR DIGITAL PRESENCE AUDIT — ${business.name.toUpperCase()}**

✅ What you have:
[list 2-3 things they actually have — reviews, Google listing, phone, etc.]

❌ What's missing:
[list 3-5 specific gaps — no website, hours not listed, no Google indexing, competitors outranking them, AI tools can't recommend them, etc.]

📊 Competitor snapshot:
[1-2 sentences about their local competition — are competitors online? Who shows up when someone searches for their service in their area?]

💡 What a website would change:
[2-3 specific outcomes — more bookings, Google ranking, AI recommendations, 24/7 enquiries, etc. Make it specific to their niche.]

Keep the tone warm and helpful, not critical. This is a gift of insight, not a sales pitch. Use simple language.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [
        { role: 'system', content: 'You write clear, friendly, specific digital audits for local business owners who are not tech-savvy.' },
        { role: 'user', content: prompt },
      ],
    });

    const audit = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ audit });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
