import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export type SeoAnalysisSection =
  | 'keywords'
  | 'competitors'
  | 'content'
  | 'technical'
  | 'geo'
  | 'authority';

// ── Complete product brief — every feature, use case, audience segment ────────

const PRODUCT = `
PRODUCT: ProspectAI (prospecttool.com)
TAGLINE: The AI client-acquisition engine built for African web professionals

WHAT IT DOES — COMPLETE FEATURE LIST:
1. Business Discovery: Searches Google Maps/Places API to find local businesses without websites, with slow websites, or with poor online presence — filtered by industry, city, rating, phone availability
2. Lead Scoring: Automatically scores each business 0–10 based on no-website status, review count, rating, category, and location — "Hot leads" (8–10) are pinned at the top
3. Website Speed Analysis (PSI): Runs Google PageSpeed Insights on any business website — scores Performance, Accessibility, Best Practices, SEO on both mobile and desktop (0–100)
4. Website Weakness Report: AI-generated analysis of exactly why a business's website is losing customers — references actual PSI scores, identifies specific failures, quantifies revenue impact
5. AI Outreach Generation: Generates personalized WhatsApp messages AND email campaigns for each business — references their actual reviews, location, category, PSI score. Multiple copywriting frameworks (PAS, AIDA, direct)
6. Proposal Generator: Creates full professional PDF-ready proposals for web design services — includes scope, timeline, pricing, payment terms, ROI justification
7. Pipeline / Kanban Board: 6-stage sales pipeline (Found → Contacted → Interested → Proposal → Won → Lost) — drag-and-drop, notes, reminders, history
8. Conversation Logger: Tracks every message sent to every prospect — WhatsApp, email, calls — with timestamps and outcomes
9. Reply Intelligence: Paste any prospect reply (WhatsApp/email) → AI classifies intent (interested, price check, ghosting, won, not interested) → suggests correct pipeline stage → generates follow-up message
10. AI Team Panel: 5 specialized AI agents per prospect — Researcher (business intel), Strategist (sales approach), Marketer (value props), Copywriter (outreach messages), Builder (website brief)
11. Auto Prospecting Agent: Runs automated Google Places searches based on user preferences — queues results for human review before any action is taken
12. Bulk WhatsApp Outreach: Send WhatsApp Business API messages to dozens of prospects in one click — uses approved templates, tracks delivery
13. Email Blast: Send bulk personalized cold emails via SMTP — per-prospect personalization, subject line optimization
14. Market Intelligence Brief: Daily AI-generated brief on what businesses in the user's target market are doing online — trending categories, hot areas, competitor moves
15. Follow-up Sequences: Multi-step automated follow-up plans — Day 1 WhatsApp, Day 3 email, Day 7 nudge — AI-written, user-approved before sending
16. AI Growth Engine: 5 parallel SEO/GEO agents that generate keywords, 90-day content calendar, homepage copy, blog posts, schemas, llms.txt — specifically to rank ProspectAI itself on Google and AI platforms
17. Analytics Dashboard: Revenue pipeline value, daily outreach streak, win rate, average deal value, category performance, monthly projections
18. Rate Card Builder: Stores pricing packages (Basic/Pro/Premium website), terms, and payment info — auto-included in AI-generated proposals
19. Portfolio Manager: Upload past projects with descriptions — AI uses them to strengthen outreach credibility
20. SMTP Email Integration: Connect Gmail, Outlook, or any SMTP — send emails directly from the app with full deliverability control
21. WhatsApp Business API: Native WA Business integration — approved templates, one-click send, daily rate limiting

TARGET AUDIENCE (primary):
- Nigerian web designers and freelancers (Lagos, Abuja, Port Harcourt, Ibadan, Kano, Enugu)
- Nigerian digital agencies (1–20 person shops)
- African freelancers competing with Fiverr/Upwork
- Anyone selling web design, digital marketing, SEO, or app development to local businesses

TARGET AUDIENCE (secondary):
- Ghanaian web designers (Accra, Kumasi)
- Kenyan freelancers (Nairobi)
- UK-based Nigerian diaspora running agencies
- Global freelancers targeting African markets

CORE PROBLEM SOLVED:
Nigerian web professionals spend 3–5 hours daily manually searching Google, WhatsApp groups, and directories for potential clients. They compete on race-to-the-bottom platforms like Fiverr/Upwork where they can never win on price against Pakistani or Indian freelancers. ProspectAI automates the entire client-finding and outreach process — turning a 5-hour manual grind into a 15-minute daily routine.

PRICING:
- Free plan: limited searches/day, basic outreach
- Pro plan: unlimited searches, all AI features, proposals, email blast
- Agency plan: everything + bulk WA, team features, priority support

COMPETITIVE POSITION:
- Apollo.io: built for US enterprise sales — no Nigeria/Africa data, costs $49–$99/month, no WhatsApp, no web design workflow
- Hunter.io: email finder only — no prospecting, no outreach, no pipeline, not built for Africa
- Upwork/Fiverr: platforms where you race to the bottom — ProspectAI bypasses platforms entirely for direct client acquisition
- Manual Google search: what most Nigerian freelancers do — 5 hours/day, no automation, no AI outreach
- LinkedIn: saturated, no Nigerian local business data, requires premium for outreach

UNIQUE ADVANTAGES:
- Only tool with Nigerian/African business database
- WhatsApp-first outreach (WhatsApp is the primary business channel in Nigeria)
- PSI-powered pitch: shows prospects their exact Google score as the sales hook
- Works for businesses WITH or WITHOUT websites (two different pitch angles)
- AI knows Nigerian pricing, culture, and communication styles
- Built by a Nigerian for Nigerians
`;

