# Runvax — Outreach Engine v3: Pure-Backend Quality Upgrade (CORRECTED)

> This supersedes "Outreach Engine v2." It was rewritten against the **actual**
> codebase (`src/lib/ai.ts`, `src/app/api/outreach/route.ts`, `prisma/schema.prisma`),
> not an assumed one. Three things in v2 would have caused regressions; they are
> fixed here and flagged with **[FIX]**. Build *this* version, not v2.

---

## CRITICAL CONSTRAINT — READ FIRST

- DO NOT touch any UI component, page, or frontend file (`.tsx` / `.jsx`).
- DO NOT change any API request or response shape.
- DO NOT add any new UI, toggle, button, or visible feature.
- DO NOT run the Prisma migration or modify any endpoint without explicit written approval from Azeez.
- DO NOT install any npm package without flagging it first.
- DO NOT add a new environment variable without flagging it first.

This upgrade lives entirely in the backend generation layer. The only observable
change is that the messages Runvax generates become significantly better.
Everything the user sees, clicks, and interacts with stays identical.

When in doubt: if it touches a `.tsx` / `.jsx` / any component file → STOP and ask.

---

## WHAT CHANGED FROM v2 (why this version exists)

**[FIX 1] — Route through the existing provider layer, never raw OpenAI.**
The codebase already has `src/lib/ai.ts`: a deliberate abstraction that supports
**OpenAI + Gemini with automatic fallback** and per-feature provider routing
(`generate()`, `providerFor()`, `hasProvider()`, `extractJson()`). v2 hardcoded
`new OpenAI()` + `gpt-4o`, which would throw all of that away. v3 calls
`lib/ai`'s `generate()` and inherits provider flexibility + fallback for free.

**[FIX 2] — Output is multi-part, not a single `message` string.**
The real outreach endpoint returns `{ whatsapp, emailSubject, emailBody, framework }`.
A single `message` cannot feed that UI. v3's generation result carries a typed,
channel-aware `output` so Phase-2 wiring is genuinely drop-in. Single-message
intents (e.g. reply) still work — they just populate one field.

**[FIX 3] — Preserve and amplify existing message quality (the "10x" bar).**
v2 assumed the current prompt was "a flat string." It is not. `outreach/route.ts`
already encodes high-value assets: the *digital front door* positioning, the
review/social-proof angle, AIEO/GEO/SEO framing, strict WhatsApp `*bold*`/`_italic_`
formatting, objection-busting ✅ checklists, and sender-identity injection. These
live in **code, not** in `Runvax-Framework-Library.md`. They MUST be ported
into the new layer verbatim, then improved. The acceptance bar is: **every intent's
output must match or beat today's output** before we wire it in.

Plus: `prospectId` is now nullable (outreach often runs on unsaved search results),
and the test-runner question is resolved up front (§14).

---

## 0. THE "10x" QUALITY BAR (read before writing any prompt)

A "10x" message is not a longer message. It is one that:

1. **Proves you looked.** Opens with one ultra-specific, true detail about THIS
   business (real review count, the niche inferred correctly, the city, a named
   competitor with a site). Zero generic openers.
2. **Lands the right framework for the moment** — cold first touch ≠ objection
   reply ≠ proposal. The router picks; the model executes.
3. **Applies exactly one persuasion principle** using the prospect's real data —
   not a generic appeal.
4. **Is correctly localized** — currency symbol, price band, channel length,
   tone register, and one proactively-addressed local objection.
5. **Ends with exactly one CTA** — never stacked, never two questions.
6. **Casts the business owner as the hero**, you as the guide.
7. **Reads hand-written, never templated** — varied openers, structure, emoji.

Every layer below exists to guarantee one of these properties deterministically,
so the model can't "forget" them. The win over today's system is **consistency
under variation + measurability**, not a single flashy prompt.

---

## 1. FILE STRUCTURE TO CREATE

NEW files only. No existing file is modified in the build phase (Phase 1).

