/**
 * Step-10 Spike — cold_first_touch quality comparison.
 *
 * Runs the CURRENT outreach/route.ts prompt system and the NEW layered
 * composer system against the same test prospect, prints both side by side.
 *
 * No Next.js, no DB, no imports from lib/ — self-contained.
 * Run: node --env-file=.env spike-cold-first-touch.mjs
 */

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Test prospect ────────────────────────────────────────────────────────────
const PROSPECT = {
  name: 'Glamour Touch Beauty Salon',
  category: 'Beauty Salon',
  address: 'Lekki Phase 1, Lagos, Nigeria',
  phone: '+234 803 000 0000',
  hasWebsite: false,
  rating: 4.6,
  reviewCount: 89,
  lastReviewDate: '2 weeks ago',
  openingHours: ['Monday–Saturday: 9am–8pm'],
  description: 'Premium hair styling, facials, nails and bridal packages',
  website: null,
};
const COMPETITORS = ['Style Hub Lagos', 'Luxe Beauty Lekki'];

const PROFILE = {
  senderName: 'Azeez',
  businessName: 'Runvax',
  whatsapp: '+234 800 000 0000',
  city: 'Lagos',
  tagline: 'Building digital front doors for Nigerian businesses',
  services: 'Web design, SEO, Google Business Profile setup',
};

// ─── CURRENT SYSTEM ──────────────────────────────────────────────────────────
// Reproduced verbatim from src/app/api/outreach/route.ts (PAS, WhatsApp path)

const CURRENT_FRAMEWORK_GUIDES = {
  PAS: `Use the PAS (Problem-Agitate-Solution) framework:
- PROBLEM: Identify the core gap — no website means invisible to Google, invisible to AI search engines, invisible to customers who research before they visit.
- AGITATE: Make the cost real — every day without a website, potential customers find competitors. In 2026, even ChatGPT recommends businesses from websites. Without one, you don't exist online.
- SOLUTION: Introduce your service as the relief — a website built for 2026: mobile-first, SEO-optimised, GEO (Generative Engine Optimization) ready so AI tools can discover and recommend them too.`,
};

const CURRENT_POSITIONING = `
CORE POSITIONING — THIS IS THE HEART OF EVERY MESSAGE:
We do NOT sell "a website". We build a DIGITAL FRONT DOOR — a digital experience centre.
Frame it as the complete experience a customer has:
- BEFORE coming in-store / in-location: they search Google or ask an AI assistant, they find the business, see the reviews, the photos, the story, the offer — and decide to trust it before they ever walk in.
- DURING: the site answers their questions, shows directions, takes bookings/enquiries 24/7.
- AFTER leaving: it keeps them connected — repeat visits, referrals, reviews, loyalty.
This is a digital experience centre that shapes how people feel about the business at every touchpoint, not a brochure.

REVIEWS / SOCIAL PROOF ANGLE (use when the business HAS Google reviews):
- If they have reviews, point it out specifically: "You've earned [N] Google reviews — that's real trust most businesses dream of."
- Then the gap: that hard-earned trust has nowhere to land. When someone reads those reviews and searches for them, there's no website, no front door — so the trust leaks away to a competitor who has one.
- Make it sting gently: their reputation is already built; they're just not capturing the customers it's attracting.

KEY 2026 DIGITAL PRESENCE CONCEPTS TO WEAVE IN NATURALLY (pick 1-2, don't list them all):
- SEO: Google ranks websites, not social media pages — without a website they rank for nothing
- AIEO (AI Engine Optimization): When people ask ChatGPT, Gemini, or Perplexity "best [their niche] in [their city]", AI tools pull answers from websites. No website = not recommended by AI
- GEO (Generative Engine Optimization): Structuring website content so generative AI engines can discover, understand and recommend the business
- A digital front door works 24/7 — answering questions, building trust, taking enquiries while they sleep

DO NOT use all these terms — pick the most natural one for the niche and weave it in like a knowledgeable friend sharing insight, not a lecture.`;

