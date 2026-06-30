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

    const reviewsText = business.reviews?.length
      ? business.reviews
          .map((r) => `- ${r.rating}★ "${r.text.slice(0, 160)}" — ${r.author}${r.time ? ` (${r.time})` : ''}`)
          .join('\n')
      : 'No individual reviews available';

    // Oldest of the sampled reviews hints at how long they've been earning reviews (track record proxy)
    const oldestReviewHint = business.reviews?.length
      ? business.reviews[business.reviews.length - 1].time || 'Unknown'
      : 'Unknown';

    const prompt = `You are a web consultant auditing a local business's digital presence to help a web designer pitch them.

BUSINESS:
- Name: ${business.name}
- Category: ${business.category}
- Location: ${business.address}
- Has website: ${business.hasWebsite ? `Yes — ${business.website}` : 'NO WEBSITE'}
- Google rating: ${business.rating ? `${business.rating}/5` : 'Not rated'}
- Total Google reviews: ${business.reviewCount ?? 0}
- Most recent review: ${business.lastReviewDate || 'Unknown'}
- Oldest sampled review (track-record hint): ${oldestReviewHint}
- Opening hours on Google: ${business.hoursComplete ? 'Yes, complete' : 'Not listed or incomplete'}
- Description on Google: ${business.description ? 'Yes' : 'Not provided'}
- ${competitorNote}

WHAT REAL CUSTOMERS SAY (use these to assess reputation & track record):
${reviewsText}

Write a SHORT, punchy digital presence audit (max 280 words) that a web designer would share with this business owner to show them EXACTLY what they're missing — and how much trust they're sitting on that a website would unlock.

Structure it as:

**YOUR DIGITAL PRESENCE AUDIT — ${business.name.toUpperCase()}**

🌟 Your reputation & track record:
[2-3 sentences using their real numbers: how many reviews, their rating, how recent the last review is (are they active/busy?), and how far back reviews go (how long they've clearly been serving customers). Quote or paraphrase 1 real review. Make them feel proud — this trust is an asset they're under-using.]

✅ What you have:
[list 2-3 things they actually have — strong reviews, Google listing, phone, etc.]

❌ What's missing:
[list 3-5 specific gaps — no website, hours not listed, no Google indexing, competitors outranking them, AI tools can't recommend them, no place to show off these reviews, etc.]

📊 Competitor snapshot:
[1-2 sentences about their local competition — are competitors online? Who shows up when someone searches for their service in their area?]

💡 What a website would change:
[2-3 specific outcomes — turn ${business.reviewCount ?? 'their'} reviews into bookings, Google ranking, AI recommendations, 24/7 enquiries, etc. Make it specific to their niche.]

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
