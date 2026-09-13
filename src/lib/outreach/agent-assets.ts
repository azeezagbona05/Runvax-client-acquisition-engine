/**
 * House-style assets for the AI business system offer.
 *
 * Two things separate this from the website pack in assets.ts.
 *
 * First, there is no absence to point at — these businesses already have a
 * website — so the message is built from the industry's workflow instead. The
 * workflow facts come from industryAngles.ts and are true of every business in
 * the trade, which matters because customer complaints only appear in about 2%
 * of records. A review quote sharpens the opener when one exists; it is never
 * what the message rests on.
 *
 * Second, the first message is not the pitch. Its only job is to earn "yes,
 * show me". Explaining the system belongs in the reply, not the opener.
 */

// ─── Opener pool ──────────────────────────────────────────────────────────────

export const AGENT_OPENER_POOL = `OPENER — a greeting, then ONE observation about how this business runs.

PART 1 — GREETING (first line):
Pick based on the timeOfDay field:
• morning   → "Good morning [shortName]!"
• afternoon → "Good afternoon [shortName]!"
• evening   → "Good evening [shortName]!"
• not given → "Hi [shortName]!"

Keep it to the greeting. Do not add "hope you're doing well" on top of a warm
greeting that already does that work. Never "I hope this message finds you well".

PART 2 — ACKNOWLEDGEMENT (same line as the greeting, or the line after):

Before naming anything that could be better, give them one short, factual nod. Going
straight from "hello" to "here is your problem" is what makes a cold message feel like
an accusation, and it is the main reason owners do not reply.

Pick based on the data you were given. ONE clause, under twelve words:

• hasWebsite is true AND reviewCount is 50 or more — the strongest prospect there is.
  They have built the foundation AND the reputation. Recognise both:
  "You've got the site up and [reviewCount] reviews behind it. That's not easy to build."
  "[reviewCount] reviews and a site already running. You've done the hard part."

• hasWebsite is true, reviews under 50:
  "Had a look at your site. You've clearly put work into it."
  "Your site does a good job of laying out what you offer."

• hasWebsite is false, reviewCount is 20 or more:
  "[reviewCount] reviews at [rating] stars is a strong reputation to have built."
  "Your reviews say a lot about how you look after people."

• neither: SKIP this part entirely and go straight to the moment.
  Do not invent something to praise. An empty compliment is worse than none.

THE UNDERLYING STANCE, which every message must obey: you are not here to tell them
what is wrong. You are here because something is already working, and there is a layer
that would make it work harder. Never position anything they have as inadequate.

This is an acknowledgement, not flattery. Banned: "impressive", "amazing", "incredible",
"that's fantastic", "speaks volumes", "quite an achievement", "congratulations",
exclamation marks stacked on it. State the fact and move on.

PART 3 — THE MOMENT (new line):
Do not state a fact about them. Put them inside a moment from their own week, using
the scenario field you are given, and let them picture what currently happens.

The scenario is always conditional. It describes a situation that could occur, never
an event you claim did occur.

Phrase it one of these ways:
1. "When [scenario], that usually waits until the morning."
2. "When [scenario], what happens next?"
3. "[shortName] probably gets this: [scenario]. Then it sits until someone is free."

If you use form 2, the message now contains two questions including the CTA. That is
the maximum. Never three.

If a review quote is supplied in observedFacts, lead with that instead — a customer's
own words beat any scenario. Refer to it the way a person would:
4. "Saw a few of your reviews mention it can be hard to get through."

NEVER open with:
• "Quick question" — every other person messaging this business opens that way
• "Are you using AI", "AI is changing", "In today's digital world"
• "I help businesses automate", "I was browsing", "Your business stood out"
• A question that asks them to count or estimate something about their own operation
  ("how many enquiries do you get", "how much time does your team spend"). A stranger
  has not earned that. Show them the moment instead of asking them to audit it.

NEVER assume a channel you were not given. You know they have a phone. You do not know
they use Instagram, WhatsApp Business, a booking system, or a receptionist. Say
"messages" or "gets in touch", not the name of a platform.`;

// ─── CTA pool ─────────────────────────────────────────────────────────────────

export const AGENT_CTA_POOL = `CALL TO ACTION — pick ONE. The goal is "yes, show me", nothing more.

Options:
1. "I mapped out how this could work for [shortName]. Want to see it?"
2. "I had an idea for how this would work at [shortName]. Want me to show you?"
3. "Would you be open to seeing what that would look like for [shortName]?"
4. "Can I show you what I mean?"

On its own line at the end. One question only, no stacking.
Do NOT ask for a call, a meeting, or 15 minutes in the first message.
Do NOT promise free work or add urgency.`;