const CURRENT_NG_CONTEXT = `
NIGERIAN BUSINESS CONTEXT:
- Nigerians trust WhatsApp — always mention WhatsApp integration
- Most discovery happens through referrals and Google Maps — position website as the next step
- Business owners are busy — keep the message SHORT, warm, and respectful of their time
- Avoid sounding like a mass message — reference something specific about THEIR business
- Use warm Nigerian English tone — not formal British English, not American slang
- Never start with "Hope this message finds you well" or "My name is..."
- Don't preach — share insight like a knowledgeable friend, not a salesman`;

function buildCurrentSystem() {
  return `You are a world-class copywriter specialising in outreach for Nigerian web developers and digital agencies. You write messages that feel like they came from a genuine, knowledgeable friend — not a spammer or salesperson.

Your messages:
✅ Use ONLY the short business name (before any parentheses) — never paste the full long Google name into the message
✅ If the business category is generic ("Business", "Establishment", "Local business"), infer the niche from the business name or address instead — never say "business businesses" or "local local businesses"
✅ Are specific to the exact business and niche — never generic
✅ Show the prospect you actually looked at their business
✅ Educate without preaching — one sharp insight, delivered naturally
✅ Position the offer as a DIGITAL FRONT DOOR / digital experience centre — NEVER as "just a website"
✅ When you use the phrase "digital front door", always write it exactly as "digital front door (website)" so the prospect understands it means a real website
✅ Whenever you mention AI tools, AI search, or being found/recommended by AI, ALWAYS name concrete examples in brackets: "(like ChatGPT, Claude, Google AI)" — never say "AI tools" on its own
✅ VARY every single message — never reuse the same opening line, sentence shapes, emojis, or structure between prospects. Each message must read as individually hand-written, never a fill-in-the-blank template
✅ Have a soft, curious CTA — opening a conversation, not closing a sale
✅ Sound like a human wrote them, not a template
✅ Never use phrases like "I hope this message finds you well", "My name is X and I...", "Are you interested in..."

WHATSAPP FORMATTING (critical — always apply):
• Write in short paragraphs — 1 to 2 sentences per paragraph, blank line between each
• *asterisks* = bold — use for: business name, key numbers (review count), and the core offer phrase
• _underscores_ = italic — use for: emotional phrases, the CTA question, and soft empathetic lines
• Never write a wall of text — if a paragraph is more than 2 sentences, split it
• Maximum 2 emojis per message, placed naturally mid-sentence or at the end

${CURRENT_POSITIONING}
${CURRENT_NG_CONTEXT}`;
}

function buildCurrentUser() {
  const shortName = 'Glamour Touch Beauty Salon';
  const competitorLine = `- Nearby competitors WITH websites: ${COMPETITORS.join(', ')} — use this as a gentle comparison point in the message`;

  const businessContext = `
BUSINESS RESEARCH:
- Name: ${shortName} (full: ${PROSPECT.name})
- Type/Niche: ${PROSPECT.category}
- Location: ${PROSPECT.address}
- Phone: ${PROSPECT.phone}
- Has website: NO — this is a prime opportunity
- Google Rating: ${PROSPECT.rating}/5 stars with ${PROSPECT.reviewCount} reviews
- Last review: ${PROSPECT.lastReviewDate}
- Opening hours listed: Yes
- About: ${PROSPECT.description}
- Competitor intel: ${competitorLine}`;

  return `${businessContext}

COPYWRITING FRAMEWORK TO USE: PAS
${CURRENT_FRAMEWORK_GUIDES.PAS}

IMPORTANT: This business has ${PROSPECT.reviewCount} Google reviews (${PROSPECT.rating}/5). OPEN by acknowledging this specific number as earned trust, then reveal the gap — that trust has no digital front door to land on. Use the real number.

First, silently work out the 4-6 features a ${PROSPECT.category} website most needs — chosen specifically to DISMANTLE this prospect's likely objections ("it's too expensive", "I already have Instagram/Facebook", "I'm too busy", "I don't really need one", "I get clients by referral"). Make every feature concrete and category-specific (e.g. for beauty salon: online booking system, WhatsApp integration, before/after portfolio gallery, service menu with prices, Google + AI visibility, bridal package showcase). You will use these in the checklist below.

Write TWO outreach messages using the PAS framework:

---WHATSAPP---
[WhatsApp message — MAX 130 words. Structure it in SHORT paragraphs (1-2 sentences each), separated by blank lines. Treat the structure as a LOOSE guide — vary your opening, phrasing and flow so it never feels templated.

FORMATTING RULES — apply these exactly:
• Use *asterisks* for bold: wrap key stats, the business name, and the core value proposition in *bold*
• Use _underscores_ for italic: wrap emotional or soft phrases in _italic_
• Each paragraph = one idea. Never write a wall of text.
• 1-2 emojis maximum, placed naturally (not at the start of every line)
• Include a SHORT checklist of 3 of the most objection-busting features, each on its own line starting with "✅ " (keep each to ~4 words)
• End with a soft CTA question on its own line, in _italic_]

---EMAIL-SUBJECT---
[Subject line — max 8 words. Intriguing, specific, not salesy.]

---EMAIL-BODY---
[Email — MAX 230 words. Short paragraphs. Include a checklist titled "Here's what your new site would include:" with 4-6 features (each line starting with "✅ "). End with ONE clear, low-friction CTA.]

SENDER IDENTITY:
- Name / Agency: ${PROFILE.businessName} (${PROFILE.senderName})
- WhatsApp: ${PROFILE.whatsapp}
- City: ${PROFILE.city}
- Tagline: ${PROFILE.tagline}
- Services: ${PROFILE.services}

Sign the email naturally as ${PROFILE.senderName} from ${PROFILE.businessName}.
For WhatsApp, do NOT add a formal signature — just end naturally.`;
}

