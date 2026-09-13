/**
 * Scenario A — the reputation-first website opener.
 *
 * An A/B variant, not a replacement. The default website pack in assets.ts is
 * untouched and still runs for every request that does not explicitly ask for this.
 *
 * The difference is the emotional frame, not the offer:
 *
 *   assets.ts (default)  "Noticed you have 140 Google reviews but no website yet."
 *                        Opens on an absence. The owner hears a deficiency.
 *
 *   this file (variant)  "140 reviews at 4.6 is a reputation most businesses would
 *                        want. Right now it only reaches the people who already
 *                        found you."
 *                        Opens on an asset. The owner hears an opportunity.
 *
 * Only sensible for businesses that actually have a reputation to recognise. With no
 * reviews there is nothing to lead with, and the default pack is the better message —
 * see shouldUseReputationOpener below.
 */

/** The variant only earns its place when there is a real reputation to open on. */
export const REPUTATION_MIN_REVIEWS = 50;

export function shouldUseReputationOpener(business: {
  hasWebsite: boolean;
  reviewCount?: number;
}): boolean {
  return !business.hasWebsite && (business.reviewCount ?? 0) >= REPUTATION_MIN_REVIEWS;
}

export const REPUTATION_OPENER_POOL = `OPENER — lead with what they have already built, never with what is missing.

PART 1 — GREETING (first line, always):
Pick based on the timeOfDay field:
• morning   → "Good morning [shortName]!"
• afternoon → "Good afternoon [shortName]!"
• evening   → "Good evening [shortName]!"
• not given → "Hi [shortName]!"

Never "I hope this message finds you well".

PART 2 — RECOGNITION (new line):
Open on their reputation. Use the real numbers. One sentence.

1. "[reviewCount] reviews at [rating] stars is the kind of reputation most businesses
    are still trying to build."
2. "Went through your reviews. [reviewCount] of them, and people clearly rate what you do."
3. "[reviewCount] Google reviews says people keep coming back."

PART 3 — THE GAP, framed as reach and not as failure (new line):
The reputation is real. The limit is who gets to see it. Say that, once:

1. "Right now that reputation only reaches people who already know to look for you."
2. "The people who already found you can see it. The ones searching for a
    [industry] in [city] cannot."
3. "That trust is doing its work on Google. There is nowhere for it to send people next."

NEVER say, in any form:
• "You don't have a website"
• "You're invisible online" / "customers can't find you"
• "You're missing out" / "losing customers" / "leaving money on the table"
• "In 2026, every business needs..."
Those are the default pack's job. This variant exists precisely to avoid them.`;

export const REPUTATION_OBSERVATION = `THE POSSIBILITY — one sentence. What the
reputation could do if it had somewhere to send people.

Shape: "A site would give that reputation somewhere to land, so [what a customer
could then do without calling]."

Examples by trade:
• Restaurant: "so someone can see the menu and prices before they decide"
• Clinic: "so a patient can see what you treat and book without ringing"
• Salon: "so a client can see services and prices before they get in touch"
• Construction: "so someone can see what you have built before they call"

This is an addition to something that already works, never a fix for something broken.
The reviews are the proof. The site is the place that proof sends people.

Do NOT list features, pages, or technologies. One sentence, then the question.`;

export const REPUTATION_CTA_POOL = `CALL TO ACTION — pick ONE, on its own line at the end.

1. "Is that something you've thought about for [shortName]?"
2. "Would it be worth seeing what that could look like?"
3. "I had an idea for how I'd approach it for [shortName]. Want to see?"

One question only. No urgency, no free-work promises, no asking for a call.`;
