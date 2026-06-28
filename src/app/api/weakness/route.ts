import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI } from '@/lib/usage';
import { Business } from '@/types';
import { getEffectiveProfile } from '@/lib/userProfile';

export const dynamic = 'force-dynamic';

async function fetchWebsiteHtml(url: string): Promise<string> {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProspectScanner/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    return html.slice(0, 5000);
  } catch {
    return '';
  }
}

function extractMetrics(html: string) {
  return {
    hasTitle: /<title[^>]*>[^<]{5,}/i.test(html),
    hasMeta: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html),
    hasH1: /<h1[^>]*>[^<]{3,}/i.test(html),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasWhatsApp: /whatsapp|wa\.me/i.test(html),
    hasPhone: /(\+234|0[789]0\d{7,8})/i.test(html),
    isHttps: html !== '',
    hasSchema: /application\/ld\+json/i.test(html),
  };
}

export async function POST(req: NextRequest) {
  const { business }: { business: Business } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 });
  }

  const usage = await checkAndIncrementAI();
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (!business.website) {
    return NextResponse.json({ error: 'Business has no website' }, { status: 400 });
  }

  const html = await fetchWebsiteHtml(business.website);
  const metrics = html ? extractMetrics(html) : null;

  const metricsText = metrics
    ? `Website technical scan results:
- Has page title: ${metrics.hasTitle ? 'Yes' : 'NO ❌'}
- Has meta description for SEO: ${metrics.hasMeta ? 'Yes' : 'NO ❌'}
- Has H1 heading: ${metrics.hasH1 ? 'Yes' : 'NO ❌'}
- Mobile viewport set: ${metrics.hasViewport ? 'Yes' : 'NO ❌'}
- Has WhatsApp button: ${metrics.hasWhatsApp ? 'Yes' : 'NO ❌'}
- Shows phone number: ${metrics.hasPhone ? 'Yes' : 'NO ❌'}
- Has structured data / schema: ${metrics.hasSchema ? 'Yes' : 'NO ❌'}`
    : 'Website could not be fetched (may be slow or geo-blocked). Analyse based on typical issues for this business type.';

  const prompt = `You are a web performance consultant reviewing a Nigerian business website.

Business: ${business.name}
Type: ${business.category}
Location: ${business.address}
Current website: ${business.website}
Rating: ${business.rating ? `${business.rating}/5 with ${business.reviewCount} reviews` : 'N/A'}

${metricsText}

Generate a detailed website weakness report. FORMAT EXACTLY:

---WEAKNESSES---
[List 6–8 specific weaknesses as numbered items. Each item: bold weakness title, then 1-2 sentences explaining the problem and its business impact. Be specific to their industry and Nigerian market. Examples: no WhatsApp button (Nigerians prefer WhatsApp), no Google Business link, slow loading, no SSL, no testimonials, no pricing page, no local SEO keywords, outdated design, no mobile optimization, no contact form, etc.]

---PITCH-ANGLE---
[2-3 sentences: how ${profile.businessName} (${profile.city}) should position their ${profile.services} service to this business. What specific outcomes will you promise? What pain point does their weak website cause them right now? Sign off hinting at ${profile.senderName} as the contact.]

---REVENUE-IMPACT---
[A brief, concrete statement about what having a better website could mean for their business revenue — e.g., "Businesses like yours in [area] get [X] Google searches per month. Your current site may be losing 70-80% of those visitors due to poor mobile experience and slow loading."]`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const weaknessMatch = text.match(/---WEAKNESSES---([\s\S]*?)---PITCH-ANGLE---/);
    const pitchMatch = text.match(/---PITCH-ANGLE---([\s\S]*?)---REVENUE-IMPACT---/);
    const revenueMatch = text.match(/---REVENUE-IMPACT---([\s\S]*?)$/);

    return NextResponse.json({
      weaknesses: weaknessMatch?.[1]?.trim() ?? '',
      pitch: pitchMatch?.[1]?.trim() ?? '',
      revenueImpact: revenueMatch?.[1]?.trim() ?? '',
      metrics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
