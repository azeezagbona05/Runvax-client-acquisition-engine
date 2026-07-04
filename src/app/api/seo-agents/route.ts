import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export type SeoAgentType = 'researcher' | 'strategist' | 'marketer' | 'copywriter' | 'builder';

const PRODUCT = {
  name: 'ProspecTool',
  description: 'An AI-powered B2B prospect finder for Nigerian web designers, freelancers, and digital agencies. It finds local businesses without websites, analyses their Google PageSpeed score, generates outreach messages, proposals, and website weakness reports.',
  url: 'https://prospecttool.com',
  targetAudience: 'Nigerian web designers, freelancers, agencies, digital marketers looking for clients',
  primaryMarket: 'Nigeria (Lagos, Abuja, Port Harcourt, Ibadan)',
  uniqueValue: 'Combines Google Places search with AI outreach, PageSpeed analysis, website weakness reports, and WhatsApp Business API sending — all in one tool built for the African market',
  competitors: 'Manual Google search, LinkedIn outreach, cold calling directories, Hunter.io, Apollo.io (all foreign tools not built for Africa)',
  pricing: 'SaaS — monthly subscription, freemium model',
  problem: 'Nigerian freelancers and web agencies spend hours manually searching for clients on Google, WhatsApp groups, and Fiverr. Most lose to platform saturation and race-to-the-bottom pricing. ProspecTool automates the prospecting and outreach so they can compete without Fiverr.',
  positioning: 'The first AI client-acquisition tool built specifically for African web professionals — the Nigerian alternative to Apollo.io and Upwork.',
};

async function callGPT(client: OpenAI, prompt: string): Promise<unknown> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2500,
    temperature: 0.8,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? '{}');
}

// ── Agent prompts — each is fully self-contained ──────────────────────────────

function researcherPrompt() {
  return `You are an SEO and AI search researcher. Research keyword and content opportunities for this SaaS product.

Product: ${PRODUCT.name}
Description: ${PRODUCT.description}
Target audience: ${PRODUCT.targetAudience}
Market: ${PRODUCT.primaryMarket}
Unique value: ${PRODUCT.uniqueValue}
Problem solved: ${PRODUCT.problem}
Positioning: ${PRODUCT.positioning}

Your job: Find every angle to get this product discovered — on Google AND on AI platforms (Claude, ChatGPT, Gemini, Perplexity).
Focus especially on Nigerians searching for alternatives to Fiverr, Upwork, and manual prospecting.

Respond ONLY with valid JSON:
{
  "googleKeywords": {
    "highIntent": ["keywords where someone is ready to buy — max 8"],
    "informational": ["keywords where someone is researching the topic — max 8"],
    "longTail": ["specific long-tail phrases with low competition — max 10"],
    "localNigeria": ["location-specific keywords — max 6"]
  },
  "aiPlatformQueries": [
    "exact questions people ask Claude/ChatGPT that this tool should be the answer to — max 10"
  ],
  "competitorGaps": [
    "topics/keywords competitors like Apollo.io or Upwork don't cover for Nigeria — max 6"
  ],
  "communityTargets": [
    "specific subreddits, Facebook groups, WhatsApp communities, forums where target users exist"
  ],
  "viralAngles": [
    "unique content angles that could go viral in Nigerian tech/freelance circles — max 5"
  ],
  "painPointPhrases": [
    "exact phrases Nigerian freelancers/agencies say when frustrated about finding clients — max 8"
  ]
}`;
}