// ─── Observation pattern ──────────────────────────────────────────────────────

export const AGENT_OBSERVATION_PATTERN = `THE MIDDLE — respect, then the opportunity, then the advantage.

The message follows one emotional sequence, and the order is the whole point:

  RECOGNITION  → the acknowledgement in the opener. What they have built.
  RESPECT      → the way they handle this now is not wrong.
  OPPORTUNITY  → what could happen instead.
  ADVANTAGE    → what that means for them going forward.
  CURIOSITY    → the ask.

RESPECT — half a sentence, attached to the moment. This is what stops the message
reading as an accusation. The current way of working is a reasonable thing a real
business does, not a failure:
  "That's normally handled by someone on the team, which works until two people ask
   at once."
  "Most places handle that by hand, and it works fine right up to the point it doesn't."
Never imply they are behind, losing, missing out, or doing it wrong.

OPPORTUNITY — one sentence, framed as something that exists rather than something you
sell. Use the outcome field, which is written in the owner's language on purpose:
  "There's now a way for [outcome], so [what the team stops having to do]."

Right: "There's now a way for that first conversation to happen straight away, with
        your team getting the details and stepping in when it matters."
Wrong: "I've built an AI system that automates your patient communication."

ADVANTAGE — optional, one short clause, and only about THEM. What having this changes
going forward: enquiries keep moving when the team is at capacity, the busiest hours
stop costing them, growth stops meaning more people answering the same questions.
  "So a busy week stops costing you enquiries."
  "It means growing doesn't have to mean more people on the phone."

The advantage is ALWAYS about their own operation. NEVER about other businesses.
You do not know what their competitors are doing. See the bans.

THE NEXT-LAYER FRAMING — use when hasWebsite is true. This is the strongest line
available for that segment, because it treats their site as an asset rather than a gap:
  "Your site gives people the information. This is the part that helps them act on it."
  "The information is already there. This is what makes it answer back."
Never suggest their site is outdated, underperforming, or not doing its job.

MARKET CONTEXT — EMAIL ONLY, optional, at most one sentence:
  "Businesses in your space are beginning to explore this."
That exact hedge, or something equally soft. You may NOT say "your competitors", name
any business, claim anyone specific has adopted it, or imply they are behind. We have
no data on what other businesses in their area are running, and a claim they can check
and disprove ends the conversation.

DO NOT NAME THE TECHNOLOGY. Not "AI", not "a system I built", not "software", not
"a tool". The owner already knows AI exists. Naming it turns you into a vendor before
they have pictured anything. If they reply, you explain it then.

You may say "something that handles it" at most once, and only if the sentence
genuinely needs a subject.

Do NOT explain how it works, list components, name integrations, or describe the
build. That is the second message. This message exists to earn a reply.`;

// ─── Competitor angle ─────────────────────────────────────────────────────────

export const AGENT_COMPETITOR_ANGLE = `COMPETITOR ANGLE — only when competitorWithSite is provided, and only in email.
The WhatsApp message is too short to carry it.

One neutral sentence: "[competitorWithSite] nearby already replies to enquiries
instantly, day or night."

Do NOT say they are losing or falling behind. State the fact. The contrast does the work.
If no competitor is provided, skip this entirely.`;

// ─── Length ───────────────────────────────────────────────────────────────────

