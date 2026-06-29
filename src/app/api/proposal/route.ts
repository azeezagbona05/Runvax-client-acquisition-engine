import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
import { Business } from '@/types';
import { estimatePrice } from '@/lib/scoring';
import { getEffectiveProfile } from '@/lib/userProfile';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { business, yourName, yourPhone }: {
    business: Business;
    yourName?: string;
    yourPhone?: string;
  } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 });
  }

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const price = estimatePrice(business.category, business.categoryTypes);
  const priceMin = '₦' + price.min.toLocaleString('en-NG');
  const priceMax = '₦' + price.max.toLocaleString('en-NG');

  const prompt = `You are a professional Nigerian web development agency writing a compelling one-page business proposal.

Client business:
- Name: ${business.name}
- Type: ${business.category}
- Location: ${business.address}
- Rating: ${business.rating ? `${business.rating}/5 with ${business.reviewCount} reviews` : 'not available'}
- Current website: ${business.hasWebsite ? business.website : 'NONE — they have no website'}
- About: ${business.description || 'N/A'}

Your company: ${yourName || profile.businessName} (${profile.senderName})
Contact: ${yourPhone || profile.whatsapp} | ${profile.replyEmail}
City: ${profile.city}
Tagline: ${profile.tagline}
Services offered: ${profile.services}
Suggested price range: ${priceMin} – ${priceMax}
Today's date: ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}

Write a professional, persuasive one-page website development proposal. Structure it exactly like this — use markdown formatting:

---PROPOSAL---
# WEBSITE DEVELOPMENT PROPOSAL

**Prepared for:** [Business Name]
**Prepared by:** [Your Company]
**Date:** [today]

---

## Understanding Your Business

[2-3 sentences showing you researched them — mention their category, location, and anything notable about their reputation/reviews. Show you understand their business context.]

## Why You Need a Website Now

[3 bullet points specific to their industry — missed customer opportunities, competitors who have websites, local search behavior in Nigeria. Be concrete with numbers or scenarios.]

## Our Proposed Solution

### Website Package: [Creative package name based on their business type]

**Your Investment: ${priceMin} – ${priceMax}**

**What's Included:**
- Professional, mobile-first website (5–8 pages)
- Custom design that reflects your brand identity
- WhatsApp chat button for instant customer contact
- Google Maps integration & directions
- Fast-loading, optimised for Nigerian internet speeds
- Contact form & clickable phone numbers
- Gallery / portfolio section (if applicable)
- Basic SEO setup so customers can find you on Google

**Pages:**
1. **Home** — Hero section, services overview, trust signals, CTA
2. **About** — Your story, team, and why choose you
3. **Services / Menu / Products** — Detailed listings
4. **Gallery** — Showcase of your work / premises
5. **Contact** — Map, hours, form, WhatsApp link

## Delivery Timeline

| Phase | Task | Duration |
|-------|------|----------|
| Phase 1 | Discovery & design mockup | Days 1–3 |
| Phase 2 | Full website development | Days 3–6 |
| Phase 3 | Review & revisions | Day 7 |
| Phase 4 | Launch & handover | Day 7–8 |

✅ **Website ready in 7–8 business days.**

## Payment Terms

| Milestone | Amount |
|-----------|--------|
| 50% deposit to begin | [half of min price] |
| Balance on delivery | [remaining] |

${profile.bankName && profile.bankAccount ? `**Bank Transfer:**
- Bank: ${profile.bankName}
- Account Number: ${profile.bankAccount}
- Account Name: ${profile.bankAcctName || profile.businessName}
${profile.paymentLink ? `- Or pay online: ${profile.paymentLink}` : ''}` : '*[Bank details will be provided upon agreement]*'}

## Our Guarantee

If you are not satisfied with the initial design concept, we redesign it **at no extra charge**. Your satisfaction is our priority.

---

**Ready to get started? Let's talk.**

📱 ${yourPhone || profile.whatsapp}
🏢 ${yourName || profile.businessName} — ${profile.tagline}

*This proposal is valid for 14 days.*`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const match = text.match(/---PROPOSAL---([\s\S]*?)$/);

    return NextResponse.json({ proposal: match?.[1]?.trim() ?? text.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
