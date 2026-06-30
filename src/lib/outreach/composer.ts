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
  Sign as ${profile.senderName} from ${profile.businessName}.]

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

    // Quality check
    `SELF-CHECK before outputting:
— Does this sound like a real person or a script?
— Is there one specific thing that proves you looked at THIS business?
— Is the observation concrete (search scenario) or generic ("you're losing customers")?
— Is there exactly one CTA question at the end?
— Is the word count within limit?
If any check fails, rewrite first.`,
  ].join('\n\n---\n\n');

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
  }, null, 2);

  const user = `${prospectData}\n\n${outputContract(ctx, profile)}\n\n${senderIdentity(profile)}`;

  return { system, user };
}