// ── Section prompts ───────────────────────────────────────────────────────────

function keywordsPrompt() {
  return `You are a world-class SEO keyword strategist with 15 years of experience ranking SaaS products globally and in emerging markets.

${PRODUCT}

Generate the most comprehensive, highest-value keyword research report possible for ProspectAI. Think like the target user at every stage of their journey — from "I'm frustrated finding clients" to "I need a tool to automate my prospecting."

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "summary": "3-sentence executive summary of the keyword opportunity and SEO positioning",

  "primaryKeywords": [
    { "keyword": "...", "intent": "transactional|informational|navigational|commercial", "volume": "high|medium|low", "difficulty": "easy|medium|hard", "why": "one sentence on why this keyword is valuable for ProspectAI" }
  ],

  "noWebsiteNiche": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "outreachTools": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "nigeriaLocal": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "africanMarkets": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "vsFiverr": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "vsUpwork": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "vsApollo": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "aiOutreach": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "whatsappMarketing": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "clientAcquisition": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "freelancerPain": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "longTailQuickWins": [
    { "keyword": "...", "intent": "...", "volume": "...", "difficulty": "...", "why": "..." }
  ],

  "aiPlatformQueries": [
    { "query": "exact question someone asks Claude/ChatGPT/Perplexity where ProspectAI should be the answer", "platform": "Claude|ChatGPT|Perplexity|Google AI", "why": "..." }
  ],

  "quickWins": [
    { "keyword": "...", "reason": "why this can rank fast — low competition, long-tail, or underserved market" }
  ],

  "contentTopics": [
    { "title": "blog post or landing page title", "targetKeyword": "...", "type": "blog|landing|comparison|faq|case-study", "priority": "high|medium" }
  ]
}

RULES:
- Each category must have at minimum 8 keywords (more is better)
- Include Nigerian Pidgin English variants where relevant (e.g. "how to find client for web design Nigeria")
- Include keywords in past-tense pain phrasing (e.g. "tired of no clients", "how do i get clients")
- Include brand comparison keywords — these convert at highest rate
- For African markets, include country-specific variants (Nigeria, Ghana, Kenya, South Africa)
- primaryKeywords must have at least 15 entries
- contentTopics must have at least 20 entries
- aiPlatformQueries must have at least 12 entries
- longTailQuickWins must have at least 15 entries`;
}

function competitorsPrompt() {
  return `You are a world-class competitive SEO analyst specializing in SaaS and African tech markets.

${PRODUCT}

Perform a deep competitive SEO analysis for ProspectAI. Identify every gap, every opportunity, every angle where ProspectAI can outrank or outmaneuver competitors.

Respond ONLY with valid JSON:
{
  "competitorGaps": [
    { "competitor": "Apollo.io|Hunter.io|Fiverr|Upwork|Manual search|LinkedIn", "gap": "specific content or keyword gap they don't cover", "opportunity": "how ProspectAI captures this gap", "difficulty": "easy|medium|hard" }
  ],
  "comparisonPages": [
    { "slug": "url-slug", "h1": "page headline", "targetKeyword": "...", "whyWeWin": "specific reason ProspectAI beats this competitor for this audience", "priority": "high|medium" }
  ],
  "negativeKeywords": [
    "keywords where ProspectAI should NOT compete — wrong audience or unconvertible traffic"
  ],
  "contentMoats": [
    { "topic": "content area only ProspectAI can own authentically", "reason": "why no competitor can replicate this", "format": "blog|tool|data|community" }
  ],
  "linkTargets": [
    { "site": "site name or category", "url": "...", "strategy": "guest post|directory|mention|partnership", "why": "why this link matters for Nigerian/African SEO" }
  ],
  "serpFeatures": [
    { "keyword": "...", "feature": "featured snippet|PAA|knowledge panel|local pack", "howToCapture": "specific tactic" }
  ]
}`;
}

