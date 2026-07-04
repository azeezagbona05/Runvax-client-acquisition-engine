import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
import { getEffectiveProfile } from '@/lib/userProfile';
import type {
  AgentType, Business, PsiDetails,
  ResearcherOutput, StrategistOutput, MarketerOutput, CopywriterOutput, BuilderOutput,
} from '@/types';

export const dynamic = 'force-dynamic';

function businessContext(b: Business, psi?: PsiDetails | null) {
  const reviews = b.reviews?.slice(0, 3).map(r => `"${r.text}" — ${r.rating}★`).join('\n') ?? '';
  return `Business: ${b.name}
Category: ${b.category}
Address: ${b.address ?? 'Nigeria'}
Website: ${b.website ?? 'none'}
Rating: ${b.rating ? `${b.rating}/5 (${b.reviewCount} reviews)` : 'N/A'}
${reviews ? `\nSample reviews:\n${reviews}` : ''}
${psi ? `\nPageSpeed scores — Performance: ${psi.categories.performance}/100, SEO: ${psi.categories.seo}/100, Accessibility: ${psi.categories.accessibility}/100` : ''}`;
}

function researcherPrompt(b: Business, psi?: PsiDetails | null): string {
  return `You are a business intelligence researcher for a Nigerian web design agency. Deeply analyse this business and extract real insights from the data available.

${businessContext(b, psi)}

Think carefully about what the reviews reveal, what the lack of a website (or a poor one) means for their business, and what signals exist about the owner and digital maturity.

Respond ONLY with valid JSON — no extra text:
{
  "ownerName": "best guess from reviews/about page, or null",
  "businessAge": "one of: new (<2 yrs) | growing (2-5 yrs) | established (5+ yrs) | unknown",
  "socialMedia": { "instagram": "@handle or null", "facebook": "page name or null", "twitter": "@handle or null" },
  "reviewSentiment": "positive | mixed | negative | unknown",
  "keyThemes": ["what customers consistently mention (good and bad)", "max 4 items"],
  "painPoints": ["specific digital/online problems this business has right now", "max 4 items"],
  "opportunities": ["specific things a better website or digital presence would unlock for them", "max 4 items"],
  "quickInsight": "One sharp, specific insight about why this business is a strong prospect right now — reference their actual data"
}`;
}

function strategistPrompt(b: Business, researcher: ResearcherOutput, psi?: PsiDetails | null): string {
  return `You are a senior B2B sales strategist at a Nigerian web design agency. Design the optimal approach to win this prospect.

${businessContext(b, psi)}

Research findings:
- Pain points: ${researcher.painPoints.join(', ')}
- Opportunities: ${researcher.opportunities.join(', ')}
- Review sentiment: ${researcher.reviewSentiment}
- Quick insight: ${researcher.quickInsight}
${researcher.ownerName ? `- Likely owner: ${researcher.ownerName}` : ''}

Design a specific, realistic sales strategy. Be concrete — not generic advice.

Respond ONLY with valid JSON — no extra text:
{
  "recommendedChannel": "whatsapp | email | call",
  "leadWith": "The single most compelling hook to open with — reference their specific data (PSI score, reviews, competitor, etc.)",
  "recommendedOffer": "The specific service package to pitch first — don't say 'website', say what kind and why",
  "expectedObjections": ["specific objections this type of business raises", "max 3"],
  "approachAngle": "The narrative that will resonate — why NOW, why THEM, why YOUR AGENCY",
  "urgencyTrigger": "What creates genuine urgency for this specific business (seasonal, competitor action, review momentum, etc.)",
  "winProbability": "high | medium | low"
}`;
}

function marketerPrompt(b: Business, researcher: ResearcherOutput, strategist: StrategistOutput): string {
  return `You are a marketing strategist. Build the value proposition for selling web design to this Nigerian business.

Business: ${b.name} (${b.category})
Sales approach: ${strategist.approachAngle}
Lead hook: ${strategist.leadWith}
Offer: ${strategist.recommendedOffer}
Their pain points: ${researcher.painPoints.join(', ')}
Their opportunities: ${researcher.opportunities.join(', ')}

Craft a compelling, specific marketing brief grounded in their actual situation.

Respond ONLY with valid JSON — no extra text:
{
  "valueProposition": "One sentence: exactly what transformation you deliver for this business specifically",
  "keyBenefits": ["benefit tied to their specific situation", "benefit 2", "benefit 3"],
  "costOfInaction": "What specifically continues to go wrong if they do nothing — be concrete about money or customers lost",
  "estimatedRoi": "Realistic estimate of what a better website could return for their business type in Lagos/Nigeria",
  "positioning": "How to position against their likely objection (already have a developer, not now, too expensive)"
}`;
}