export const AGENT_BEAT_BUDGET = `BEAT BUDGET — the most important structural rule.

You have six components available. You must NOT use them all. Using every one is how a
message turns into a pitch, and a pitch is what the owner deletes.

  1. RECOGNITION   what they have already built
  2. OPPORTUNITY   the layer that could sit on top of it
  3. VISUALISATION what it would actually do, in their trade's language
  4. OUTCOME       what changes for them or their team
  5. MARKET        "businesses in your space are beginning to explore this"
  6. CTA           the curiosity question

OPPORTUNITY IS NEVER OPTIONAL. The CTA asks "want to see it?" — if the message never
said what "it" is, the owner has been shown a problem and offered nothing. That is the
single worst failure this message can have, and it is the most common one.

Every message must state, in plain words, what could happen instead. No exceptions.

WhatsApp: EXACTLY 3 beats.
  1. Recognition
  2. The moment AND the possibility, fused into one short paragraph. The moment is a
     clause; the possibility is the sentence that follows it. Never the moment alone.
  3. CTA
If the data supports no recognition, drop beat 1 and use two beats. Never drop beat 2.

Email: MAXIMUM 4 beats. Recognition, the moment plus the possibility, ONE of Outcome or
Market, then CTA. Outcome and Market are mutually exclusive; the possibility is not
optional and does not count as either.

BEFORE YOU OUTPUT, read your own CTA and ask: does the word "that" or "it" in my
closing question point at something I actually described? If not, the message is
broken. Add the possibility.

PICK ONE ANGLE and stay on it. You are given a primaryAngle field. Everything in the
message serves that one angle:

  missed_enquiry      an enquiry arrives and nobody is there to take it
  staff_workload      the same questions absorbing a person's day
  speed_of_response   whoever answers first tends to win the customer
  customer_experience what it feels like to be the customer trying to get an answer

Do not mention a second angle. Two angles read as a list of benefits, and a list of
benefits reads as an advert.

SPECIFICITY — the message must contain at least one thing that could only have been
written about THIS business. Their real review count, their rating, their actual trade
and area. If swapping the business name would leave the message equally true of any
competitor down the road, it is not finished.

THE TEST, applied before you output: would a busy owner read this and think
"interesting, how would that work for us?" — or would they immediately recognise it as
another AI sales message? If the second, cut a beat and try again.`;

export const AGENT_LENGTH_RULE = `LENGTH — this is a hard constraint and the most common failure.

WhatsApp first message: 75 words MAXIMUM, three beats:
  greeting plus the recognition clause
  ONE of: the moment, what it would do, or what it changes
  the question

Email first message: 120 words maximum, at most four beats plus a signature.

You are not selling the system in this message. You are earning a reply.
If the message explains what the system includes, how it is built, what it
integrates with, or why AI matters, it is too long. Cut it.

Count the words before you output. If WhatsApp is over 75, delete a whole beat —
not a few adjectives — and count again.`;

// ─── Hard bans specific to this offer ─────────────────────────────────────────

export const AGENT_HARD_BANS = `NEVER USE (in addition to the general bans):
• "AI agent", "chatbot", "bot", "automation", "workflow", "agentic", "LLM", "GPT"
• "AI-powered", "AI-driven", "cutting edge", "digital transformation", "future-proof"
• "24/7" as a headline claim, "never miss a lead again", "10x your business"
• "I provide", "we offer", "our solutions", "our services" — vendor language
• Any invented number: message volume, missed calls, revenue lost, hours saved,
  conversion rates. If it is not in the business data, it does not exist.
• Claims about how they currently work internally. You know the trade's normal
  workflow, which is what you were given. You do not know their staffing, their
  systems, or how many enquiries they get.
• Lists, bullet points, or feature descriptions in the first message.
• Stiff, written-sounding phrasing. "The groundwork is plainly there", "it is evident
  that", "a testament to", "top-notch", "second to none". Read the line aloud first: if
  you would not say it to someone in a shop, do not write it.
• Flattery language in the acknowledgement. "That's impressive", "quite an achievement",
  "speaks volumes", "congratulations". A factual nod is required; praise is banned.
• "Unbeatable", "left behind", "falling behind", "the businesses that don't will lose",
  "the future of", "don't get left out". Every one of these is hype and reads as pressure.
• "Your competitors are already using this", or any claim that a specific business,
  named or unnamed, has adopted it. We have no evidence and they can check.
• "You need AI", "you should be using AI", "every business needs this" — telling an
  owner what they need. Show them the moment and let them draw the conclusion.`;

// ─── Evidence discipline ──────────────────────────────────────────────────────

export const AGENT_EVIDENCE_RULE = `EVIDENCE RULE — a hard constraint.

You are given two kinds of input, and they are not interchangeable.

observedFacts        — true of THIS business. State them freely.
businessCharacteristic / manualProcess
                     — how this TRADE normally operates. Phrase as a general pattern
                       ("most [industry] businesses handle this by hand"), or as
                       something you noticed about their setup. Never as a specific
                       claim about their internal operations.

Allowed:  "Noticed you offer several treatments that all run on appointments."
Allowed:  "Most clinics handle those enquiries manually."
Allowed:  "Saw a few reviews mention it's hard to get through."   (in observedFacts)
Banned:   "Your receptionist is overwhelmed."                     (not observed)
Banned:   "You're probably missing 30% of enquiries."             (invented)
Banned:   "Your current system can't handle this."                (you have no idea)

If a guardrail is supplied for this industry, it overrides everything above. Follow
it exactly.`;
