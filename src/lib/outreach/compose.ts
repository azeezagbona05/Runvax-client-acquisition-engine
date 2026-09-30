import { Business } from '@/types';
import { getEffectiveProfile } from '@/lib/userProfile';
import { generate } from '@/lib/outreach/generate';
import { scoreProspect } from '@/lib/scoring';
import { getSaturationFor } from '@/lib/outreachSignal';
import { daysSince } from '@/lib/saturation';
import type { ProspectContext, ProspectTemperature } from '@/lib/outreach/types';
import { detectOpportunities } from '@/lib/opportunity/detect';
import { angleFor } from '@/lib/opportunity/industryAngles';
import type { OfferType, Opportunity } from '@/lib/opportunity/types';
import { prisma } from '@/lib/prisma';
import { logAgentActivity } from '@/lib/agentActivity';
import { recall } from '@/lib/prospectMemory';

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

function industryAngleFor(business: Business): ProspectContext['industryAngle'] {
  const a = angleFor(business.category, business.categoryTypes);
  return {
    label: a.label,
    primaryAngle: 'missed_enquiry',
    characteristic: a.characteristic,
    scenario: a.scenario,
    manualProcess: a.manualProcess,
    outcome: a.outcome,
    guardrail: a.guardrail,
  };
}

function businessToContext(
  business: Business,
  framework: OutreachFramework | undefined,
  competitors: string[] | undefined,
  timeOfDay?: 'morning' | 'afternoon' | 'evening',
  saturation?: { otherSenders: number; daysSinceLastSend: number | null },
  chosenOffer: OfferType = 'website',
  opportunity?: Opportunity | null,
  websiteOpener?: 'reputation_first',
  priorContext?: string[],
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
    timeOfDay,
    otherSenders: saturation?.otherSenders ?? 0,
    daysSinceLastSend: saturation?.daysSinceLastSend ?? null,
    offer: chosenOffer,
    // Only meaningful on the website path, and only when the caller opted in.
    websiteOpener: chosenOffer === 'website' ? websiteOpener : undefined,
    solutionTitle: opportunity?.title,
    outreachAngle: opportunity?.outreachAngle,
    evidence: opportunity?.evidence,
    // Detection may not have produced an opportunity — the user chose this offer
    // anyway. The trade's workflow is knowable regardless, so the AI-system pack
    // still gets what it needs to write a real message.
    industryAngle: opportunity?.angle
      ?? (chosenOffer === 'ai_system' ? industryAngleFor(business) : undefined),
    priorContext,
  };
}

export interface ComposeOutreachParams {
  business: Business;
  /** Signed-in user, when there is one — drives saturation lookup and the Ava research log. */
  userId?: string;
  framework?: OutreachFramework;
  competitors?: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  /** Omitted means "use whatever this business best qualifies for". */
  offer?: OfferType;
  /** Opt-in A/B variant of the website opener. Omitted keeps the original pitch. */
  websiteOpener?: 'reputation_first';
}

export interface OpportunitySummary {
  type: OfferType;
  title: string;
  score: number;
  band: string;
  confidence: string;
  reason: string;
  evidence: string[];
  components: string[];
  signalCodes: string[];
}

export interface ComposeOutreachResult {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
  framework: OutreachFramework;
  meta: unknown;
  opportunity: OpportunitySummary | null;
  availableOffers: Array<{ type: OfferType; title: string; score: number }>;
  /** What was recalled about this specific prospect and used while writing this
   *  message — surfaced in the review UI so the sender can see what it's
   *  drawing on before they send it. Undefined when there was nothing to recall. */
  priorContext?: string[];
}

/**
 * Builds the full outreach message pair for one business — opportunity
 * detection, saturation lookup, prompt composition, generation. Shared by the
 * interactive `/api/outreach` route and Rex's autonomous draft-preparation
 * cron, so a background draft is composed exactly the same way a human-
 * triggered one is.
 */
export async function composeOutreach(params: ComposeOutreachParams): Promise<ComposeOutreachResult> {
  const { business, userId, framework, competitors, timeOfDay, offer, websiteOpener } = params;

  const profile = await getEffectiveProfile();

  // Look up how crowded this lead already is, so the composer can steer away
  // from the angles other senders have already used. Best-effort: a tracker
  // failure must never block message generation.
  let saturation: { otherSenders: number; daysSinceLastSend: number | null } | undefined;
  try {
    if (userId && business?.id) {
      const s = await getSaturationFor(business.id, userId);
      saturation = { otherSenders: s.otherCount, daysSinceLastSend: daysSince(s.lastSentAt) };
    }
  } catch (err) {
    console.error('[composeOutreach] saturation lookup failed', err);
  }

  // Recall what the agents (or the user) already know about this specific
  // prospect — a past reply, an objection, a manual note — so a second
  // message doesn't read like a first one. Best-effort, same as saturation:
  // a memory failure must never block message generation.
  let priorContext: string[] | undefined;
  try {
    if (userId && business?.id) {
      const prospect = await prisma.prospect.findUnique({
        where: { userId_businessId: { userId, businessId: business.id } },
        select: { id: true },
      });
      if (prospect) {
        const memories = await recall(userId, prospect.id, 5);
        if (memories.length > 0) priorContext = memories.map((m) => m.content);
      }
    }
  } catch (err) {
    console.error('[composeOutreach] memory recall failed', err);
  }

  // Detection is deterministic and free, so it runs on every request. It informs
  // the default, but an explicit `offer` from the caller always wins: a website
  // may be offered to a business that did not clear the AI-system bar, and
  // silently switching offers on them would be the wrong answer.
  const detected = detectOpportunities(business, offer ?? 'both');
  const chosenOffer: OfferType = offer ?? detected.primary?.type ?? 'website';
  const opportunity = detected.all.find((o) => o.type === chosenOffer) ?? null;

  if (userId && opportunity) {
    const title = `Flagged ${business.name} — ${opportunity.reason}`;
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentDupe = await prisma.agentActivity.findFirst({
      where: { userId, agentKey: 'research', title, createdAt: { gte: tenMinAgo } },
      select: { id: true },
    });
    if (!recentDupe) {
      await logAgentActivity({ userId, agentKey: 'research', action: 'opportunity_flagged', title });
    }
  }

  const ctx = businessToContext(business, framework, competitors, timeOfDay, saturation, chosenOffer, opportunity, websiteOpener, priorContext);
  const result = await generate(ctx, profile);

  return {
    whatsapp: result.output.whatsapp ?? '',
    emailSubject: result.output.emailSubject ?? '',
    emailBody: result.output.emailBody ?? '',
    framework: framework ?? 'PAS',
    meta: result.meta,
    opportunity: opportunity
      ? {
          type: opportunity.type,
          title: opportunity.title,
          score: opportunity.score,
          band: opportunity.band,
          confidence: opportunity.confidence,
          reason: opportunity.reason,
          evidence: opportunity.evidence,
          components: opportunity.pattern.components,
          signalCodes: opportunity.signalCodes,
        }
      : null,
    availableOffers: detected.all.map((o) => ({ type: o.type, title: o.title, score: o.score })),
    priorContext,
  };
}