function contentPrompt() {
  return `You are a world-class SEO content strategist who has grown SaaS companies from 0 to 100,000 organic visitors.

${PRODUCT}

Build the complete content strategy for ProspectAI — every piece of content needed to dominate Nigerian/African freelance and web design search results.

Respond ONLY with valid JSON:
{
  "pillarPages": [
    { "title": "...", "slug": "...", "targetKeyword": "...", "wordCount": 2000, "sections": ["H2 section 1", "H2 section 2"], "internalLinks": ["pages to link to"] }
  ],
  "blogCalendar": [
    { "week": 1, "title": "...", "slug": "...", "keyword": "...", "type": "how-to|listicle|comparison|case-study|guide", "wordCount": 1200, "hook": "opening sentence that grabs a Nigerian freelancer" }
  ],
  "faqContent": [
    { "question": "exact question from Google People Also Ask or Nigerian forums", "answer": "comprehensive answer that references ProspectAI naturally (3-5 sentences)", "keyword": "..." }
  ],
  "caseStudyAngles": [
    { "title": "...", "protagonist": "type of user (e.g. Lagos freelancer, Abuja agency owner)", "result": "specific measurable outcome", "keyword": "..." }
  ],
  "landingPages": [
    { "url": "/...", "headline": "...", "targetAudience": "...", "primaryKeyword": "...", "cta": "..." }
  ],
  "videoScripts": [
    { "title": "YouTube video title", "hook": "first 15 seconds script", "keyword": "...", "platform": "YouTube|TikTok|Instagram" }
  ]
}

Rules:
- blogCalendar must cover 12 weeks minimum
- faqContent must have at least 20 Q&As targeting People Also Ask boxes
- pillarPages must have at least 5 entries
- landingPages must have at least 10 entries (city pages, comparison pages, use-case pages)`;
}

function technicalPrompt() {
  return `You are a world-class technical SEO engineer who specialises in Next.js applications and AI-era search optimization.

${PRODUCT}

Generate every technical SEO asset ProspectAI needs to rank on Google AND be discovered and cited by AI assistants (Claude, ChatGPT, Perplexity, Gemini). This is GEO — Generative Engine Optimization.

Respond ONLY with valid JSON:
{
  "metaTags": {
    "homepage": { "title": "...", "description": "...", "ogTitle": "...", "ogDescription": "...", "twitterTitle": "...", "twitterDescription": "..." },
    "blog": { "title": "...", "description": "..." },
    "pricing": { "title": "...", "description": "..." },
    "faq": { "title": "...", "description": "..." }
  },
  "schemaMarkup": {
    "organization": "complete JSON-LD as string",
    "softwareApplication": "complete JSON-LD as string — include applicationCategory, offers, featureList, screenshot",
    "faqPage": "complete JSON-LD FAQPage with 8 real Q&As about ProspectAI",
    "breadcrumb": "complete JSON-LD BreadcrumbList for main navigation",
    "webSite": "complete JSON-LD WebSite with SearchAction"
  },
  "llmsTxt": "complete /llms.txt file content — the standard for getting Claude/ChatGPT/Perplexity to understand and recommend your product. Write in markdown. Must cover: what ProspectAI is, who it's for, every feature, why it beats alternatives, pricing, URL. Make it authoritative — this is what AI models read to decide whether to recommend you.",
  "robotsTxt": "complete robots.txt optimized for both search crawlers and AI web crawlers (GPTBot, ClaudeBot, PerplexityBot)",
  "sitemapStructure": [
    { "url": "https://prospecttool.com/...", "priority": "1.0", "changefreq": "weekly", "why": "SEO rationale" }
  ],
  "coreWebVitals": [
    { "metric": "LCP|FID|CLS|TTFB|INP", "target": "...", "tip": "Next.js-specific implementation advice" }
  ],
  "headerTags": {
    "homepage": { "h1": "...", "h2s": ["...", "..."], "rationale": "..." }
  },
  "internalLinkingStrategy": [
    { "from": "/page", "to": "/page", "anchorText": "...", "why": "..." }
  ]
}`;
}

