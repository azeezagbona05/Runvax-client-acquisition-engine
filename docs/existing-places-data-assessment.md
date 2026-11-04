# Assessment and remediation plan: Google-derived data in existing RUNVAX features

**Status: final draft for review (2026-10-14). Nothing has been deleted, rewritten, migrated or changed**, and no schema change is proposed for this phase.

- **Code reviewed:** `feat/industry-acquisition-phase1`; the existing code is identical to `main` (`3fbf2c0`).
- **Terms:** as quoted in `docs/places-activation-dependencies.md`.
- **Nature:** engineering analysis, not legal advice. Each remediation phase needs separate approval.

## 1. Relevant terms (summary)

| Allowed | Not allowed |
|---|---|
| `place_id` stored (Service Specific Terms §A.3) | Caching other Google Maps Content (Maps Terms §3.2.3(b)) |
| Latitude/longitude cached for up to 30 consecutive days (§14.3) | "Copy and save business names, addresses, or user reviews" (§3.2.3(a)(iii)) |
| Displaying Places data, with the Google logo when there's no map, and review author attribution (Places policies) | "Create content based on Google Maps Content" (§3.2.3(c)); use in a "listings or directory service" (§3.2.3(d)(iii)) |

## 2. Inventory: data, writers, readers, retention

Field masks are in `src/lib/google-places.ts`:
- **Text Search:** id, displayName, formattedAddress, phones, websiteUri, rating, userRatingCount, primaryTypeDisplayName, location, businessStatus.
- **Details adds:** currentOpeningHours, editorialSummary, types, reviews.

| Store | Google-derived fields | Written by | Read by | Retention today |
|---|---|---|---|---|
| `CachedBusiness` | name, category, address, city, phone, website, hasWebsite, rating, reviewCount, description, openingHours, categoryTypes, reviews, competitors (+ `placeId`) | `api/search` (upsert per result), `api/details` (rich fields) | `api/search`, `api/details` (drawer), `api/emails`, `api/pagespeed`, `api/prospects/[id]` (outcome counters), `cron/lead-triggers`, `api/public-stats` → `/pricing` page | Lazy delete at 90 days since last seen; details refreshed after 7 days |
| `CachedBusiness` (non-Google columns) | `discoveredEmails` (crawl), `psi*` (PageSpeed), `timesSearched/Contacted/Converted`, `totalDealValue` | Same routes | Same | Same row |
| `SearchCache.results` | Full mapped Text Search results, including location | `api/search` | `api/search` (cache hit) | Lazy delete at 7 days |
| `BusinessSnapshot` | rating, reviewCount, hasWebsite per day (+ `placeId`) | `api/search` | `cron/lead-triggers` | Lazy delete at 90 days |
| `LeadTrigger` | businessName, category, city, plus **derived** type/detail/strength (+ `placeId`) | `cron/lead-triggers` | `api/triggers` (no UI consumer found in the codebase) | Deleted after the trigger window |
| `Prospect.businessName` + `businessData` | The whole Business object from search: name, address, phones, website, rating, reviews, competitors, **location** | `api/prospects` (save from UI), `lib/autoProspect` (cron / campaigns), `api/apollo/decision-maker` (adds a name) | See §3 | **None** (until the user deletes it) |
| `DemoSite.data` | name, category, address, phones, rating, review count | `api/demo` (from the drawer) | Public `/demo/[slug]` pages | None |
| Browser `sessionStorage` (`aip_search_state`) | Search results | `src/app/page.tsx` | Same page (restore on back) | Browser session |
| User exports | CSV/XLSX/PDF of search results (`src/app/page.tsx`); CSV of pipeline (`src/app/pipeline/page.tsx`); `lib/export.ts` appears unused | Browser | The user | Outside our control |

`place_id`-only uses are fine as they are: `Prospect.businessId`, `OutreachSignal.businessId`, `DemoSite.businessId`.

## 3. Downstream dependencies (what breaks if a field disappears)

| Feature | Depends on | Fields used |
|---|---|---|
| Find Prospects search (cache hits, cheaper repeat searches) | `SearchCache`, `CachedBusiness` | All search fields |
| Business drawer (details, reviews, hours, competitors) | `CachedBusiness` via `api/details` | Rich fields |
| Email discovery (`api/emails`) and PageSpeed (`api/pagespeed`) | `CachedBusiness` row as a holder for **non-Google** results | `website`, `placeId` |
| Lead triggers (new business, review surge, rating drop, website gained/lost) | `BusinessSnapshot` history, `CachedBusiness` segments, `LeadTrigger` | rating, reviewCount, hasWebsite, name, category, city |
| Public social-proof stats (`/pricing`) | `CachedBusiness` counts and countries | Row existence, `country` |
| CRM / pipeline UI, `ProspectsContext` | `Prospect.businessData` | Name, address, phone, website, rating |
| Ava opportunity detection (`tasks/handlers` → `opportunity/detect`) | `businessData` | hasWebsite, rating, reviewCount, reviews, hours, category |
| Rex outreach composer (`outreach/compose`) and the **WhatsApp** flows | `businessData` | Name, category, phone, rating, reviews |
| Command Centre drafts, Atlas briefs, dashboard summary, admin analytics, follow-up sequences | `businessData` | Name, category, phone, website |
| Apollo decision-maker lookup | `businessData.website` | Website domain |
| Demo sites | `DemoSite.data` | Name, address, phones, rating |
| **Acquisition engine: CRM-conflict check** (`src/lib/acquisition/identity.ts → buildCrmIndex`) | `Prospect.businessId`, `businessName`, `businessData.website`, `businessData.phone`, `outreachSentAt` | Read in memory only, never copied (only the matching prospect id is stored). Still a *use* of stored Places content (LIA Q-N14) |
| Acquisition engine: everything else | — | Does **not** read or write any table above |

