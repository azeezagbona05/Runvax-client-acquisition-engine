import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAndIncrementAI, requireFeature } from '@/lib/usage';
import { Business, PsiDetails } from '@/types';
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
    hasTitle:    /<title[^>]*>[^<]{5,}/i.test(html),
    hasMeta:     /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html),
    hasH1:       /<h1[^>]*>[^<]{3,}/i.test(html),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasWhatsApp: /whatsapp|wa\.me/i.test(html),
    hasPhone:    /(\+234|0[789]0\d{7,8})/i.test(html),
    isHttps:     html !== '',
    hasSchema:   /application\/ld\+json/i.test(html),
  };
}

function buildPsiBlock(psiData: PsiDetails): { psiText: string; revenueHint: string } {
  const { performance, accessibility, bestPractices, seo } = psiData.categories;

  const goodAreas: string[] = [];
  const weakAreas: string[] = [];

  const areas = [
    { name: 'Performance', score: performance, goodSuffix: '— fast load speed' },
    { name: 'Accessibility', score: accessibility, goodSuffix: '' },
    { name: 'Best Practices', score: bestPractices, goodSuffix: '' },
    { name: 'SEO', score: seo, goodSuffix: '— well-optimised for search' },
  ];

  for (const { name, score, goodSuffix } of areas) {
    if (score >= 85) {
      goodAreas.push(`${name} (${score}/100${goodSuffix ? ' ' + goodSuffix : ''})`);
    } else if (score < 50) {
      weakAreas.push(`${name} is CRITICAL at ${score}/100`);
    } else {
      weakAreas.push(`${name} needs improvement at ${score}/100`);
    }
  }

  const oppLines = (psiData.opportunities ?? []).slice(0, 5)
    .map((o) => `- ${o.title}${o.savings ? ` (could save ${o.savings})` : ''}`).join('\n');

  const failLines = (psiData.failedAudits ?? []).slice(0, 8)
    .map((a) => `- ${a.title}`).join('\n');

  const psiText = `
PAGESPEED INSIGHTS DATA (mobile, objective Google measurements):
${goodAreas.length ? `✅ STRONG areas — DO NOT mention these as weaknesses:\n${goodAreas.map(a => `  - ${a}`).join('\n')}` : ''}
${weakAreas.length ? `❌ WEAK areas — these MUST appear as weaknesses:\n${weakAreas.map(a => `  - ${a}`).join('\n')}` : ''}
${oppLines ? `\nSpeed opportunities Google identified:\n${oppLines}` : ''}
${failLines ? `\nFailed audits:\n${failLines}` : ''}

CRITICAL RULE: Your weaknesses and revenue impact MUST be consistent with the scores above. If a category scores ≥ 85, never cite it as a problem. If a category scores < 50, it must be prominently featured as a major weakness with the exact score stated.`;

  const revenueHint = performance < 70
    ? `Their mobile performance score is ${performance}/100 — reference this exact number when describing visitor loss due to slow loading.`
    : seo < 70
    ? `Their SEO score is ${seo}/100 — reference search visibility loss.`
    : 'Focus on conversion rate and trust issues rather than speed or SEO, which score well.';

  return { psiText, revenueHint };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { business?: Business; psiData?: PsiDetails };
    const { business, psiData } = body;

    if (!business?.website) {
      return NextResponse.json({ error: 'Business has no website' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 });
    }

    const gate = await requireFeature(req, 'weaknessAnalysis');
    if (!gate.ok) return gate.error!;

    const usage = await checkAndIncrementAI(req);
    if (!usage.ok) return usage.error!;

    const [profile, html] = await Promise.all([
      getEffectiveProfile(),
      fetchWebsiteHtml(business.website),
    ]);

    const client  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    const { psiText, revenueHint } = psiData
      ? buildPsiBlock(psiData)
      : { psiText: '', revenueHint: 'Focus on conversion rate, mobile experience, and trust signals.' };

    const prompt = `You are a web performance consultant reviewing a business website for a Nigerian web agency.

Business: ${business.name}
Type: ${business.category}
Location: ${business.address ?? 'Nigeria'}
Current website: ${business.website}
Rating: ${business.rating ? `${business.rating}/5 with ${business.reviewCount} reviews` : 'N/A'}

${metricsText}
${psiText}
Generate a detailed website weakness report. FORMAT EXACTLY as shown — do not add extra headers or change the delimiters:

---WEAKNESSES---
[List 6–8 specific weaknesses as numbered items. Each item: bold weakness title, then 1-2 sentences explaining the problem and its business impact. Base weaknesses ONLY on what the data above confirms is actually broken. Be specific to their industry and the Nigerian market.]

---PITCH-ANGLE---
[2-3 sentences: how ${profile.businessName ?? 'our agency'} (${profile.city ?? 'Lagos'}) should position their web design service to this business. What specific, data-backed outcomes will you promise? Sign off hinting at ${profile.senderName ?? 'us'} as the contact.]

---REVENUE-IMPACT---
[One short paragraph grounded in the actual data. ${revenueHint} Do NOT mention categories that scored ≥ 85 as problems.]`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text          = completion.choices[0]?.message?.content ?? '';
    const weaknessMatch = text.match(/---WEAKNESSES---([\s\S]*?)---PITCH-ANGLE---/);
    const pitchMatch    = text.match(/---PITCH-ANGLE---([\s\S]*?)---REVENUE-IMPACT---/);
    const revenueMatch  = text.match(/---REVENUE-IMPACT---([\s\S]*?)$/);

    return NextResponse.json({
      weaknesses:    weaknessMatch?.[1]?.trim() ?? '',
      pitch:         pitchMatch?.[1]?.trim()    ?? '',
      revenueImpact: revenueMatch?.[1]?.trim()  ?? '',
      metrics,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/weakness]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
