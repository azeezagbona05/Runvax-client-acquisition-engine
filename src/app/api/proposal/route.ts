import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getToken } from 'next-auth/jwt';
import { checkAndIncrementAI, requireFeature } from '@/lib/usage';
import { Business } from '@/types';
import { estimatePrice } from '@/lib/scoring';
import { getEffectiveProfile } from '@/lib/userProfile';
import { createTransporter, proposalCopyHtml, proposalToProspectHtml } from '@/lib/email';
import { getAppName } from '@/lib/url';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { business, yourName, yourPhone, yourWebsite, priceFrom, priceTo, timeline, prospectEmail }: {
    business: Business;
    yourName?: string;
    yourPhone?: string;
    yourWebsite?: string;
    priceFrom?: string;
    priceTo?: string;
    timeline?: string;
    prospectEmail?: string;
  } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 });
  }

  const gate = await requireFeature(req, 'proposals');
  if (!gate.ok) return gate.error!;

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const estimated = estimatePrice(business.category, business.categoryTypes);
  const priceMin = priceFrom || ('₦' + estimated.min.toLocaleString('en-NG'));
  const priceMax = priceTo   || ('₦' + estimated.max.toLocaleString('en-NG'));
  const deliveryTimeline = timeline || '7–8 business days';
  const agencyName = yourName || profile.businessName;
  const agencyPhone = yourPhone || profile.whatsapp;
  const agencyWebsite = yourWebsite || profile.website;
  const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

  // Portfolio block — top 5 entries with descriptions
  const portfolioBlock = profile.portfolio.length > 0
    ? `\nOur portfolio (past websites we've built):\n${profile.portfolio.slice(0, 5).map((p) => `- ${p.url}${p.title ? ` (${p.title})` : ''}${p.description ? ` — ${p.description}` : ''}${p.category ? ` [${p.category}]` : ''}`).join('\n')}`
    : '';

  // Rate card context
  const rateCardBlock = profile.rateCardSummary
    ? `\nOur rate card (use these packages and terms in the proposal):\n${profile.rateCardSummary}`
    : '';

  // Payment terms
  const depositPct = profile.depositPct;
  const balancePct = 100 - depositPct;
  const validityDays = profile.validityDays;
  const revisionRounds = profile.revisionRounds;

  // Bank details block
  const bankBlock = profile.bankName && profile.bankAccount
    ? `**Bank Transfer:**\n- Bank: ${profile.bankName}\n- Account Number: ${profile.bankAccount}\n- Account Name: ${profile.bankAcctName || agencyName}\n${profile.paymentLink ? `- Or pay online: ${profile.paymentLink}` : ''}`
    : '*[Bank details will be provided upon agreement]*';

  // Category-specific mini-app suggestions
  const MINI_APPS: Record<string, string[]> = {
    'Real Estate': ['ROI / yield calculator', 'Mortgage & loan repayment calculator', 'Property search & filter with map view', 'Virtual tour embed', 'Investment comparison tool', 'PDF brochure gated behind lead form'],
    'Restaurant / Food': ['Online table reservation widget', 'Interactive digital menu with photos', 'Loyalty points tracker', 'Order-ahead / pre-order form', 'Daily specials pop-up banner'],
    'Healthcare': ['Symptom checker / health quiz', 'Appointment booking calendar', 'Doctor availability widget', 'Prescription refill request form', 'BMI / health calculator'],
    'Education': ['Course catalog with search & filter', 'Tuition fee calculator', 'Student enrollment form', 'Live class schedule widget', 'Quiz / aptitude test widget'],
    'Finance': ['Loan / EMI calculator', 'Savings goal tracker', 'Currency converter', 'Investment returns calculator', 'Tax estimation widget'],
    'Logistics': ['Shipping cost estimator', 'Package tracker widget', 'Delivery time calculator', 'Order pickup scheduler', 'Route coverage map'],
    'Fashion & Retail': ['Size guide / fit calculator', 'Product recommendation quiz', 'Lookbook gallery', 'Style wishlist builder', 'Discount code pop-up on exit intent'],
    'Hospitality': ['Room availability calendar', 'Booking request form', 'Room price comparison widget', 'Local attractions map', 'Early check-in request widget'],
    'Construction': ['Project cost estimator', 'Material quantity calculator', 'Before & after gallery slider', 'Free consultation booking form', 'Project timeline visualiser'],
    'Agriculture': ['Yield / harvest estimator', 'Seasonal planting calendar', 'Live commodity price widget', 'Bulk order inquiry form', 'Farm-to-table story section'],
  };
  const category = business.category ?? '';
  const miniApps = Object.entries(MINI_APPS).find(([key]) => category.toLowerCase().includes(key.toLowerCase()))?.[1]
    ?? ['WhatsApp chat widget', 'Contact / quote request form', 'Google Maps & directions', 'Customer testimonials slider', 'Lead capture pop-up'];

  const prompt = `You are a professional Nigerian web development agency writing a compelling, personalised website proposal.

=== CLIENT ===
- Business Name: ${business.name}
- Type: ${business.category}
- Location: ${business.address}
- Rating: ${business.rating ? `${business.rating}/5 (${business.reviewCount} reviews)` : 'not available'}
- Current website: ${business.hasWebsite ? business.website : 'NONE — they have NO website'}
- About: ${business.description || 'N/A'}

=== YOUR AGENCY ===
- Name: ${agencyName}
- Contact: ${agencyPhone}${profile.replyEmail ? ` | ${profile.replyEmail}` : ''}${agencyWebsite ? ` | ${agencyWebsite}` : ''}
- City: ${profile.city}
- Tagline: ${profile.tagline}
${rateCardBlock}
${portfolioBlock}

=== PROPOSAL PARAMETERS ===
- Price range for this client: ${priceMin} – ${priceMax}
- Delivery timeline: ${deliveryTimeline}
- Deposit: ${depositPct}% upfront, ${balancePct}% on delivery
- Revision rounds included: ${revisionRounds}
- Quote valid for: ${validityDays} days
- Today's date: ${today}

=== RECOMMENDED MINI-APPS FOR THIS CLIENT ===
Based on their industry (${category}), include these interactive features in the proposal:
${miniApps.map((a) => `- ${a}`).join('\n')}
These mini-apps increase visitor retention, generate leads, and make the website worth more to the client. Mention 3–4 of them naturally in the "What's Included" section and briefly explain WHY each one benefits their specific business.

Write a professional, persuasive one-page proposal in markdown. Use the rate card packages and features if provided. If portfolio sites are listed, include them in a "Our Work" or "Why Choose Us" section. Reference the client's business type, location, and rating naturally. Be concrete and specific — not generic.

Use this EXACT structure (markdown headings and formatting):

---PROPOSAL---
# WEBSITE DEVELOPMENT PROPOSAL

**Prepared for:** ${business.name}
**Prepared by:** ${agencyName}
**Date:** ${today}
**Valid until:** [date ${validityDays} days from today]

---

## Understanding Your Business

[2–3 sentences showing genuine research — reference their category, location, rating/reviews, and what the website would do for their specific business.]

## Why ${business.name} Needs a Website Now

[3 punchy bullet points tailored to their industry — lost customer opportunities, local search visibility, competitors, trust signals. Use numbers where possible.]

## Our Proposed Solution

### [Creative package name suited to their business]

**Investment: ${priceMin} – ${priceMax}**

**What's Included:**
[Use the rate card package features if available, otherwise use sensible defaults for a Nigerian web agency. 6–8 bullet points.]

**Pages we'll build:**
[List 4–6 pages with a brief one-line purpose each, specific to their business type.]

## Delivery Timeline

| Phase | Task | Duration |
|-------|------|----------|
[4 phases mapped to the ${deliveryTimeline} timeline]

✅ **Website ready in ${deliveryTimeline}.**

${profile.portfolio.length > 0 ? `## Our Work