// ─── NEW LAYERED SYSTEM ───────────────────────────────────────────────────────
// Implements the v3 composer inline for cold_first_touch, whatsapp, Nigeria, no website.
// Router picks: primary=three_line, secondary=pas, principle=reciprocity, cta=micro

function newRoleBlock() {
  return `You are an elite local-business sales specialist and copywriter operating in Lekki, Lagos, Nigeria. You help web designers and digital agencies close deals with local SMBs. You know Nigerian consumer behaviour, Nigerian pricing, and exactly how Lagos business owners think and communicate.`;
}

function newFrameworkBlock() {
  return `PRIMARY FRAMEWORK: Three-Line Structure
Apply this in the message body:
1. Observation — one ultra-specific, true detail about THIS business that shows you actually looked (use real review count, real niche, real location)
2. Implication — the quietly-expensive consequence of the gap you just named (make it personal, not preachy)
3. Ask — a single, soft, curiosity-opening question or offer that moves the conversation forward

SECONDARY BLEND: PAS (Problem-Agitate-Solution) woven into the above
Where the Three-Line gives the skeleton, let PAS give it texture:
- The Observation names the Problem
- The Implication is the Agitation (make the cost real, briefly)
- The Ask opens the door to the Solution (your service — but don't pitch the solution yet, just open the door)

Do NOT label these steps in the message. The reader should feel the shape, not see it.`;
}

function newPersuasionBlock() {
  return `PERSUASION PRINCIPLE: Reciprocity (Cialdini)
Reciprocity means giving something of real value before asking for anything. Apply it here by leading with a genuine insight — something the prospect didn't know about their own situation, delivered as a gift, not a hook. The offer at the end (a free mockup or a quick idea) is the tangible reciprocity trigger. Make sure the reader feels you gave them something BEFORE you asked.

Specific to Glamour Touch: you know they have 89 Google reviews and 4.6 stars — that's hard-earned trust. Naming it specifically IS the gift. You're giving them recognition most people miss. That's reciprocity in action.`;
}

function newLocalizationBlock() {
  return `LOCALIZATION — NIGERIA (NG), LAGOS, BEAUTY SALON — MANDATORY, NON-NEGOTIABLE

Currency: ₦ only. Never use $, £, or vague "money" language.
Price band for this market: A proper salon website in Lagos is typically ₦150,000–₦250,000. If pricing comes up, stay in that band.

Channel: WhatsApp
Hard limits you MUST obey:
• Maximum 120 words total (count before outputting — shorten if needed)
• No subject line
• Warm, conversational, peer-to-peer — this is a WhatsApp message from one professional to another
• Maximum 2 emojis. Place them naturally, never at the start of every line.
• End with ONE question the recipient can answer in a single tap or one word.

Tone register: warm, respectful, direct. Lagos business owners are sharp and busy — they respond to insight, not flattery. Sound like a knowledgeable friend who spotted something, not a salesperson running a script.

Local objection awareness: Common objections for Lagos salon owners include: "I get all my clients through referrals and Instagram," "I don't have time to manage a website," "websites are expensive." If ONE of these is relevant, address it proactively and briefly — do NOT list all of them.`;
}