```
src/lib/outreach/
├── types.ts
├── assets.ts                 # [FIX 3] ported positioning/formatting/sender blocks
├── frameworks/
│   ├── registry.ts
│   ├── copywriting.ts
│   ├── structure.ts
│   ├── qualification.ts
│   ├── pitch.ts
│   ├── objection.ts
│   └── followup.ts
├── persuasion.ts
├── cta.ts
├── localization.ts
├── router.ts
├── composer.ts
├── quality-gate.ts
├── telemetry.ts
└── generate.ts
```

> Note the path is `src/lib/outreach/` (this repo nests everything under `src/`).
> Tests, if enabled (§14), go in `src/lib/outreach/__tests__/`.

Do NOT create any file outside `src/lib/outreach/` until Azeez gives explicit
go-ahead for endpoint wiring (Phase 2) or the Prisma migration.

---

## 2. PROVIDER INTEGRATION — MANDATORY [FIX 1]

`generate.ts` does **not** import the `openai` package and does **not** call
`new OpenAI()`. It imports the existing layer:

```ts
import { generate as aiGenerate, providerFor } from '@/lib/ai';
```

All model calls go through `aiGenerate({ system, prompt, temperature, maxTokens, feature })`.
This preserves OpenAI→Gemini fallback and per-feature provider routing.

- Pass `feature: 'outreach'` (or the relevant intent family) so existing
  `AI_PROVIDER_*` env overrides keep working.
- Do NOT hardcode a model id in the orchestrator. If a specific model is needed,
  pass it via the `model` option, but default to the layer's default.
- The Tier-2 quality critique (§9) also goes through `aiGenerate`, with a cheaper
  model passed explicitly — flag the model choice to Azeez, do not assume `gpt-4o-mini`.

If you believe a raw client call is unavoidable, STOP and ask.

---

## 3. TYPES (`src/lib/outreach/types.ts`)

```ts
export type Channel = "whatsapp" | "email" | "dm";
export type ProspectTemperature = "cold" | "warm" | "hot";
export type PipelineStage =
  | "found" | "contacted" | "interested" | "proposal" | "won" | "lost";

export type OutreachIntent =
  | "cold_first_touch"
  | "audit_outreach"
  | "reply_interested"
  | "reply_objection"
  | "proposal"
  | "weakness_report"
  | "presence_audit"
  | "followup"
  | "breakup";

export type FrameworkCategory =
  | "copywriting" | "structure" | "qualification"
  | "pitch" | "objection" | "followup";

export type PersuasionPrinciple =
  | "reciprocity" | "commitment" | "social_proof"
  | "authority" | "liking" | "scarcity" | "unity";

export type CtaLevel =
  | "micro" | "soft_call" | "direct_close" | "interest" | "two_option";

export interface Framework {
  id: string;
  name: string;
  category: FrameworkCategory;
  structure: string[];
  whenToUse: string;
  template: string;
  example?: string;
  bestChannels?: Channel[];
  bestTemperature?: ProspectTemperature[];
}

export interface ProspectContext {
  businessName: string;
  industry: string;
  city: string;
  country: string;            // ISO-ish key used by localization (NG, GH, US, ...)
  hasWebsite: boolean;
  socialOnly: boolean;
  leadScore: number;
  temperature: ProspectTemperature;
  stage: PipelineStage;
  channel: Channel;
  intent: OutreachIntent;
  objectionText?: string;
  rating?: number;
  reviewCount?: number;
  competitorWithSite?: string;
  followupStep?: 1 | 2 | 3;
  forceFrameworkId?: string;  // manual override — preserves existing UI picker
  prospectId?: string;        // [FIX] nullable: outreach runs on unsaved results
  userId?: string;
}

// [FIX 2] Channel-aware output so generate() can feed multi-part endpoints.
export interface OutreachOutput {
  whatsapp?: string;
  emailSubject?: string;
  emailBody?: string;
  dm?: string;
  message?: string;           // single-channel intents (e.g. reply) populate this
}

export interface GenerationMeta {
  frameworkId: string;
  secondaryFrameworkId?: string;
  persuasionPrinciple: PersuasionPrinciple;
  ctaLevel: CtaLevel;
  channel: Channel;
  intent: OutreachIntent;
  passedQualityGate: boolean;
  qualityNotes?: string[];
  priceBand?: string;
  provider: string;           // which provider lib/ai actually used
  model?: string;
}

// meta is additive and ignored by the existing frontend.
export interface GenerationResult {
  output: OutreachOutput;
  meta: GenerationMeta;
}
```