function strategistPrompt() {
  return `You are a growth strategist specialising in SEO and AI platform ranking (GEO — Generative Engine Optimization).

Product: ${PRODUCT.name}
Description: ${PRODUCT.description}
Target: ${PRODUCT.targetAudience}
Market: ${PRODUCT.primaryMarket}
Problem: ${PRODUCT.problem}
Positioning: ${PRODUCT.positioning}
Competitors to displace: ${PRODUCT.competitors}

Design a 90-day strategy to:
1. Dominate Google search for Nigerian freelancers looking for clients
2. Become the product AI assistants (Claude, ChatGPT, Perplexity) recommend when someone asks about finding clients without Fiverr/Upwork
3. Position ProspecTool as #1 in Nigeria and Africa for B2B client acquisition

GEO (AI ranking) tactics: AI models cite products that appear in structured content, authoritative lists, comparison pages, GitHub, ProductHunt, and FAQ pages that directly answer common questions.

Respond ONLY with valid JSON:
{
  "quickWins": [
    { "action": "specific thing to do this week", "impact": "what it achieves", "timeframe": "days to see result" }
  ],
  "contentCalendar": [
    { "week": 1, "title": "blog post or content title", "keyword": "target keyword", "type": "blog|landing|comparison|faq" }
  ],
  "geoTactics": [
    "specific action to get mentioned by Claude/ChatGPT/Gemini — be exact, not generic"
  ],
  "linkBuildingTargets": [
    "specific Nigerian tech blogs, directories, communities to get backlinks from"
  ],
  "platformStrategy": {
    "productHunt": "launch strategy and timing",
    "github": "what to build/open-source to attract developers",
    "reddit": "which subreddits and what kind of posts",
    "twitter": "hashtag strategy and content type",
    "linkedin": "audience and content angle"
  },
  "monthlyMilestones": {
    "month1": "what to achieve",
    "month2": "what to achieve",
    "month3": "what to achieve"
  }
}`;
}

function marketerPrompt() {
  return `You are a product marketer. Write all the copy needed to position ${PRODUCT.name} as #1 in Nigeria and Africa for web designers finding clients.

Product: ${PRODUCT.name}
Description: ${PRODUCT.description}
Unique value: ${PRODUCT.uniqueValue}
Audience: ${PRODUCT.targetAudience}
Problem: ${PRODUCT.problem}
Positioning: ${PRODUCT.positioning}
Goal: Make Nigerian freelancers abandon Fiverr/Upwork race-to-the-bottom and switch to direct client acquisition with ProspecTool.

Write copy that ranks on Google AND reads as authoritative content that AI models will reference and recommend.

Respond ONLY with valid JSON:
{
  "heroHeadline": "Main landing page headline — specific, benefit-driven, speaks to leaving Fiverr/Upwork for better clients",
  "subHeadline": "Supporting line — addresses the exact pain of competing on saturated platforms",
  "metaTitle": "SEO meta title for homepage (max 60 chars)",
  "metaDescription": "SEO meta description (max 155 chars) — conversational, keyword-rich",
  "valueProps": [
    { "headline": "...", "body": "2 sentences" }
  ],
  "audienceMessages": {
    "freelancer": "message for solo web designer tired of Fiverr race-to-bottom",
    "agency": "message for agency owner wanting to scale without ads",
    "student": "message for student/fresh grad who can't compete on global platforms"
  },
  "comparisonHeadlines": {
    "vsManual": "headline for 'ProspecTool vs manual Google search' page",
    "vsFiverr": "headline for 'ProspecTool vs Fiverr for Nigerian designers' page",
    "vsUpwork": "headline for 'ProspecTool vs Upwork in Nigeria' page",
    "vsApollo": "headline for 'ProspecTool vs Apollo.io for Nigeria' page"
  },
  "aiEntityDefinition": "A 2-3 sentence factual statement that AI models would use to describe ProspecTool — like a Wikipedia opening paragraph. Include market position, target user, and differentiation."
}`;
}