Here are a few websites we've built for businesses like yours:
${profile.portfolio.slice(0, 4).map((p) => `- **${p.title || p.url}** — ${p.description || (p.category || 'Live website')} → ${p.url}`).join('\n')}

*Every site is mobile-first, fast-loading, and designed to convert visitors into customers.*
` : ''}
## Payment & Terms

| Milestone | Amount |
|-----------|--------|
| ${depositPct}% deposit to begin | [${depositPct}% of ${priceMin}] |
| Balance on delivery | [remaining ${balancePct}%] |

${bankBlock}

${revisionRounds > 0 ? `✅ **${revisionRounds} revision round${revisionRounds > 1 ? 's' : ''} included** — we'll refine the design until you're happy.` : ''}

## Our Guarantee

If you are not satisfied with the initial design concept, we redesign it **at no extra charge**. Your satisfaction is our priority.

---

**Ready to get started?**

📱 ${agencyPhone}${profile.replyEmail ? `\n✉️ ${profile.replyEmail}` : ''}${agencyWebsite ? `\n🌐 ${agencyWebsite}` : ''}
🏢 ${agencyName}${profile.tagline ? ` — ${profile.tagline}` : ''}

*This proposal is valid for ${validityDays} days from ${today}.*`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const match = text.match(/---PROPOSAL---([\s\S]*?)$/);
    const proposal = match?.[1]?.trim() ?? text.trim();

    const firstName = business.name.split(' ')[0];
    const coverMessage = `Hi ${firstName}! 😊

I've put together a personalised website proposal for *${business.name}* — it covers exactly what I'd build for you, the investment (${priceMin} – ${priceMax}), and delivery timeline (${deliveryTimeline}).

I've kept it clear and straightforward so you can go through it at your own pace. Feel free to ask me anything after you've had a look.

Looking forward to hearing from you! 🙏

— ${profile.senderName}
📱 ${profile.whatsapp}`;

    // Fire-and-forget emails — never block the response
    if (process.env.SMTP_HOST) {
      const appName = getAppName();
      const transporter = createTransporter();
      const jwtToken = await getToken({ req });
      const userId = (jwtToken?.id ?? jwtToken?.sub) as string | undefined;

      // #5 — self-copy to the freelancer
      if (userId) {
        prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
          .then((u) => {
            if (!u?.email) return;
            return transporter.sendMail({
              from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
              to: u.email,
              subject: `📋 Proposal saved — ${business.name}`,
              html: proposalCopyHtml(business.name, proposal, appName),
            });
          }).catch(() => {});
      }

      // #6 — send to prospect if email provided
      if (prospectEmail) {
        transporter.sendMail({
          from: agencyName
            ? `"${agencyName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`
            : (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ''),
          to: prospectEmail,
          subject: `Website Proposal for ${business.name} — ${agencyName}`,
          html: proposalToProspectHtml(proposal, agencyName ?? appName, agencyPhone, profile.replyEmail ?? undefined, agencyWebsite ?? undefined),
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      proposal,
      coverMessage,
      // Agent meta for print template
      agentMeta: {
        name: agencyName,
        phone: agencyPhone,
        email: profile.replyEmail,
        website: agencyWebsite,
        tagline: profile.tagline,
        city: profile.city,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