function newCtaBlock() {
  return `CALL TO ACTION LEVEL: Micro
A "micro" CTA is the lowest-friction possible ask — not a sale, not a commitment, not even a call. It is an offer of something free and immediately useful: a quick mockup, a 5-minute idea, a free look at what their digital presence could look like. The goal is ONE reply, not a closed deal.

RULE YOU MUST FOLLOW: End with EXACTLY ONE call to action. Do not stack multiple CTAs. Do not ask two questions. One question. One tap to answer. That's it.`;
}

function newHouseStyleBlock() {
  return `RUNVAX HOUSE STYLE — APPLY THESE EXACTLY

POSITIONING: Do NOT sell "a website." You are building a digital front door — a digital experience centre. Frame it as the complete journey a customer takes:
• BEFORE visiting: they search Google or ask an AI assistant, find the business, read the reviews, see the photos — and decide to trust it before they walk in.
• DURING: the site answers questions, shows directions, takes bookings 24/7.
• AFTER: it keeps them connected — repeat visits, referrals, reviews.
When you use the phrase "digital front door," write it exactly as "digital front door (website)" so they know it's a real website.

REVIEW ANGLE (this prospect has 89 reviews — USE THEM):
Open by naming the 89 reviews as something real and earned. Then land the gap: that trust has no front door to land on. When someone reads those reviews and tries to find the website, there's nothing — so the trust leaks to a competitor who has one. Make it sting gently. Their reputation is built; they're just not capturing the customers it's already attracting.

AI SEARCH ANGLE: When you mention AI search, always name concrete tools: "(like ChatGPT, Claude, Google AI)" — never say "AI tools" alone.

OBJECTION-BUSTING CHECKLIST — MANDATORY IN BOTH WHATSAPP AND EMAIL:
Every message MUST include a short ✅ checklist of features. These are NOT generic — each one is chosen to dismantle a specific objection a Beauty Salon owner is likely to have:
  • "I already have Instagram/Facebook" → show what a website does that Instagram can't
  • "I get clients by referral" → show how a website makes referrals stickier
  • "I'm too busy to manage it" → show it runs itself
  • "It's too expensive" → show the value per feature
  • "I don't really need one" → show what they're quietly losing
Each checklist line starts with "✅ " and is no more than 5 words. Concrete and salon-specific.
WhatsApp: 3 items, placed between the agitation paragraph and the CTA question.
Email: 4–6 items, placed under "Here's what your digital front door (website) would include:".

WHATSAPP FORMATTING — CRITICAL:
• Short paragraphs: 1–2 sentences, blank line between each
• *asterisks* = bold → use for: the business name, the review count, the core offer phrase
• _underscores_ = italic → use for: emotional lines, the CTA question
• Never write a wall of text
• Maximum 2 emojis, placed mid-sentence or at the end — never decorative at line starts
• STRICTLY ≤120 words total — count before outputting, shorten if needed

HARD BANS:
• Never: "I hope this message finds you well" / "My name is X and I..." / "Are you interested in..."
• Never fabricate stats or results you don't have data for
• Never use placeholder text like [INSERT NAME] — use the real data
• Never mention competitor tool names (Apollo, ZoomInfo, etc)
• Use short business name only: "Glamour Touch" not the full Google name`;
}

function newQualityCheckBlock() {
  return `QUALITY SELF-CHECK — DO THIS SILENTLY BEFORE WRITING
Run every check. If any fails, rewrite before outputting.

4 C's:
• Clear? — would a non-technical salon owner understand every sentence?
• Concise? — is every word earning its place? (WhatsApp: max 120 words — count them)
• Compelling? — does it make her feel something?
• Credible? — does it use real data, no fabrications?

4 U's:
• Useful? — does the opener give her something of value before asking?
• Urgent? — does it show what she's quietly losing right now?
• Unique? — is there even one sentence that could ONLY be about Glamour Touch?
• Ultra-specific? — does it name the 89 reviews, the Lekki location, the beauty/salon niche?

Hero check: Is the SALON OWNER the hero of this message? You are the guide. Never the star.

Output ONLY the final message — no preamble, no "here's the message:", no framework labels.`;
}