---

## 4. PORTED ASSETS (`src/lib/outreach/assets.ts`) — [FIX 3]

This file is the single source of the high-value content currently living inside
`src/app/api/outreach/route.ts`. Port it **verbatim first**, then we improve it.
Do not paraphrase on the first pass — copy the exact wording so we can diff
output against today's baseline.

Export named string builders:

```ts
export const POSITIONING: string;          // "digital front door" / experience centre block
export const DIGITAL_CONCEPTS: string;     // SEO / AIEO / GEO + "name concrete AI tools" rule
export const REVIEW_ANGLE: string;         // social-proof-from-reviews block
export function whatsappFormatting(): string;  // *bold* / _italic_ / short-paragraph / emoji rules
export function senderIdentity(profile): string; // from getEffectiveProfile()
export function checklistInstruction(industry: string): string; // ✅ objection-busting features
```

`composer.ts` pulls these in at fixed positions (§8). The registry holds framework
*structure*; `assets.ts` holds Runvax's *house style and positioning*. Keep
them separate but always composed together.

> Hard rule: the new system must keep these existing behaviours —
> - short business name only (strip text after `(`),
> - infer niche when category is generic ("Business"/"Establishment"),
> - write "digital front door (website)" exactly,
> - always name concrete AI tools "(like ChatGPT, Claude, Google AI)",
> - never "I hope this message finds you well" / "My name is X".

---

## 5. FRAMEWORK REGISTRY (`src/lib/outreach/frameworks/`)

Encode every framework from `Runvax-Framework-Library.md` Parts 1–6 as
`Framework` objects. Pull `structure`, `whenToUse`, `template`, `example`
directly from the library — do not invent content.

Required ids by category:

- **Copywriting (Part 1):** `pas, aida, aidca, bab, fab, four_ps, pastor, hso, sss, quest, acca`
  *(`four_us`, `four_cs` are checklists → encode in `quality-gate.ts`, not here.)*
- **Structure (Part 2):** `three_line, triple_c, trigger_value_ask, qvc, cgp, why_you_now`
- **Qualification (Part 3):** `spin, bant, champ, meddic, gap, neat`
- **Pitch (Part 4):** `storybrand, monroe, pixar, minto, proposal_spine, what_so_what`
- **Objection (Part 5):** `laer, feel_felt_found, laarc, arc`
  Plus a separate constant:
  ```ts
  export const OBJECTION_REFRAMES: Record<
    "has_social" | "too_expensive" | "referrals" | "no_time" | "other",
    string
  > = { /* exact reframes from Part 5 */ };
  ```
- **Follow-up (Part 6):** `value_add_nudge, three_touch, breakup, permission_to_close`

`registry.ts` exports only:
```ts
export function getFramework(id: string): Framework;
export function listFrameworks(category?: FrameworkCategory): Framework[];
```
The registry is the ONLY place framework content lives.

> Continuity: the existing UI picker uses `PAS | AIDA | BAB | STORY | SPIN | 4PS | HSO | FAB`.
> Map those onto registry ids (`STORY → hso` or a dedicated story framework, `4PS → four_ps`)
> via `forceFrameworkId` so the current picker keeps working unchanged in Phase 2.

---

## 6. ROUTER (`src/lib/outreach/router.ts`)

```ts
export function selectFrameworks(ctx: ProspectContext): {
  primary: Framework;
  secondary?: Framework;
  principle: PersuasionPrinciple;
  ctaLevel: CtaLevel;
};
```

If `ctx.forceFrameworkId` is set, use it as primary (preserving the manual picker)
and still auto-select principle + CTA.

Otherwise apply this deterministic table, in order:

| Intent | Condition | Primary | Secondary | Principle | CTA |
|---|---|---|---|---|---|
| cold_first_touch | whatsapp + !hasWebsite | three_line | pas | reciprocity | micro |
| cold_first_touch | email | aidca | cgp | authority | soft_call |
| audit_outreach | any | cgp | what_so_what | authority | micro |
| reply_interested | any | spin | — | commitment | soft_call |
| reply_objection | any | laer | feel_felt_found | liking | interest |
| proposal | any | storybrand | proposal_spine | social_proof | direct_close |
| weakness_report | any | what_so_what | fab | authority | soft_call |
| presence_audit | any | cgp | what_so_what | authority | micro |
| followup (step 1) | any | value_add_nudge | — | reciprocity | soft_call |
| followup (step 2) | any | value_add_nudge | sss | social_proof | interest |
| followup (step 3) | any | breakup | — | scarcity | two_option |
| breakup | any | breakup | — | scarcity | two_option |

For `reply_objection`: classify `ctx.objectionText` into
`has_social | too_expensive | referrals | no_time | other` and attach the matching
`OBJECTION_REFRAMES` string.

Pure function — no side effects, no I/O. (Tests per §14.)

---

## 7. PERSUASION / CTA / LOCALIZATION

### persuasion.ts
```ts
export function persuasionInstruction(principle: PersuasionPrinciple, ctx: ProspectContext): string;
```
One paragraph applying exactly ONE Cialdini principle using the prospect's real
data. Source the seven definitions from Part 7 of the library.

### cta.ts
```ts
export function ctaInstruction(level: CtaLevel, ctx: ProspectContext): string;
```
CTA Ladder (Part 8): `micro` → free mockup/audit · `soft_call` → 10-min call ·
`direct_close` → send proposal / start Monday · `interest` → priority-or-not ·
`two_option` → either/or where both paths move forward.
Must contain verbatim: **"End with EXACTLY ONE call to action. Do not stack
multiple CTAs. Do not ask two questions."**

### localization.ts — hard, non-bypassable
```ts
export function localizationInstruction(ctx: ProspectContext): { text: string; priceBand?: string };
```
Returns the instruction **and** the resolved `priceBand` (so telemetry can log it).

Currency + price bands by country + industry:

```
NG → ₦    salons ₦150k–250k | real estate ₦500k–1.5M | clinics ₦300k–800k
GH → GH₵  salons GH₵3k–6k   | real estate GH₵15k–40k
KE → KES  salons KES25k–60k | real estate KES120k–350k
ZA → R    salons R8k–18k    | real estate R40k–120k
US → $    salons $1.5k–4k   | real estate $5k–15k
UK → £    salons £1k–3k     | real estate £4k–12k
CA → C$   salons C$2k–5k    | real estate C$6k–18k
```
Extend for UG, TZ, RW, SN, CM with reasonable local bands.

Channel norms (hard rules):
- **WhatsApp:** ≤120 words, no subject line, warm/conversational, ≤2 emojis,
  end with a one-tap-answerable question.
- **Email:** subject line required, ≤200 words, slightly more formal, ≤3 short paragraphs.
- **DM:** ≤80 words, casual register, single-sentence hook.

Local objection awareness: "This prospect is in [country]. Common local objections
include: [inject country list]. If relevant, address ONE proactively — do not list
them all."

Tone register: NG/GH/KE/ZA → warm, respectful, direct, peer-to-peer (WhatsApp
primary). US/UK/CA → confident, concise, professional.

---

## 8. COMPOSER (`src/lib/outreach/composer.ts`) — [FIX 2 + FIX 3]

```ts
export function composePrompt(
  ctx: ProspectContext,
  selection: ReturnType<typeof selectFrameworks>,
  profile: SenderProfile,           // from getEffectiveProfile(), passed in
): { system: string; user: string };
```

Assemble the **system** prompt in this FIXED order — never reorder:

1. **Role block** — "You are an elite local-business sales specialist and
   copywriter operating in [city], [country]. You help web designers close deals
   with local SMBs. You know the local market, local pricing, and how local
   business owners think."
