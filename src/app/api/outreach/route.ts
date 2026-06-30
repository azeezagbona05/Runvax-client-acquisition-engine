import { NextRequest, NextResponse } from 'next/server';
import { Business } from '@/types';
import { checkAndIncrementAI } from '@/lib/usage';
import { getEffectiveProfile } from '@/lib/userProfile';
import { generate } from '@/lib/outreach/generate';
import { scoreProspect } from '@/lib/scoring';
import type { ProspectContext, ProspectTemperature } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

export type OutreachFramework = 'PAS' | 'AIDA' | 'BAB' | 'STORY' | 'SPIN' | '4PS' | 'HSO' | 'FAB';

// Detect country from address string — defaults to NG.
function detectCountry(address: string): string {
  const a = address.toLowerCase();
  if (a.includes('united kingdom') || a.includes(' uk') || a.includes('london') || a.includes('manchester') || a.includes('birmingham')) return 'UK';
  if (a.includes('united states') || a.includes(' usa') || a.includes('new york') || a.includes('los angeles') || a.includes('chicago')) return 'US';
  if (a.includes('canada') || a.includes('toronto') || a.includes('vancouver') || a.includes('montreal')) return 'CA';
  if (a.includes('south africa') || a.includes('johannesburg') || a.includes('cape town') || a.includes('durban')) return 'ZA';
  if (a.includes('kenya') || a.includes('nairobi') || a.includes('mombasa')) return 'KE';
  if (a.includes('ghana') || a.includes('accra') || a.includes('kumasi')) return 'GH';
  if (a.includes('uganda') || a.includes('kampala')) return 'UG';
  if (a.includes('tanzania') || a.includes('dar es salaam')) return 'TZ';
  return 'NG';
}

// Extract city from address — takes the first meaningful segment.
function extractCity(address: string): string {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  // Try to find the city part (skip unit/street numbers, return first part that looks like a place name)
  return parts[1] ?? parts[0] ?? address;
}

function deriveTemperature(score: number): ProspectTemperature {
  if (score >= 8) return 'hot';
  if (score >= 5) return 'warm';
  return 'cold';
}

function businessToContext(
  business: Business,
  framework: OutreachFramework | undefined,
  competitors: string[] | undefined,
): ProspectContext {
  const leadScore = scoreProspect(business);
  const country = detectCountry(business.address ?? '');
  const city = extractCity(business.address ?? '');

  return {
    businessName: business.name,
    industry: business.category,
    city,
    country,
    hasWebsite: business.hasWebsite,
    socialOnly: !business.hasWebsite,
    leadScore,
    temperature: deriveTemperature(leadScore),
    stage: 'found',
    channel: 'whatsapp',   // generate() produces both channels for cold_first_touch
    intent: 'cold_first_touch',
    rating: business.rating,
    reviewCount: business.reviewCount,
    competitorWithSite: competitors?.[0],
    // Pass the UI picker value so the router uses the user's chosen framework.
    forceFrameworkId: framework,
  };
}

export async function POST(req: NextRequest) {
  const {
    business,
    framework,
    competitors,
  }: { business: Business; framework?: OutreachFramework; competitors?: string[] } = await req.json();

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const profile = await getEffectiveProfile();
  const ctx = businessToContext(business, framework, competitors);

  try {
    const result = await generate(ctx, profile);

    return NextResponse.json({
      whatsapp: result.output.whatsapp ?? '',
      emailSubject: result.output.emailSubject ?? '',
      emailBody: result.output.emailBody ?? '',
      framework: framework ?? 'PAS',
      meta: result.meta,   // additive — existing frontend ignores this field
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