function newOutputContractBlock() {
  return `OUTPUT FORMAT — FOLLOW EXACTLY, NO DEVIATIONS

---WHATSAPP---
[WhatsApp message — STRICTLY ≤120 words. Short paragraphs (1–2 sentences), blank line between each.
FORMATTING: *bold* for business name / key numbers / core offer phrase; _italic_ for emotional lines and the CTA.
STRUCTURE:
  Para 1: The Observation — name the 89 reviews + the earned trust (reciprocity gift)
  Para 2: The Implication — what that trust is quietly losing them right now (agitation)
  Checklist (3 lines, 5 words max each):
    ✅ [salon-specific feature that kills "Instagram is enough"]
    ✅ [salon-specific feature that kills "I get referrals"]
    ✅ [salon-specific feature that kills "too busy/expensive"]
  Final line: _[Micro CTA — one soft question, in italic, answerable in one tap]_
Do NOT add a signature. Count words before outputting — shorten if over 120.]

---EMAIL-SUBJECT---
[Max 8 words. Name the city or the specific business. Intriguing, never salesy. No "Quick question" or "Check this out".]

---EMAIL-BODY---
[STRICTLY ≤200 words. Short paragraphs, one idea each. Open with the same core hook as WhatsApp, phrased differently for email register.
Include: "Here's what your digital front door (website) would include:" followed by 4–6 ✅ items — beauty-salon-specific, objection-dismantling.
End with ONE low-friction CTA (not stacked, not two questions).
Sign: ${PROFILE.senderName} from ${PROFILE.businessName}.]`;
}

function buildNewSystem() {
  // Output contract lives in the USER message (where model attention is highest).
  // System = role + methodology layers only.
  return [
    newRoleBlock(),
    newFrameworkBlock(),
    newPersuasionBlock(),
    newLocalizationBlock(),
    newCtaBlock(),
    newHouseStyleBlock(),
    newQualityCheckBlock(),
  ].join('\n\n---\n\n');
}

