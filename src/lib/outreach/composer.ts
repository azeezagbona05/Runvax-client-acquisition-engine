import type { ProspectContext, RouterSelection, SenderProfile } from './types';
import { localizationInstruction } from './localization';
import {
  OPENER_POOL,
  CTA_POOL,
  CONVERSATION_STYLE,
  OBSERVATION_PATTERN,
  COMPETITOR_ANGLE,
  HARD_BANS,
  senderIdentity,
} from './assets';
import {
  AGENT_OPENER_POOL,
  AGENT_CTA_POOL,
  AGENT_OBSERVATION_PATTERN,
  AGENT_COMPETITOR_ANGLE,
  AGENT_HARD_BANS,
  AGENT_EVIDENCE_RULE,
  AGENT_LENGTH_RULE,
  AGENT_BEAT_BUDGET,
} from './agent-assets';
import { promptBans } from './humanize';
import {
  REPUTATION_OPENER_POOL,
  REPUTATION_OBSERVATION,
  REPUTATION_CTA_POOL,
} from './website-reputation-assets';

/**
 * The offer decides which house-style pack the composer loads. Website copy leads
 * with an absence; AI-system copy leads with the customer's experience. Mixing the
 * two produces a message that pitches a website to someone who already has one.
 */
function assetsFor(ctx: ProspectContext) {
  const offer = ctx.offer;
  if (offer === 'ai_system') {
    return {
      role: (city: string, country: string) =>
        `You are a consultant based in ${city}, ${country} who builds enquiry, booking and follow-up systems for local businesses.
You reach out to businesses whose customers are trying to get hold of them.
Your first message never explains what you build. It puts the owner inside a moment
from their own week, shows what could happen instead, and asks whether they want to see it.
You write like a real person who thought about this business, not like a vendor introducing a product.`,
      opener: AGENT_OPENER_POOL,
      cta: AGENT_CTA_POOL,
      observation: AGENT_OBSERVATION_PATTERN,
      competitor: AGENT_COMPETITOR_ANGLE,
      extraBans: AGENT_HARD_BANS,
      evidenceRule: `${AGENT_BEAT_BUDGET}\n\n---\n\n${AGENT_EVIDENCE_RULE}\n\n---\n\n${AGENT_LENGTH_RULE}`,
      valueLine: 'The one outcome sentence — work removed first, technology second if at all',
    };
  }
  // Scenario A: an opt-in A/B variant of the website opener that leads with the
  // owner's reputation rather than the missing site. Never selected unless the
  // caller explicitly asks for it, so the default pitch is byte-for-byte unchanged.
  if (ctx.websiteOpener === 'reputation_first') {
    return {
      role: (city: string, country: string) =>
        `You are a professional web designer and digital consultant based in ${city}, ${country}.
You reach out to local businesses that have already built a real reputation and have nowhere online to send it.
You never open on what a business lacks. You open on what they have built, then show what it could reach.`,
      opener: REPUTATION_OPENER_POOL,
      cta: REPUTATION_CTA_POOL,
      observation: REPUTATION_OBSERVATION,
      competitor: COMPETITOR_ANGLE,
      extraBans: '',
      evidenceRule: '',
      valueLine: 'One sentence on what that reputation could reach with somewhere to land',
    };
  }

  return {
    role: (city: string, country: string) =>
      `You are a professional web designer and digital consultant based in ${city}, ${country}.
You reach out to local businesses that could benefit from a website.
You write messages that feel like they came from a real person who genuinely noticed their business — not from a system that processed a record.`,
    opener: OPENER_POOL,
    cta: CTA_POOL,
    observation: OBSERVATION_PATTERN,
    competitor: COMPETITOR_ANGLE,
    extraBans: '',
    evidenceRule: '',
    valueLine: 'One sentence on what a website would change for them specifically',
  };
}

function isMultiChannel(intent: ProspectContext['intent']): boolean {
  return intent === 'cold_first_touch' || intent === 'audit_outreach';
}

/**
 * Anti-sameness instruction derived from the cross-user tracker.
 *
 * When several Runvax users have already messaged a business, the failure mode
 * isn't a weak message — it's a message that sounds like the four before it.
 * These prompts push the model off the default "I noticed you have no website"
 * script that every other sender is unknowingly using.
 */