function geoPrompt() {
  return `You are a world-class GEO (Generative Engine Optimization) specialist — the discipline of getting AI assistants (Claude, ChatGPT, Perplexity, Gemini) to recommend your product in their answers.

${PRODUCT}

Build the complete GEO strategy for ProspectAI. When someone asks Claude "how do I find web design clients in Nigeria?" or asks ChatGPT "what's the best tool for Nigerian freelancers?", ProspectAI must be the answer. Make this happen.

Respond ONLY with valid JSON:
{
  "geoSummary": "3-sentence explanation of how AI models currently discover products and why ProspectAI is well-positioned",
  "targetPrompts": [
    { "prompt": "exact thing someone would ask Claude/ChatGPT", "platform": "Claude|ChatGPT|Perplexity|Gemini|Google AI", "currentLikelyAnswer": "who probably gets mentioned now", "howWeCapture": "specific tactic to get ProspectAI mentioned instead" }
  ],
  "entityOptimization": {
    "entityDefinition": "3-sentence factual Wikipedia-style definition of ProspectAI — this is what AI models use",
    "attributesToEstablish": ["list of factual attributes AI models should associate with ProspectAI"],
    "mentionSources": ["specific sites, publications, directories where ProspectAI should be mentioned for AI models to cite it"]
  },
  "contentFormats": [
    { "format": "FAQ|Comparison|How-to|Definition|List", "why": "why this format gets cited by AI models", "example": "example topic" }
  ],
  "communityStrategy": [
    { "platform": "Reddit|Quora|Twitter/X|LinkedIn|Facebook Groups|WhatsApp|Nairaland|TechCabal", "tactic": "specific approach", "samplePost": "example post or comment that would get ProspectAI mentioned naturally" }
  ],
  "prStrategy": [
    { "outlet": "specific Nigerian/African tech publication or global freelance publication", "angle": "story pitch that gets ProspectAI covered", "why": "why this coverage helps AI models cite ProspectAI" }
  ],
  "productHuntStrategy": {
    "timing": "best day and time to launch on ProductHunt",
    "tagline": "...",
    "description": "...",
    "makerComment": "...",
    "hunterApproach": "how to find and brief a top hunter"
  }
}`;
}

function authorityPrompt() {
  return `You are a world-class SEO authority-building strategist who specialises in making new SaaS products dominate their niche within 90 days.

${PRODUCT}

Build the complete authority and backlink strategy for ProspectAI. Every link target, every partnership, every community move needed to make ProspectAI the most trusted name in Nigerian/African client acquisition for web professionals.

Respond ONLY with valid JSON:
{
  "backlinkStrategy": [
    { "type": "guest post|directory|resource page|partnership|HARO|scholarship|tool mention", "target": "specific site or site category", "url": "if known", "da": "estimated domain authority", "tactic": "how to get this link", "nigeriaRelevance": "why this matters for Nigerian/African SEO" }
  ],
  "directoryListings": [
    { "directory": "specific directory name", "url": "...", "category": "...", "why": "SEO value — especially AI training data sources" }
  ],
  "partnershipTargets": [
    { "partner": "company or community", "type": "integration|affiliate|co-marketing|community", "pitch": "what you offer them", "benefit": "what ProspectAI gets" }
  ],
  "socialSignals": {
    "twitter": { "strategy": "...", "hashtags": ["...", "..."], "postFrequency": "...", "contentMix": "..." },
    "linkedin": { "strategy": "...", "targetGroups": ["..."], "contentMix": "..." },
    "youtube": { "strategy": "...", "channelFocus": "...", "postFrequency": "..." },
    "tiktok": { "strategy": "...", "contentStyle": "...", "nigerianAngle": "..." }
  },
  "nairalandStrategy": {
    "sections": ["relevant Nairaland sections to post in"],
    "postTypes": ["types of posts that get traction"],
    "sampleThread": "example thread title and opening that would go viral on Nairaland"
  },
  "ninetydayPlan": [
    { "week": "1-2", "actions": ["specific action 1", "specific action 2"], "expectedOutcome": "..." },
    { "week": "3-4", "actions": ["..."], "expectedOutcome": "..." },
    { "week": "5-8", "actions": ["..."], "expectedOutcome": "..." },
    { "week": "9-12", "actions": ["..."], "expectedOutcome": "..." }
  ],
  "metrics": [
    { "metric": "...", "target30d": "...", "target90d": "...", "howToMeasure": "..." }
  ]
}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

async function callGPT(client: OpenAI, prompt: string): Promise<unknown> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? '{}');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const { section } = await req.json() as { section: SeoAnalysisSection };
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let prompt: string;
    switch (section) {
      case 'keywords':    prompt = keywordsPrompt();    break;
      case 'competitors': prompt = competitorsPrompt(); break;
      case 'content':     prompt = contentPrompt();     break;
      case 'technical':   prompt = technicalPrompt();   break;
      case 'geo':         prompt = geoPrompt();         break;
      case 'authority':   prompt = authorityPrompt();   break;
      default:
        return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
    }

    const result = await callGPT(client, prompt);
    return NextResponse.json({ section, result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/seo-analysis]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
