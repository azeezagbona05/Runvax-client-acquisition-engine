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

function outputContract(ctx: ProspectContext, profile: SenderProfile): string {
  const shortName = ctx.businessName.includes('(')
    ? ctx.businessName.split('(')[0].trim()
    : ctx.businessName;

  if (isMultiChannel(ctx.intent)) {
    return `OUTPUT — produce all three sections in this exact order. Do not stop after the first.

---WHATSAPP---
[Conversational WhatsApp message. Strictly ≤120 words. No markdown formatting required.
Structure (natural, not labelled):
  Line 1: opener from the pool
  Short acknowledgement of their reviews/reputation (1-2 sentences)
  The concrete observation — search scenario → gap → consequence (2-3 sentences)
  If competitor data is available: one neutral sentence naming them
  Final line: one CTA from the pool, on its own line
Do not add a signature. Count words before outputting.]

---EMAIL-SUBJECT---
[Max 8 words. Specific to this business or city. Curious, not salesy.
No "Quick question", "Check this out", or "I noticed..."]

---EMAIL-BODY---
[Conversational email. ≤180 words. Short paragraphs.
Same structure as WhatsApp but with slightly more room:
  Opener (different wording from WhatsApp opener)
  Acknowledge their reviews/reputation
  The concrete observation with one more sentence of detail
  Competitor sentence if available
  One sentence on what a website would change for them specifically
  CTA (different from WhatsApp CTA)
  Email signature exactly as specified in SENDER block below.]

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

  // ── System prompt: role + style + rules ───────────────────────────────────
  const system = [
    // Role
    `You are a professional web designer and digital consultant based in ${ctx.city}, ${ctx.country}.
You reach out to local businesses that could benefit from a website.
You write messages that feel like they came from a real person who genuinely noticed their business — not from a system that processed a record.`,

    // Conversation style (the most important layer)
    CONVERSATION_STYLE,

    // How to construct the observation
    OBSERVATION_PATTERN,

    // Competitor angle
    COMPETITOR_ANGLE,

    // Opener and CTA pools
    OPENER_POOL,
    CTA_POOL,

    // Hard bans
    HARD_BANS,

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
  }, null, 2);

  const rateCardBlock = ctx.intent === 'proposal' && profile.rateCardSummary
    ? `\n\nUSE THIS RATE CARD when writing the proposal — match the right package to the business type and size:\n${profile.rateCardSummary}`
    : '';

  const user = `${prospectData}${rateCardBlock}\n\n${outputContract(ctx, profile)}\n\n${senderIdentity(profile)}`;

  return { system, user };
}