2. **Framework block** — "Use the [primary.name] framework. Structure:
   [numbered structure]. Template to adapt: [primary.template]" + if secondary:
   "Blend in elements of [secondary.name]: [secondary.structure]".
3. **Persuasion block** — `persuasionInstruction()`.
4. **Localization block** — `localizationInstruction().text`.
5. **CTA block** — `ctaInstruction()`.
6. **House-style block [FIX 3]** — `POSITIONING` + `DIGITAL_CONCEPTS` +
   `REVIEW_ANGLE` (when reviewCount present) + `senderIdentity(profile)`, and the
   channel-specific formatting: `whatsappFormatting()` for WhatsApp.
7. **Hard constraints block** (verbatim):
   > RULES YOU MUST FOLLOW:
   > - The business owner is the HERO. You are their guide. Never the star.
   > - Use ONLY the currency symbol for their country.
   > - Do NOT fabricate statistics, reviews, or results you don't have data for.
   > - Do NOT use placeholder text like [INSERT NAME] — use the real data provided.
   > - Do NOT mention competitor tool names (Apollo, ZoomInfo, etc).
   > - Use the short business name only (strip anything after "(").
   > - Write "digital front door (website)" exactly when you use that phrase.
   > - When you mention AI search, name concrete tools "(like ChatGPT, Claude, Google AI)".
   > - Channel: [channel]. Obey the word limit for this channel strictly.
8. **Quality self-check block** (verbatim):
   > Before writing, silently check against — 4 C's: Clear? Concise? Compelling?
   > Credible? · 4 U's: opener Useful? Urgent? Unique? Ultra-specific to THIS
   > business? · Hero check: is the owner the hero? If any check fails, rewrite.
9. **Output-contract block [FIX 2]** — tells the model exactly which delimited
   sections to return for this intent. For `cold_first_touch` (multi-channel):
   ```
   ---WHATSAPP---
   ...
   ---EMAIL-SUBJECT---
   ...
   ---EMAIL-BODY---
   ...
   ```
   For single-channel intents (reply, etc.), return a single message with no
   delimiters. The composer decides which contract to emit based on `ctx.intent`
   / `ctx.channel`, so the parser in `generate.ts` knows what to expect.

The **user** prompt is the prospect data as clean JSON (businessName, industry,
city, country, hasWebsite, socialOnly, leadScore, rating, reviewCount,
competitorWithSite, channel, intent, followupStep).

> The delimiter contract must match the existing `outreach/route.ts` markers
> (`---WHATSAPP--- / ---EMAIL-SUBJECT--- / ---EMAIL-BODY---`) so Phase-2 parsing
> is a drop-in.

---

## 9. QUALITY GATE (`src/lib/outreach/quality-gate.ts`)

```ts
export function runQualityGate(
  output: OutreachOutput,            // [FIX 2] channel-aware
  ctx: ProspectContext,
): { pass: boolean; notes: string[] };
```

**Tier 1 — deterministic (always runs, zero extra cost).** Run per populated
channel field:
- Exactly one `?` / CTA phrase (flag if zero or >2).
- Correct currency symbol for `ctx.country` if a price is mentioned.
- Channel word count (WhatsApp ≤120, Email body ≤200, DM ≤80).
- No unfilled placeholders: `/\[.+?\]/` — **but allow the sanctioned phrase
  "digital front door (website)"** (don't false-flag parentheses/brackets that
  are house style).
- No banned phrases: "I hope this finds you well", "As per my last",
  "I wanted to reach out", "Just following up", "Touching base", "Synergy",
  "Leverage", "Game-changer".
- No competitor tool names.

**Tier 2 — LLM self-critique (only if `QUALITY_GATE_LLM=true`).** [FLAG: new env var]
- One cheap-model call (model passed explicitly to `lib/ai`, flagged to Azeez)
  scoring the draft on 4 C's / 4 U's / hero / localization.
- If score < 7/10, regenerate ONCE with the critique appended. Never retry more
  than once.

