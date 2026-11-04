# Live integrations: what exists, what is missing, what must be decided

**Date:** 2026-10-17. **Scope:** inspection and planning only. Nothing here was switched on, no provider was called, and no key was read.

**Bottom line:** neither OpenAI nor Google Places is wired into the acquisition engine, and neither should be pretended to be. The **shortest controlled pilot needs neither** (section 4). Each is a separate, gated piece of work with decisions that are not engineering's to make.

## 1. OpenAI: evidence-grounded analysis and pitch generation

### What exists (verified in the repo)

| Item | State |
|---|---|
| `src/lib/acquisition/llm.ts` `runStructured` | **Built and unit-tested, but has zero callers, so it is unreachable.** OpenAI-only. Uses structured outputs with a second Zod validation. Gives the model no tools. Wraps third-party content as untrusted data. Records tokens and an estimated cost on the run when given a `runId`. Fails closed with no key |
| Tests | 6 tests with a **mocked** client (no network): output validation, refusals, missing key, model selection, untrusted-content handling |
| Existing RUNVAX AI layer `src/lib/ai.ts` | A **different** system: multi-provider (OpenAI, Gemini, Groq) with **silent fallback to the other provider if a key is missing**. It must **not** be used for clinic data, because data could leave to a provider nobody chose. The acquisition wrapper is deliberately separate and OpenAI-only |
| Configuration | `OPENAI_API_KEY` is a name in the env files (I did not read its value). Model comes from `IA_MODEL_<AGENT>` or `IA_MODEL_DEFAULT`, default `gpt-4o-mini` |
| Cost estimate | A price table exists for `gpt-4o-mini` and `gpt-4o` only. Any other model gets **no estimate** |
| Activation | There is **no `llm` switch** in `ACTIVATION`, so nothing in code stops a future call path from reaching OpenAI |
| Budget | The platform-wide budget counts **calls, not tokens or dollars**, and has no `openai` provider |

### Work required (in order)

1. **Add an activation switch.** `ACTIVATION.llm = false` (code constant) plus `IA_LLM_ENABLED`, checked inside `runStructured` **before** the key check. Add a tripwire test like the existing ones, so a flip can't pass unnoticed.
2. **Enforce cost limits.**
   - Add an `openai` provider to the existing atomic `reserve()` with a small daily call cap (for example 50, hard maximum 200).
   - Cap input size and `max_tokens` per call.
   - **Fail closed for any model without a price entry**, so a spend cap is never unenforceable.
   - Show worst-case daily cost (cap × per-call maximum) in the UI.
   - Count the SDK's one automatic retry as a second call, since it is billed.
   - A true token ledger can wait.
3. **Define the grounding contract.**
   - Output schema: every sentence carries `basis` (`observed` or `inferred`) and `evidenceIds`.
   - The server must verify that every ID was among those provided, is an active signal or finding of this clinic, and that anything marked `observed` cites only observed signals. Any violation fails the attempt.
   - Facts sent to the model: clinic name, domain, and for each signal its code, value, basis, source URL and its already-masked quote (at most 300 characters).
   - **Never send** emails, phone numbers or named people.
4. **Keep the existing control chain.**
   - The model's text is stored as an ordinary `AcquisitionDraft` (marked `generator: llm`, with model, prompt version and run ID).
   - It then goes through the same delivery gate (unsupported claims, prohibited phrases, offer-level prohibited claims, length, opt-out line), then **human approval bound to the exact text, evidence and offer versions**.
   - The review screen must label it as model-written and show the evidence per sentence (the evidence table already exists).
5. **Error handling.** Timeouts, refusals and schema failures already become failed attempts with redacted errors. Decide explicitly whether a failure falls back to the deterministic template. Never fall back silently.
6. **Tests with a mocked client:**
   - an ungrounded claim is rejected;
   - injection via an evidence quote is neutralised;
   - an exhausted budget blocks the call;
   - the switch off blocks the call;
   - a network tripwire stays in place.
7. **Trigger.** A manual "write with AI" action on the clinic profile, not a queue agent and not a scheduler.

