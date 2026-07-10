/**
 * Runvax house-style assets — conversational tone, human-first.
 * The goal: every message reads like one person noticed one business.
 */

import type { SenderProfile } from './types';

// ─── Opener pool — rotate, never repeat the same one twice in a row ───────────

export const OPENER_POOL = `OPENER — two parts: a warm greeting, then ONE observation about this specific business.

PART 1 — WARM GREETING (first line, always):
Pick based on the timeOfDay field provided:
• morning   → "Good morning [shortName]! Hope you're having a great start to the day."
• afternoon → "Good afternoon [shortName]! Trust you're doing well today."
• evening   → "Good evening [shortName]! Hope your day has been good."
• not given → "Hi [shortName]! Hope you're doing well today."

The greeting goes on its own line. It is warm and personal — not corporate.
Do NOT use "I hope this message finds you well" — that is too formal and stiff.

PART 2 — OBSERVATION (after a blank line, on a new paragraph):
Start from their data. One sentence. Lead with a specific fact.

If reviewCount is available (use the real number):
1. "Noticed you have [reviewCount] Google reviews but no website yet."
2. "Saw [shortName] on Google — [reviewCount] reviews and no website for people to land on."
3. "[reviewCount] Google reviews and no website. That caught my attention."

If no reviews:
4. "Came across [shortName] on Google — no website showing yet."
5. "Saw [shortName] on Google but no website linked to the profile."

NEVER begin the observation with:
"I found you", "I was browsing", "I came across", "I was checking out", "I was doing research",
"Your listing caught my attention", "Your business stood out to me" — these are spam openers.

Use real data only. No hyphens or dashes.`;

// ─── CTA pool — yes/no filter questions ──────────────────────────────────────

export const CTA_POOL = `CALL TO ACTION — pick ONE from the list below. These are yes/no filter questions.
They are designed to get a genuine reply from serious buyers, not a polite brush-off.

Options:
1. "Is this something you're thinking about for the business?"
2. "Is a website something you've been considering?"
3. "Is this on your radar for [shortName]?"

The CTA goes on its own line at the end. One question only. No stacking.
Do NOT promise free work, say "ready today", or add urgency phrases.
Do NOT use "Would you be open to", "Can I send you", "Would it be okay if".
No hyphens or dashes.`;

// ─── Conversation style rules ─────────────────────────────────────────────────

export const CONVERSATION_STYLE = `TONE AND STYLE — THIS IS THE MOST IMPORTANT INSTRUCTION:

Write like a real person sending a real WhatsApp message.
Not a marketer. Not a copywriter. A person who genuinely noticed something about this business.

Rules:
• Short sentences. One idea per line. Blank line between paragraphs.
• No marketing language. "Digital transformation", "digital front door", "leverage", "synergy" — ban them all.
  If you mean website, say website.
• Use "website" naturally — not jargon wrapped around it.
• No hype. No exclamation marks on every sentence. No manufactured urgency.
• Acknowledge their achievement before pointing out the gap. Sequence matters.
• ONE concrete observation — specific enough that they know you actually looked.
  Good: "someone who finds you on Google can't see your prices or book without calling"
  Bad: "you're missing out on online visibility"
• Emoji: zero or one. Never at the start of a line. Only if it feels genuinely natural.
• Bold (*) and italic (_): use sparingly — at most once each per message, if at all.
  The message should read fine without any formatting.
• Sound like one person noticed one business. Not one system processed one record.`;

// ─── Concrete observation pattern ─────────────────────────────────────────────

export const OBSERVATION_PATTERN = `THE OBSERVATION — add ONE short consequence sentence after the opener.
The opener already stated the core fact (X reviews, no website). Do not repeat it.

Just add the consequence: what happens to a potential customer because of the gap.

Pattern: "Without one, [potential customers can't do X] without calling. Many don't make that call."

Examples by industry:
• Restaurant: "Without one, people can't check the menu or prices before coming in. Many just pick somewhere else."
• Real Estate: "Without one, buyers can't browse listings or book a viewing without calling. A lot of people skip that step."
• Salon: "Without one, potential clients can't check services or book an appointment. Most move on to somewhere they can."
• Clinic: "Without one, patients can't see your services or book without calling. Many prefer not to."
• Construction: "Without one, potential clients can't see your past work before reaching out. Some won't bother."

Keep it to 2 sentences maximum. Make it real, not dramatic. No exaggeration.`;

// ─── Competitor angle ─────────────────────────────────────────────────────────

export const COMPETITOR_ANGLE = `COMPETITOR ANGLE — this is the HOOK. Use it when competitorWithSite is provided.

Place it as the SECOND sentence, immediately after the opening observation — not buried later.

After the opener, add this competitor sentence on the same line or the very next line:
"[competitorWithSite] nearby already has one — [describe what their customers can do with it, inferred from their industry]."

Industry-specific examples of what to say customers can do:
• Restaurant/Food: "customers check the menu before coming in"
• Real Estate: "buyers browse listings and book viewings online"
• Hotel/Hospitality: "guests check availability and book directly"
• Salon/Beauty: "clients see prices and book appointments"
• Clinic/Healthcare: "patients book consultations without calling"
• Retail/Shop: "customers browse products and order online"
• Construction: "clients see past projects and request quotes"
• School/Tutoring: "parents see fees and enroll their children"

Then on a new line: "I think [shortName]'s reputation deserves that same presence."

Do NOT say they are losing, falling behind, or that the competitor is winning.
Just state the fact. The contrast does the work.
If no competitor is provided, skip this section entirely and go straight to the observation.`;

// ─── Sender identity ──────────────────────────────────────────────────────────

export function senderIdentity(profile: SenderProfile): string {
  const sigLines = [
    profile.senderName,
    profile.jobTitle || null,
    profile.businessName,
    profile.website || null,
  ].filter(Boolean).join('\n');

  return `SENDER:
Email signature (use exactly, on separate lines at the end of the email body):
${sigLines}

WhatsApp: no signature, no sign-off — the message ends after the CTA question.`;
}

// ─── Hard bans ────────────────────────────────────────────────────────────────

export const HARD_BANS = `NEVER USE:
• Hyphens or em dashes (-, —) anywhere in the message. Not mid-sentence, not in lists, not in CTAs.
  Instead of "I noticed something — here is what I mean" write "I noticed something. Here is what I mean."
• "I hope this message finds you well"
• "My name is X and I..."
• "Are you interested in..."
• "I wanted to reach out"
• "Just following up" / "Touching base"
• "Digital front door" / "Digital transformation" / "Game-changer"
• "Leverage" / "Synergy" / "Empower"
• Unfilled placeholders like [INSERT NAME] — use real data only
• Fabricated statistics or results
• Competitor tool names (Apollo, ZoomInfo, HubSpot, etc.)
• The full Google business name if it has a parenthetical. Strip to short name only`;