## 4. Potential conflicts

| # | Data | Potential conflict | Engineering severity |
|---|---|---|---|
| C1 | `CachedBusiness` Places fields | Caching beyond §A.3/§14.3; "copy and save names, addresses, reviews". The comment calling the 90-day cleanup "ToS compliance" isn't supported by the current terms | High |
| C2 | `CachedBusiness` as a cross-user "intelligence database" and source of public stats | "Create content based on" (§3.2.3(c)); directory-like use (§3.2.3(d)) | High |
| C3 | `SearchCache.results` | Caching full results for 7 days (coordinates alone would be fine for ≤30 days) | Medium |
| C4 | `BusinessSnapshot` + `LeadTrigger` | History of Places content plus derived triggers | Medium–High |
| C5 | `Prospect.businessData` / `businessName` | Indefinite storage, including coordinates beyond 30 days | High (largest, user-facing) |
| C6 | `DemoSite.data` → public pages | Republication without attribution | High (public) |
| C7 | Drawer reviews and summaries | Attribution / logo requirements | Medium |
| C8 | Exports (CSV/XLSX/PDF) | Content leaves the service (§3.2.3(a)) | Medium |
| C9 | `sessionStorage` search state | Client-side caching (small; per session) | Low |
| C10 | Acquisition CRM-conflict check | Reads stored Places content (C5) for matching | Low–Medium (depends on C5's outcome) |

## 5. Phased remediation: preserving unrelated functionality

Each phase is separately approvable and testable, and each can be rolled back on its own. Phases R1–R3 change **no existing records and no schema**. Data cleanup comes only in R5, with a backup and a rehearsal.

| Phase | Change | Keeps working | Tests | Rollback |
|---|---|---|---|---|
| **R0: confirm** | Counsel confirms C1–C10 and the target state; decide on any Google account review | Everything | — | — |
| **R1: stop new over-retention** (behind flag `PLACES_RETENTION_V2`, default off) | Search/details stop writing Places fields to `CachedBusiness` and `SearchCache` (keep `placeId`, PSI, crawled emails, outcome counters; coordinates ≤30 days). New saves of prospects keep `place_id` + user-entered fields. `api/demo` copies only user-entered fields | Search (live, uncached), drawer (live fetch), email discovery, PSI, CRM, WhatsApp, Ava/Rex (they receive a live-hydrated Business object, see R2) | Characterisation tests of search, drawer, CRM save, WhatsApp link building, opportunity detection, before and after, with the flag on and off | Turn the flag off |
| **R2: hydrate at display / use time** | A `getBusinessForDisplay(placeId)` service fetches Places details live (with a daily cap like `budget.ts`, short in-request memo only), with attribution and the Google logo in the UI. Ava, Rex, briefs and the dashboard receive hydrated objects | All of the above; cost rises, bounded by the cap | Cap and concurrency tests; UI attribution tests; outreach composer fixture tests | Flag off |
| **R3: provenance on `businessData`** | New writes tag fields `{source: 'places' \| 'user' \| 'website' \| 'import'}`; user-edited values are kept as `user` | CRM editing | Unit tests for merge-by-provenance | Code revert (old rows untouched) |
| **R4: features that need history** | Lead triggers and public stats are redesigned on permitted data (e.g. triggers from our own observations, stats from counts of our own searches) or retired | — | New tests | Re-enable the old cron (data still there until R5) |
| **R5: data cleanup** (explicit approval; backup; schema-only rehearsal with synthetic rows) | Strip Places-only fields from existing rows in `CachedBusiness`, `SearchCache`, `BusinessSnapshot`, `LeadTrigger`, `Prospect.businessData`, `DemoSite.data`; keep `place_id`, non-Google and `user`-tagged values | All features, now on R1–R4 | Row-count and field-presence checks before and after; app smoke tests | Restore from backup (the only rollback for R5) |
| **R6: exports and client storage** | Exports include only user-entered and provenance-verified fields; `sessionStorage` holds IDs only | Export features (reduced columns) | UI tests | Code revert |

**The acquisition CRM-conflict check (C10)** can switch to a place-ID + user-field-only index once R3 exists. Until then it stays read-only and in memory, and is flagged in the LIA.

## 6. Not touched in this phase

All the stores and features above. No reads beyond the existing CRM-conflict check, no writes, no schema change, no migration, no deployment.