Return `{ pass, notes }` into `meta`.

---

## 10. TELEMETRY (`src/lib/outreach/telemetry.ts`)

```ts
export async function logOutreachEvent(params: {
  prospectId?: string;               // [FIX] nullable
  userId?: string;
  result: GenerationResult;
  ctx: ProspectContext;
  priceBand?: string;
}): Promise<void>;
```

Fire-and-forget (never block or throw into the request path; wrap in try/catch).
Writes one `OutreachEvent` row (§11) per generation: frameworkId,
secondaryFrameworkId, persuasionPrinciple, ctaLevel, channel, intent, industry,
city, country, leadScore, priceBand, passedQualityGate, provider, model, createdAt.

When a prospect later moves to `won`/`lost`, existing pipeline logic *can* set
`outcome` on related rows — **do not implement that link now**; just ensure the
nullable `outcome` and `prospectId` exist so it's a non-breaking add later.

This is the real long-term edge: it answers *which framework × principle × CTA ×
market × industry converts best*. Build the write path now; analytics later.

---

## 11. PRISMA SCHEMA ADDITIONS

> DO NOT run this migration without Azeez's explicit go-ahead. Additive only;
> do not modify existing fields. Show Azeez the diff before `prisma migrate dev`.

```prisma
model OutreachEvent {
  id                   String    @id @default(cuid())
  prospectId           String?   // [FIX] nullable — outreach runs on unsaved results
  userId               String?
  frameworkId          String
  secondaryFrameworkId String?
  persuasionPrinciple  String
  ctaLevel             String
  channel              String
  intent               String
  industry             String
  city                 String
  country              String
  leadScore            Float
  priceBand            String?
  passedQualityGate    Boolean
  provider             String
  model                String?
  outcome              String?   // "won" | "lost" | null — filled later
  createdAt            DateTime  @default(now())

  @@index([userId, frameworkId])
  @@index([industry, country, outcome])
}
```