function copywriterPrompt(
  b: Business,
  researcher: ResearcherOutput,
  strategist: StrategistOutput,
  marketer: MarketerOutput,
  profile: { senderName?: string; businessName?: string; city?: string; whatsapp?: string },
): string {
  return `You are an elite Nigerian B2B copywriter. Write outreach messages that feel personal and data-driven — not spammy templates.

Business: ${b.name} (${b.category}, ${b.address ?? 'Lagos'})
${researcher.ownerName ? `Owner: ${researcher.ownerName}` : ''}
Hook: ${strategist.leadWith}
Value proposition: ${marketer.valueProposition}
Offer: ${strategist.recommendedOffer}
Urgency: ${strategist.urgencyTrigger}
Sender: ${profile.senderName ?? 'Your Name'} from ${profile.businessName ?? 'Agency'}

Rules:
- WhatsApp opener: max 3 sentences, conversational, references something specific about their business
- Email: professional but warm, subject line creates curiosity not desperation
- Follow-ups: different angle each time, not "just checking in"
- Write in natural Nigerian business English (not overly formal, not too casual)

Respond ONLY with valid JSON — no extra text:
{
  "whatsappOpener": "Opening WhatsApp message — 2-3 sentences max, sounds human",
  "emailSubject": "Email subject line — specific and intriguing, no clickbait",
  "emailBody": "Full email body — 4-6 short paragraphs, ends with clear CTA",
  "followUp1": "Day 3 follow-up WhatsApp — different angle, still short",
  "followUp2": "Day 7 follow-up — final nudge, create mild urgency"
}`;
}

function builderPrompt(b: Business, researcher: ResearcherOutput): string {
  return `You are a web design director. Create a detailed website brief and build prompt for this Nigerian business.

Business: ${b.name}
Category: ${b.category}
Location: ${b.address ?? 'Nigeria'}
${b.rating ? `Reputation: ${b.rating}/5 stars with ${b.reviewCount} reviews` : ''}
Key themes: ${researcher.keyThemes.join(', ')}
What customers want: ${researcher.opportunities.join(', ')}

Design a website that solves their actual digital problems and matches their industry/audience.

Respond ONLY with valid JSON — no extra text:
{
  "pageStructure": ["list of pages in order, e.g. Home, Menu, Gallery, Reservations, About, Contact"],
  "keyFeatures": ["specific features this business needs, e.g. WhatsApp booking button, Google Maps embed, photo gallery, online menu"],
  "designStyle": "2-3 sentences describing the visual direction — colour palette, mood, typography that fits this business type",
  "contentBrief": "What content to gather from the client before building — photos, text, social links, etc.",
  "websitePrompt": "Complete, detailed prompt to paste into Lovable or Bolt to generate this website. Include business name, all pages, key features, design style, Nigerian market specifics, and mobile-first requirement. Minimum 200 words."
}`;
}

async function callGPT(client: OpenAI, prompt: string): Promise<unknown> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1200,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  const text = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      agentType: AgentType;
      business: Business;
      psiDetails?: PsiDetails | null;
      context?: {
        researcher?: ResearcherOutput;
        strategist?: StrategistOutput;
        marketer?: MarketerOutput;
      };
    };

    const { agentType, business, psiDetails, context = {} } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const usage = await checkAndIncrementAI(req);
    if (!usage.ok) return usage.error!;

    const client  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const profile = await getEffectiveProfile();

    let result: unknown;

    switch (agentType) {
      case 'researcher':
        result = await callGPT(client, researcherPrompt(business, psiDetails)) as ResearcherOutput;
        break;

      case 'strategist': {
        if (!context.researcher) return NextResponse.json({ error: 'Researcher must run first' }, { status: 400 });
        result = await callGPT(client, strategistPrompt(business, context.researcher, psiDetails)) as StrategistOutput;
        break;
      }

      case 'marketer': {
        if (!context.researcher || !context.strategist) {
          return NextResponse.json({ error: 'Researcher and Strategist must run first' }, { status: 400 });
        }
        result = await callGPT(client, marketerPrompt(business, context.researcher, context.strategist)) as MarketerOutput;
        break;
      }

      case 'copywriter': {
        if (!context.researcher || !context.strategist || !context.marketer) {
          return NextResponse.json({ error: 'Researcher, Strategist, and Marketer must run first' }, { status: 400 });
        }
        result = await callGPT(client, copywriterPrompt(business, context.researcher, context.strategist, context.marketer, profile)) as CopywriterOutput;
        break;
      }

      case 'builder': {
        if (!context.researcher) return NextResponse.json({ error: 'Researcher must run first' }, { status: 400 });
        result = await callGPT(client, builderPrompt(business, context.researcher)) as BuilderOutput;
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown agent type' }, { status: 400 });
    }

    return NextResponse.json({ agentType, result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/agents]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