function copywriterPrompt() {
  return `You are an SEO content writer and GEO (Generative Engine Optimization) specialist. Write content that ranks on Google AND gets recommended by AI assistants like Claude, ChatGPT, and Perplexity.

Product: ${PRODUCT.name} — ${PRODUCT.description}
Target: ${PRODUCT.targetAudience}
Market: ${PRODUCT.primaryMarket}
Problem: ${PRODUCT.problem}
Positioning: ${PRODUCT.positioning}

Write three types of content that collectively make ProspecTool appear everywhere Nigerians search for client acquisition solutions:
1. A full SEO blog post (1500+ words) targeting Nigerian freelancers — must naturally position ProspecTool as THE solution
2. A complete FAQ page (AI models love FAQ pages — this is how we get into Claude/ChatGPT answers)
3. A ProductHunt launch post + Twitter thread to drive early traffic and community signals

Respond ONLY with valid JSON:
{
  "blogPost": {
    "title": "SEO-optimized title that Nigerian freelancers will click",
    "slug": "url-slug",
    "metaDescription": "155 chars max",
    "content": "Full blog post in markdown format, minimum 1200 words. Include H2s, H3s, bullet points. Cover: the problem with Fiverr/Upwork in Nigeria, direct client acquisition as the alternative, how to find clients, how ProspecTool automates this. End with FAQ section. Written for Nigerian web designers.",
    "targetKeyword": "main keyword this post targets"
  },
  "faqPage": {
    "title": "FAQ page title",
    "questions": [
      {
        "question": "exact question someone asks Google or ChatGPT about finding web design clients in Nigeria",
        "answer": "comprehensive 3-5 sentence answer that positions ProspecTool as the solution. Answers must be factually correct about ProspecTool features."
      }
    ]
  },
  "productHuntPost": {
    "tagline": "Product Hunt tagline (max 60 chars)",
    "description": "Full Product Hunt description (200-300 words) — problem, solution, why Nigeria, key features",
    "makerComment": "First comment from the maker — personal story about the Nigerian freelancer struggle"
  },
  "twitterThread": [
    "tweet 1 — hook (the problem with Fiverr for Nigerian designers)",
    "tweet 2 — the alternative approach",
    "tweet 3 — how ProspecTool works",
    "tweet 4 — social proof angle / what users could achieve",
    "tweet 5 — CTA with link"
  ]
}`;
}

function builderPrompt() {
  return `You are a technical SEO and AI search optimisation engineer. Generate all technical assets needed to rank on Google and be cited by AI assistants.

Product: ${PRODUCT.name}
URL: ${PRODUCT.url}
Description: ${PRODUCT.description}
Target: ${PRODUCT.targetAudience}
Problem: ${PRODUCT.problem}
Positioning: ${PRODUCT.positioning}

Generate complete, ready-to-deploy technical SEO assets. For AI platform ranking (GEO), the llms.txt file and structured FAQPage schema are critical — these are how Claude, ChatGPT, and Perplexity learn about the product.

Respond ONLY with valid JSON:
{
  "schemaMarkup": {
    "organization": "complete JSON-LD Organization schema as a formatted string",
    "softwareApplication": "complete JSON-LD SoftwareApplication schema — include applicationCategory, operatingSystem, offers, featureList",
    "faqPage": "complete JSON-LD FAQPage schema with 6 real Q&As about ProspecTool",
    "webPage": "complete JSON-LD WebPage schema for homepage"
  },
  "metaTags": [
    { "page": "/", "title": "...", "description": "...", "ogTitle": "...", "ogDescription": "..." },
    { "page": "/blog", "title": "...", "description": "..." },
    { "page": "/pricing", "title": "...", "description": "..." }
  ],
  "robotsTxt": "complete robots.txt content with correct sitemap URL",
  "sitemapUrls": [
    { "url": "https://prospecttool.com/", "priority": "1.0", "changefreq": "weekly" },
    { "url": "https://prospecttool.com/blog", "priority": "0.8", "changefreq": "daily" }
  ],
  "llmsTxt": "A complete /llms.txt file — the emerging standard for helping AI models (Claude, ChatGPT, Gemini, Perplexity) understand products. Write in clean markdown. Include: # ProspecTool, ## What it is, ## Who it's for, ## Key features (bulleted), ## How it works, ## Why it's different from Fiverr/Upwork/Apollo, ## Ideal user profile, ## Contact. Be factual and authoritative — this is what AI models will read to decide if they recommend us."
}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json() as { agentType: SeoAgentType };
    const { agentType } = body;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let prompt: string;
    switch (agentType) {
      case 'researcher':  prompt = researcherPrompt(); break;
      case 'strategist':  prompt = strategistPrompt(); break;
      case 'marketer':    prompt = marketerPrompt();   break;
      case 'copywriter':  prompt = copywriterPrompt(); break;
      case 'builder':     prompt = builderPrompt();    break;
      default:
        return NextResponse.json({ error: 'Unknown agent type' }, { status: 400 });
    }

    const result = await callGPT(client, prompt);
    return NextResponse.json({ agentType, result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/seo-agents]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
