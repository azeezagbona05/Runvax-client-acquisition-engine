/**
 * ProspectAI house-style assets — ported verbatim from outreach/route.ts,
 * then extended with the checklist fix revealed by the Step-10 spike.
 *
 * All positioning, formatting rules, and AI-naming conventions live here.
 * composer.ts pulls these in at fixed positions so they can't be forgotten.
 */

import type { SenderProfile } from './types';

// ─── Core positioning ─────────────────────────────────────────────────────────

export const POSITIONING = `CORE POSITIONING — THIS IS THE HEART OF EVERY MESSAGE:
We do NOT sell "a website". We build a DIGITAL FRONT DOOR — a digital experience centre.
Frame it as the complete experience a customer has:
- BEFORE coming in-store / in-location: they search Google or ask an AI assistant, they find the business, see the reviews, the photos, the story, the offer — and decide to trust it before they ever walk in.
- DURING: the site answers their questions, shows directions, takes bookings/enquiries 24/7.
- AFTER leaving: it keeps them connected — repeat visits, referrals, reviews, loyalty.
This is a digital experience centre that shapes how people feel about the business at every touchpoint, not a brochure.

When you use the phrase "digital front door", always write it exactly as "digital front door (website)" so the prospect understands it means a real website.`;

// ─── AI/SEO/GEO concepts ──────────────────────────────────────────────────────

export const DIGITAL_CONCEPTS = `KEY 2026 DIGITAL PRESENCE CONCEPTS — weave in 1–2 naturally, never lecture:
- SEO: Google ranks websites, not social media pages — without a website they rank for nothing.
- AIEO (AI Engine Optimization): When people ask AI assistants "best [niche] in [city]", they pull from websites. No website = not recommended by AI.
- GEO (Generative Engine Optimization): Structuring content so generative AI engines can discover and recommend the business.
- A digital front door works 24/7 — answering questions, building trust, taking enquiries while they sleep.

CRITICAL: Whenever you mention AI tools or AI search, ALWAYS name concrete examples: "(like ChatGPT, Claude, Google AI)" — never say "AI tools" alone.`;

// ─── Review / social-proof angle ──────────────────────────────────────────────

export const REVIEW_ANGLE = `REVIEWS / SOCIAL PROOF ANGLE (use when the business HAS Google reviews):
- Name the review count specifically: "You've earned [N] Google reviews — that's real trust most businesses dream of."
- Then the gap: that hard-earned trust has nowhere to land. When someone reads those reviews and searches for them, there's no website, no front door — so the trust leaks away to a competitor who has one.
- Make it sting gently: their reputation is already built; they're just not capturing the customers it's attracting.`;

// ─── WhatsApp formatting ──────────────────────────────────────────────────────

export function whatsappFormatting(): string {
  return `WHATSAPP FORMATTING — CRITICAL, ALWAYS APPLY:
• Write in short paragraphs — 1 to 2 sentences per paragraph, blank line between each.
• *asterisks* = bold — use for: business name, key numbers (review count), core offer phrase.
• _underscores_ = italic — use for: emotional phrases, the CTA question, soft empathetic lines.
• Never write a wall of text — if a paragraph is more than 2 sentences, split it.
• Maximum 2 emojis per message, placed naturally mid-sentence or at the end — NOT at the start of every line.
• Maximum 120 words total — count before outputting, shorten if needed.`;
}

// ─── Checklist instruction (spike fix) ───────────────────────────────────────

export function checklistInstruction(industry: string): string {
  return `OBJECTION-BUSTING CHECKLIST — MANDATORY FOR WHATSAPP AND EMAIL:
Every message MUST include a short checklist of 3 (WhatsApp) or 4–6 (email) features.
These features are NOT generic — they are chosen specifically to dismantle the top objections
a ${industry} owner is likely to have: "I already have Instagram/Facebook", "I get clients by referral",
"I'm too busy to manage a website", "it's too expensive", "I don't really need one."
Each checklist line starts with "✅ " and is no more than 4–6 words.
For WhatsApp: place the checklist between the agitation and the CTA question.
For email: place under a line like "Here's what your digital front door (website) would include:".
Make every feature concrete and category-specific to ${industry}.`;
}

// ─── Sender identity ──────────────────────────────────────────────────────────

export function senderIdentity(profile: SenderProfile): string {
  return `SENDER IDENTITY — USE IN SIGNATURES:
Name / Agency: ${profile.businessName} (${profile.senderName})
WhatsApp: ${profile.whatsapp}
City: ${profile.city}
Tagline: ${profile.tagline}
Services: ${profile.services}

Sign email naturally as ${profile.senderName} from ${profile.businessName}.
For WhatsApp, do NOT add a formal signature — end naturally.`;
}

// ─── Hard bans (never allowed in any message) ─────────────────────────────────

export const HARD_BANS = `HARD BANS — NEVER USE THESE:
• "I hope this message finds you well"
• "My name is X and I..."
• "Are you interested in..."
• "I wanted to reach out"
• "Just following up"
• "Touching base"
• "Synergy" / "Leverage" / "Game-changer"
• Unfilled placeholders like [INSERT NAME] — use the real data provided.
• Competitor tool names (Apollo, ZoomInfo, HubSpot, etc).
• Short business name rule: strip everything after "(" in the Google name — use only the short form.
• Infer the niche if category is generic ("Business"/"Establishment") — never write "business business".`;