function buildNewUser() {
  const prospect = JSON.stringify({
    businessName: 'Glamour Touch Beauty Salon',
    shortName: 'Glamour Touch',
    industry: 'Beauty Salon',
    city: 'Lekki, Lagos',
    country: 'NG',
    hasWebsite: false,
    socialOnly: true,
    leadScore: 8,
    rating: 4.6,
    reviewCount: 89,
    competitorWithSite: 'Style Hub Lagos',
    channel: 'whatsapp',
    intent: 'cold_first_touch',
    priceBand: '₦150,000–₦250,000',
  }, null, 2);

  // Output contract in the user turn — high attention, clear expectation.
  return `${prospect}

${newOutputContractBlock()}

YOU MUST produce all three sections in the exact order shown above.
Do not stop after the WhatsApp section. All three are required.`;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function callModel(label, system, user) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  CALLING: ${label}`);
  console.log(`${'═'.repeat(60)}\n`);

  const start = Date.now();
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1100,
    temperature: 0.9,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const text = completion.choices[0]?.message?.content ?? '';

  console.log(`[${label}] — ${elapsed}s | ${completion.usage?.total_tokens} tokens`);
  console.log(`\n${text}\n`);

  return { label, text, elapsed, tokens: completion.usage?.total_tokens };
}

function parseOutput(text) {
  const whatsapp = text.match(/---WHATSAPP---([\s\S]*?)---EMAIL-SUBJECT---/)?.[1]?.trim() ?? '(not found)';
  const subject = text.match(/---EMAIL-SUBJECT---([\s\S]*?)---EMAIL-BODY---/)?.[1]?.trim() ?? '(not found)';
  const body = text.match(/---EMAIL-BODY---([\s\S]*?)$/)?.[1]?.trim() ?? '(not found)';
  return { whatsapp, subject, body };
}

function wordCount(str) {
  return str.split(/\s+/).filter(Boolean).length;
}

async function main() {
  console.log('\n🧪  Runvax — Step-10 Spike: cold_first_touch quality delta');
  console.log('   Prospect: Glamour Touch Beauty Salon, Lekki Lagos, no website');
  console.log('   89 reviews · 4.6★ · competitor: Style Hub Lagos\n');

  // Fire both in parallel
  const [currentRes, newRes] = await Promise.all([
    callModel('CURRENT SYSTEM (outreach/route.ts — PAS)', buildCurrentSystem(), buildCurrentUser()),
    callModel('NEW LAYERED SYSTEM (v3 composer — Three-Line+PAS, Reciprocity, Micro CTA)', buildNewSystem(), buildNewUser()),
  ]);

  const cur = parseOutput(currentRes.text);
  const neo = parseOutput(newRes.text);

  // ── Side-by-side WhatsApp comparison ────────────────────────────────────────
  console.log('\n' + '█'.repeat(60));
  console.log('  WHATSAPP COMPARISON');
  console.log('█'.repeat(60));

  console.log('\n── CURRENT ──────────────────────────────────────────────');
  console.log(cur.whatsapp);
  console.log(`\n   Word count: ${wordCount(cur.whatsapp)} / 120`);

  console.log('\n── NEW ──────────────────────────────────────────────────');
  console.log(neo.whatsapp);
  console.log(`\n   Word count: ${wordCount(neo.whatsapp)} / 120`);

  // ── Email comparison ─────────────────────────────────────────────────────────
  console.log('\n' + '█'.repeat(60));
  console.log('  EMAIL COMPARISON');
  console.log('█'.repeat(60));

  console.log('\n── CURRENT SUBJECT ──────────────────────────────────────');
  console.log(cur.subject);
  console.log('\n── NEW SUBJECT ──────────────────────────────────────────');
  console.log(neo.subject);

  console.log('\n── CURRENT BODY ─────────────────────────────────────────');
  console.log(cur.body);
  console.log(`\n   Word count: ${wordCount(cur.body)} / 200`);

  console.log('\n── NEW BODY ─────────────────────────────────────────────');
  console.log(neo.body);
  console.log(`\n   Word count: ${wordCount(neo.body)} / 200`);

  // ── Quality gate (deterministic tier 1) ────────────────────────────────────
  console.log('\n' + '█'.repeat(60));
  console.log('  TIER-1 QUALITY GATE (deterministic)');
  console.log('█'.repeat(60));

  const BANNED = [
    'i hope this', 'as per my last', 'i wanted to reach out',
    'just following up', 'touching base', 'synergy', 'leverage', 'game-changer'
  ];
  const PLACEHOLDER = /\[.+?\]/g;
  const NG_CURRENCY = /₦/;
  const HAS_QUESTION = (s) => (s.match(/\?/g) || []).length;

  function gate(label, wa, email) {
    const issues = [];
    const waLower = wa.toLowerCase();

    if (BANNED.some(b => waLower.includes(b))) issues.push('banned phrase in WhatsApp');
    if (PLACEHOLDER.test(wa)) issues.push('unfilled placeholder in WhatsApp');
    if (HAS_QUESTION(wa) === 0) issues.push('no CTA question in WhatsApp');
    if (HAS_QUESTION(wa) > 2) issues.push(`too many questions in WhatsApp (${HAS_QUESTION(wa)})`);
    if (wordCount(wa) > 120) issues.push(`WhatsApp over limit (${wordCount(wa)} words)`);
    if (wordCount(email) > 200) issues.push(`email body over limit (${wordCount(email)} words)`);

    const passed = issues.length === 0;
    console.log(`\n${label}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) issues.forEach(i => console.log(`   • ${i}`));
    return passed;
  }

  const curPass = gate('CURRENT', cur.whatsapp, cur.body);
  const newPass = gate('NEW', neo.whatsapp, neo.body);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '█'.repeat(60));
  console.log('  SPIKE SUMMARY');
  console.log('█'.repeat(60));
  console.log(`\nCurrent  — ${currentRes.tokens} tokens · ${currentRes.elapsed}s · gate: ${curPass ? 'PASS' : 'FAIL'}`);
  console.log(`New      — ${newRes.tokens} tokens · ${newRes.elapsed}s · gate: ${newPass ? 'PASS' : 'FAIL'}`);
  console.log('\nReview the WhatsApp and Email outputs above.');
  console.log('Does the NEW version match or beat the CURRENT? Y/N → tell Azeez before wiring.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