function competitionInstruction(ctx: ProspectContext): string {
  const others = ctx.otherSenders ?? 0;
  if (others <= 0) return '';

  const days = ctx.daysSinceLastSend;
  const recent = days == null || days < 90;

  if (!recent) {
    return `COMPETITIVE CONTEXT — ${others} other ${others === 1 ? 'person has' : 'people have'} pitched this business before, but nothing in the last ${Math.floor((days ?? 90) / 30)} months. Those conversations died.
Write as someone picking up a thread everyone else dropped. Acknowledge — lightly, without naming anyone — that they've probably heard this pitch before and it went nowhere. Your angle: why this time is different and concrete. Do not open with the standard "you don't have a website" observation; they have heard it and ignored it.`;
  }

  if (others >= 10) {
    return `COMPETITIVE CONTEXT — this owner is currently being flooded: ${others} other people have messaged them recently. Assume their inbox is full of near-identical web design pitches.
Your message must be unrecognisable as one of them. Do NOT lead with: no website, being invisible on Google, losing customers online, or a free audit offer — every one of those is already in their inbox.
Lead instead with something only someone who actually looked at THIS business would say: a specific review, a detail in their hours or service list, something about their street or area. Be shorter than everyone else. One question, low commitment.`;
  }

  if (others >= 4) {
    return `COMPETITIVE CONTEXT — ${others} other people have messaged this business recently. The obvious angles are taken.
Avoid the generic opener about not having a website. Find a more specific hook in their actual data (a particular review, their rating, their category, their area) and lead with that. Keep it noticeably shorter and less salesy than a standard pitch.`;
  }

  return `COMPETITIVE CONTEXT — ${others} other ${others === 1 ? 'person has' : 'people have'} messaged this business recently. Make sure your opener is specific to their actual data rather than a generic "no website" observation, so it doesn't blend into what they've already received.`;
}

function outputContract(ctx: ProspectContext, valueLine: string): string {
  const shortName = ctx.businessName.includes('(')
    ? ctx.businessName.split('(')[0].trim()
    : ctx.businessName;

  if (isMultiChannel(ctx.intent)) {
    // The AI-system first touch exists to earn a reply, not to explain the build,
    // so it runs far shorter than the website pitch.
    const isAgent = ctx.offer === 'ai_system';
    // The acknowledgement beat needs room, so the agent cap sits a little above the
    // 60 words the pure pattern interrupt used. Still far under the website pitch.
    const waLimit = isAgent ? 80 : 120;
    const emailLimit = isAgent ? 130 : 180;

    const waStructure = isAgent
      ? `  EXACTLY THREE BEATS. See the beat budget — it governs this.
  Beat 1: greeting plus the recognition clause. If the data supports no recognition,
          skip it and open on the moment instead, still three beats total.
  Beat 2: the moment AND the possibility, in one short paragraph. The moment is a
          clause; the possibility is the sentence after it, stated in plain words.
          The possibility is MANDATORY — the CTA refers back to it. Serve primaryAngle.
  Beat 3: one CTA from the pool, on its own line.
Never name the technology on WhatsApp. No market sentence, no competitor sentence,
no feature list, no explanation of how it works.`
      : `  Line 1: opener from the pool
  Short acknowledgement of their reviews/reputation (1-2 sentences)
  The concrete observation — search scenario → gap → consequence (2-3 sentences)
  If competitor data is available: one neutral sentence naming them
  Final line: one CTA from the pool, on its own line`;

    return `OUTPUT — produce all three sections in this exact order. Do not stop after the first.

---WHATSAPP---
[Conversational WhatsApp message. Strictly ≤${waLimit} words. No markdown formatting required.
Structure (natural, not labelled):
${waStructure}
Do not add a signature. Count words before outputting.]

---EMAIL-SUBJECT---
[Max 8 words. Specific to this business or city. Curious, not salesy.
No "Quick question", "Check this out", or "I noticed..."]

---EMAIL-BODY---
[Conversational email. ≤${emailLimit} words. Short paragraphs.
${isAgent
  ? `AT MOST FOUR BEATS. See the beat budget — it governs this.
  Beat 1: greeting, then the recognition — a sentence rather than a clause
  Beat 2: the possibility. ${valueLine}
          If hasWebsite is true, this is where the next-layer line belongs: their site
          holds the information, this is the part that helps people act on it
  Beat 3: ONE of — what it changes for them going forward, OR the soft market sentence.
          Never both. Outcome is the stronger of the two; use market only when the
          outcome would repeat something already said
  Beat 4: CTA (different from the WhatsApp CTA)
  Then the email signature exactly as specified in SENDER block below.
Email may name the technology ONCE, and only after the possibility has been described
in plain terms. Never in the opening. Do NOT praise their rating or review count.`
  : `Same structure as WhatsApp but with slightly more room:
  Opener (different wording from WhatsApp opener)
  Acknowledge their reviews/reputation
  The concrete observation with one more sentence of detail
  Competitor sentence if available
  ${valueLine}
  CTA (different from WhatsApp CTA)
  Email signature exactly as specified in SENDER block below.`}]

YOU MUST produce all three sections. Do not stop after the WhatsApp section.`;
  }

  return `OUTPUT — write a single ${ctx.channel} message. No delimiters.
≤${ctx.channel === 'whatsapp' ? '120' : ctx.channel === 'dm' ? '80' : '180'} words.
Conversational, natural, human. Output only the message — no preamble.`;
}