### Provider terms (checked 2026-10-17 against OpenAI's published pages)
- Data sent through the **API is not used for training by default.**
- API inputs and outputs are kept for **up to 30 days** for service delivery and abuse monitoring, then removed, unless law requires otherwise.
- **Zero data retention** is available to eligible customers by agreement; it is not automatic.
- **Not found:** a standard data-processing addendum in the pages I could reach. Confirm with OpenAI or counsel.
- Sources: [Enterprise privacy at OpenAI](https://openai.com/enterprise-privacy/), [Offering Zero Data Retention](https://openai.com/index/offering-zero-data-retention-for-frontier-models/).

### Decisions for the owner and counsel (not engineering)
- May clinic evidence (business facts, no personal contact data) go to OpenAI in the US? This is a cross-border transfer (LIA question Q-N9) and needs a privacy-notice update (Q-N5).
- Is the 30-day default retention acceptable, or is a zero-retention agreement required?
- Which model, and what daily call cap?

## 2. Google Places and lead discovery

### What exists: two separate things

| | Existing RUNVAX discovery | Acquisition engine's Places adapter |
|---|---|---|
| Code | `src/lib/google-places.ts`, used by `/api/search`, `/api/details` and `autoProspect` | `src/lib/acquisition/places/adapter.ts` |
| State | **Live** (key configured in the env files) | **Disabled.** No network transport exists. `searchPlaces()` throws before reserving any budget |
| Fields requested | Wide: name, address, **phone, website, rating, review count, location**, and on detail also **opening hours, editorial summary, reviews** | Minimal by design: `places.id, displayName, types, businessStatus` |
| What is stored | The results go into `Prospect.businessData` | Only `place_id` plus our own metadata |

### Can the existing discovery simply be reused for dental clinics?

**Not as it stands.**
- Reusing it would put Places phone numbers, websites, ratings, locations and reviews into the engine's records. That is **content beyond the place ID**, which the terms restrict caching. The engine's own design forbids it: its imports reject Maps-sourced rows, and signals may only come from independent sources.
- `docs/existing-places-data-assessment.md` already flags the **same issue in today's RUNVAX data**. It is separate from this work and not touched here.

### Work if the legal answers allow Places
1. Complete the seven open questions L1 to L7 in `docs/places-activation-dependencies.md` (the key ones: whether prospecting is a permitted use at all; whether a table of place IDs with our research attached becomes a "listing or directory"; whether a website first learned from Places may be fetched).
2. Build a transport using the minimal field mask, reusing the existing key, the existing daily budget (50 per Lagos day) and the place-ID-only ingestion rule.
3. Each clinic's website must come from a source independent of Places (L3), or be handed over in memory and never stored.
4. A reviewed code change to the activation constant, the env flag, and a separate approval for a live run.

**Cheapest compliant alternative:** an owner-supplied list from independent sources (the owner's own research, associations, referrals, the clinics' own sites), imported by CSV. This is what the engine does today.

### Provider terms (checked 2026-10-17 against Google's published pages)
- **Place IDs are exempt from caching limits** and may be stored indefinitely.
- **Latitude and longitude** may be cached for at most 30 consecutive days.
- The terms prohibit pre-fetching, indexing, storing or caching other Content except under the stated limited conditions (§3.2.3).
- **Not found:** anything on scraping specifically. The repo's own analysis of the full terms (dated 2026-10-14) is in `docs/places-activation-dependencies.md`.
- Sources: [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).

## 3. What is still missing in the acquisition workflow

| Gap | Status |
|---|---|
| Evidence entry took about 6 form submissions per clinic | **Fixed this sprint:** one checklist, one submission, one audit |
| "Why can't I generate a pitch?" only visible after clicking | **Fixed this sprint:** readiness checklist shown first, and it provably agrees with generation |
| Offer not approved, no price | Owner decision |
| Legal basis for outreach | Counsel (LIA Q-N1, Q-N2, Q-N4) |
| Sender identity and postal address | Needed for "ready"; deliberately deferred. A manual pilot does not need it |
| Any way to deliver a message | **None, by design.** Pilot delivery is manual, outside RUNVAX |
| Named contacts | Only via the API; no screen. Not needed for a role-inbox pilot |
| Post-contact qualification answers | Only as ≤500-character notes on reply or meeting outcomes |
| Live evidence capture | The crawler is off; evidence is entered by hand |
| Discovery, scheduler, AI | Not built; see sections 1 and 2 |

## 4. Shortest path to a controlled live pilot

A pilot of about 10 clinics that needs **no OpenAI and no Places**:

1. **Owner:** approve or rewrite the AI Receptionist offer (`docs/offer-ai-receptionist-proposal.md`), including whether any price or claim may be mentioned.
2. **Counsel:** the outreach opinion (Q-N2), plus a privacy-notice update (Q-N5).
3. **Ops (needs explicit approval):** apply the three additive migrations to production after a backup (`docs/database-migrations.md`); set `IA_SUPPRESSION_KEY` in the secret store; keep the admin allowlist; turn the flag on for the admin only.
4. **Keep `autoDraftEnabled` off** for the pilot admin. The isolation fix now protects against the overlap, but there is no reason to take the risk.
5. **Run it:** import 10 clinics from an independent list; enter evidence with the checklist; run the queue; generate; review and approve; mark ready; **send by hand, outside RUNVAX**; record every reply, opt-out and meeting as an outcome.
6. **Decide on evidence, not hope:** replies, opt-outs and meetings out of 10. Only then is it worth building the next piece (a small send adapter, the OpenAI step, or Places), in that order of likelihood of mattering.

## Discovery build (2026-10-19): both routes, Places still off
- **Route A (independent sources):** unchanged and live: CSV / manual import with an attested source; Maps/Places-sourced rows refused.
- **Route B (Places finder):** now built end to end and **switched off**. `searchPlaces()` runs one Text Search (minimal field mask, key in a header, daily budget reserved first, 429/403 pause the provider) only if `ACTIVATION.googlePlaces` (code constant, unchanged: `false`, guarded by `activation.test.ts`) **and** `IA_PLACES_ENABLED=true`. Results are used in memory and only `place_id` plus our metadata is stored (`AcquisitionCandidate`, existing table, no schema change).
- **The join:** a candidate has no name, website or phone, so it becomes a prospect only when an admin supplies those from an independent source, with two confirmations (lawfully obtained; not from Google Maps/Places). The importer's duplicate and branch rules apply, and the clinic keeps the place_id for later matching.
- **UI/API:** Discovery tab (gate state and reasons, today's budget, planned area x query searches, candidates, promote/exclude). `POST /api/acquisition/discovery/run` refuses with 409 while the gates are closed and queues nothing.
- **To switch Route B on** (not done, not approved): counsel answers L1 to L7 in `docs/places-activation-dependencies.md`, then a reviewed change of the constant, `IA_PLACES_ENABLED=true`, the existing Places key, and a separate approval of a live run.