Optional additive fields on the existing `Conversation` model (it already has
`framework`, `replyType`, `channel` — only add what's missing):
```prisma
  secondaryFramework   String?
  persuasionPrinciple  String?
  ctaLevel             String?
  intent               String?
  passedQualityGate    Boolean?
```

---

## 12. ORCHESTRATOR (`src/lib/outreach/generate.ts`) — [FIX 1 + FIX 2]

```ts
import { generate as aiGenerate } from '@/lib/ai';

export async function generate(
  ctx: ProspectContext,
  profile: SenderProfile,
): Promise<GenerationResult>;
```

Steps:
1. `selection = selectFrameworks(ctx)`
2. `{ system, user } = composePrompt(ctx, selection, profile)`
3. `const res = await aiGenerate({ system, prompt: user, temperature: 0.9, maxTokens: 1100, feature: 'outreach' })`
   — **[FIX 1]** no raw OpenAI; inherits provider + fallback. (Temp 0.9/maxTokens
   1100 mirror today's outreach route so variation/length match the baseline.)
4. Parse `res.text` into `OutreachOutput` using the delimiter contract the
   composer chose (multi-part for outreach; single `message` otherwise). **[FIX 2]**
5. `qg = runQualityGate(output, ctx)` → if `!qg.pass && QUALITY_GATE_LLM` retry once.
6. `void logOutreachEvent({ prospectId: ctx.prospectId, userId: ctx.userId, result, ctx, priceBand })`
   — fire-and-forget.
7. Return `{ output, meta }` with `meta.provider = res.provider`.

This is the ONLY new production code that calls the AI layer. Existing endpoint
calls stay untouched until Phase 2 is approved.

---

## 13. ENDPOINT WIRING — PHASE 2 (DO NOT START WITHOUT GO-AHEAD)

Planning only. When approved, each route swaps inline prompt construction for a
`generate()` call. Because `OutreachOutput` is channel-aware, the existing
response shapes map cleanly:

| Route | Intent | Maps to response fields |
|---|---|---|
| `outreach` | `cold_first_touch` (pass `forceFrameworkId` from picker) | `{ whatsapp, emailSubject, emailBody, framework }` |
| `reply` | `reply_interested` / `reply_objection` | `{ message, replyType, channel }` |
| `proposal` | `proposal` | existing shape |
| `weakness` | `weakness_report` | existing shape |
| `audit` | `presence_audit` | existing shape |
| follow-ups | `followup` + `followupStep` | existing shape |

Each route keeps `checkAndIncrementAI(req)` for usage limits and
`getEffectiveProfile()` for sender identity — pass the profile into `generate()`.
Response shapes stay identical; only the additive `meta` is added (and ignored by
the frontend).

---

## 14. TEST RUNNER — RESOLVE FIRST [FLAG: packages]

There is currently **no test runner** (no jest/vitest, no `test` script). The
router and quality gate are pure functions and *should* be tested. Pick one before
Step 3 and flag it to Azeez:

- **(a) Add Vitest** (`vitest` devDependency + `"test": "vitest"` script) — needs
  package-install approval. Recommended; it's the lowest-friction TS test runner.
- **(b) Defer tests** — build the modules now, add tests when the runner lands.

Do not install anything without approval. If (b), still write the `router.test.ts`
file content so it's ready to run the moment a runner exists.

---

## 15. BUILD ORDER

Work strictly in sequence. After each step, show a summary and STOP for confirmation.

1. `types.ts`
2. `assets.ts` — port existing positioning/formatting/sender blocks **verbatim** [FIX 3]
3. `frameworks/` — six files + `registry.ts`
4. `router.ts` (+ `router.test.ts` content per §14)
5. `persuasion.ts`, `cta.ts`, `localization.ts`
6. `composer.ts`
7. `quality-gate.ts`
8. `telemetry.ts`
9. `generate.ts`
10. **SPIKE — required before declaring done.** Build a throwaway script (not an
    endpoint) that runs `generate()` for ONE `cold_first_touch` prospect and prints
    the output. **Diff it against today's `outreach/route.ts` output for the same
    business.** It must clearly match or beat it. Show Azeez both.
11. STOP. Report: "All modules built + the spike output beats baseline. Ready to
    (a) wire endpoints or (b) run the Prisma migration. Which first, or review anything?"

Do not proceed past Step 11 without explicit instruction.

---

## 16. HARD RULES FOR THE CODING AGENT

- NEVER touch a `.tsx`, `.jsx`, or any component file.
- NEVER call `new OpenAI()` or import `openai` in `lib/outreach/` — route through `@/lib/ai`. **[FIX 1]**
- NEVER collapse multi-channel output into a single `message` for outreach. **[FIX 2]**
- NEVER paraphrase the ported positioning/formatting on the first pass — copy verbatim, diff, then improve. **[FIX 3]**
- NEVER change an existing API route's request or response shape (Phase 1).
- NEVER run `prisma migrate` without Azeez saying "go ahead."
- NEVER modify an existing endpoint to call `generate()` until Phase 2 is approved.
- NEVER add a new env var (`QUALITY_GATE_LLM`) or npm package (test runner) without flagging it first.
- NEVER refactor code outside `src/lib/outreach/` (and its `__tests__/`).

---

## KICKOFF PROMPT

> Read both files in full: `Runvax-Framework-Library.md` and this corrected
> spec (v3). Your job is to build `src/lib/outreach/` exactly as specified — pure
> backend, no UI changes, no endpoint changes, no Prisma migration until I say go.
>
> Three things are non-negotiable: (1) all model calls go through `@/lib/ai`'s
> `generate()`, never raw OpenAI; (2) output is channel-aware (`OutreachOutput`),
> matching the real `{ whatsapp, emailSubject, emailBody }` shape; (3) the existing
> positioning, formatting, and sender-identity content from `outreach/route.ts`
> is ported verbatim into `assets.ts` before any improvement, and the final output
> must match or beat today's output (proven by the Step-10 spike).
>
> Start with your plan, then build `types.ts`. After each file, show me a summary
> and wait for my confirmation before continuing.
