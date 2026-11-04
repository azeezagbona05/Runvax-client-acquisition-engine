# Google Places activation: technical and legal dependencies

**Status (2026-10-14): Places discovery is disabled.** This note sets out what must be clarified before it could be switched on. **Storing only `place_id` does not by itself make the overall use permissible**, so none of the questions below are assumed to be answered.

Terms read 2026-10-14:
- Maps Platform Terms, *last modified 2026-08-26*.
- Service Specific Terms (non-EEA), *last modified 2026-06-10*.
- Places API policies, *last updated 2026-10-08*.

This is engineering analysis, not legal advice.

## 1. How it is disabled now

| Layer | State |
|---|---|
| Code switch | `ACTIVATION.googlePlaces = false` (`src/lib/acquisition/activation.ts`); a test fails if it changes |
| Env switch | `IA_PLACES_ENABLED` must be `"true"` as well (unset) |
| Transport | **None exists.** `searchPlaces()` throws before reserving budget or making any request |
| Task | `acq.discover` finishes as `skipped: places_disabled`, so it isn't retried and reserves nothing |
| Routes / UI | No route or UI action enqueues discovery (boundary and API tests) |
| Budget | 50 requests per Lagos day, reserved atomically before each call; hard max 200 (ready, but unused) |
| Ingestion rule | `ingestPlacesResults()` stores only `place_id` plus our own metadata (tested with a full DB scan on real MySQL) |

## 2. Questions that must be answered before activation

| # | Question | Why it matters | Terms involved | Who |
|---|---|---|---|---|
| L1 | Is using Places Text Search to **build a B2B prospecting list** for our own sales a permitted use at all? | The terms restrict re-creating Google products and using the Core Services "in a listings or directory service". A prospect database could be read as one. | Maps Platform Terms §3.2.3(d)(iii); Acceptable Use Policy | Counsel / Google |
| L2 | Does keeping a table of `place_id`s **with our own research attached** amount to a "listing or directory" or to "creating content based on Google Maps Content"? | `place_id` storage is expressly allowed (Service Terms §A.3), but the purpose and the combination with our data may still be restricted. | §A.3; Maps Terms §3.2.3(c), (d)(iii) | Counsel |
| L3 | May we fetch a clinic's own website **when we only learned its URL from Places**, and then store that URL as observed from the site? | The URL first comes from `websiteUri` (Places content). Fetching the site makes it independently observed, but derived data isn't automatically exempt. | §3.2.3(a)(iii), (b), (c) | Counsel |
| L4 | May a business **name** seen in Places be used in memory only, to drop suppliers or labs (exclusion filtering)? | It's never stored, but it is still "use" of the content. | §3.2.3(a), (b) | Counsel |
| L5 | Does showing Places details **live** in the admin UI (not stored) need a Google Map, the Google logo, or review author attribution? | The policies require the Google logo without a map, and author attribution for reviews. | Places policies (attribution) | Engineering + counsel |
| L6 | Are we under the non-EEA or the EEA Service Specific Terms? | The billing-account address decides which terms apply. | Service Terms preamble | Account owner |
| L7 | Is the **NDPA 2023** position (legitimate interest for B2B research on clinics) documented in a completed LIA? | Needed for any personal data a later phase collects. | NDPA 2023 | Counsel / DPO |

## 3. Technical work that remains before activation

1. A Places transport with the minimal field mask `places.id,places.displayName,places.types,places.businessStatus`. No coordinates, contact, rating or review fields.
2. A cost check of that field mask against current Places pricing; show worst-case daily cost (cap × price) in the UI.
3. If L3 is approved: a per-task in-memory hand-off of `websiteUri` to the fetcher, which is never persisted. Re-fetch at use time if needed, counted against the cap.
4. If L5 is approved: live display with attribution.
5. The crawler identity URL (Q1) and live-fetch approval, since discovered clinics are only researched through their own websites.
6. A reviewed code change to set `ACTIVATION.googlePlaces = true`, plus the env flag, plus a separate approval for a live run.

## 4. What changes if the answers are "no"

Discovery stays on CSV and manual imports from independent sources. This is the current behaviour, and the rest of Phase 2 works unchanged.