export function composePrompt(
  ctx: ProspectContext,
  selection: RouterSelection,
  profile: SenderProfile,
): { system: string; user: string } {
  const { priceBand } = localizationInstruction(ctx);

  const shortName = ctx.businessName.includes('(')
    ? ctx.businessName.split('(')[0].trim()
    : ctx.businessName;

  const pack = assetsFor(ctx);

  // ── System prompt: role + style + rules ───────────────────────────────────
  const system = [
    // Role
    pack.role(ctx.city, ctx.country),

    // Conversation style (the most important layer)
    CONVERSATION_STYLE,

    // How to construct the observation
    pack.observation,

    // Competitor angle
    pack.competitor,

    // Opener and CTA pools
    pack.opener,
    pack.cta,

    // Hard bans
    HARD_BANS,
    pack.extraBans,

    // Constructions that mark copy as machine-written
    promptBans(),

    // Nothing may be stated as fact unless it came from the business record
    pack.evidenceRule,

    // Cross-user saturation — omitted entirely when this lead is untouched
    competitionInstruction(ctx),

    // Quality check
    `SELF-CHECK before outputting:
— Does this sound like a real person or a script?
— Is there one specific thing that proves you looked at THIS business?
— Is the observation concrete (search scenario) or generic ("you're losing customers")?
— Is there exactly one CTA question at the end?
— Is the word count within limit?
If any check fails, rewrite first.`,
  ].filter(Boolean).join('\n\n---\n\n');

  // ── User prompt: prospect data + output contract ───────────────────────────
  const prospectData = JSON.stringify({
    shortName,
    fullName: ctx.businessName,
    industry: ctx.industry,
    city: ctx.city,
    country: ctx.country,
    hasWebsite: ctx.hasWebsite,
    rating: ctx.rating ?? null,
    reviewCount: ctx.reviewCount ?? null,
    competitorWithSite: ctx.competitorWithSite ?? null,
    channel: ctx.channel,
    intent: ctx.intent,
    priceBand,
    timeOfDay: ctx.timeOfDay ?? null,
    offer: ctx.offer ?? 'website',
    solutionTitle: ctx.solutionTitle ?? null,
    // The complete set of things you may state as fact about this business.
    observedFacts: ctx.evidence?.length ? ctx.evidence : null,
    // How this trade normally works. Not a claim about this business.
    businessCharacteristic: ctx.industryAngle?.characteristic ?? null,
    scenario: ctx.industryAngle?.scenario ?? null,
    primaryAngle: ctx.industryAngle?.primaryAngle ?? null,
    manualProcess: ctx.industryAngle?.manualProcess ?? null,
    outcome: ctx.industryAngle?.outcome ?? null,
  }, null, 2);

  const rateCardBlock = ctx.intent === 'proposal' && profile.rateCardSummary
    ? `\n\nUSE THIS RATE CARD when writing the proposal — match the right package to the business type and size:\n${profile.rateCardSummary}`
    : '';

  // A regulated trade's guardrail outranks every style instruction above it.
  const angleBlock = ctx.industryAngle?.guardrail
    ? `\n\nINDUSTRY GUARDRAIL — overrides all other instructions:\n${ctx.industryAngle.guardrail}`
    : '';

  const user = `${prospectData}${angleBlock}${rateCardBlock}\n\n${outputContract(ctx, pack.valueLine)}\n\n${senderIdentity(profile)}`;

  return { system, user };
}
