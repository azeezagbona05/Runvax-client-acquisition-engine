# Phase 2B: P0 hardening report

**Date:** 2026-10-14. **Branch:** `feat/industry-acquisition-phase1` (local only; not pushed or deployed).

**Scope:** P0 items from `docs/phase-2b-hardening-plan.md`. No P1/P2 work.

**What was not done:**
- live fetches, Places or provider calls, or DNS lookups for prospects;
- prospect contact or AI agents;
- production access;
- turning on the flag outside local test runs. It remains off by default and in every committed config.

**What this is not:** a legal approval, or a statement that a pilot would be lawful. That depends on the open items in the LIA and the dependency register.

## 1. Regression tests written first

`tests/acquisition/p0-hardening.test.ts` was written before any fix and run against the Phase 2 code. An empty placeholder module stood in for `maintenance.ts`, so imports resolved.

| Run | Result |
|---|---|
| **Before fixes** (`RUN_FULL_HOSTILE=0`) | **45 failed**, 10 passed, 9 skipped |
| **After fixes** | **69/69 passed**, including the 1.5 MB hostile inputs |

- **Every P0 item had at least one failing test before its fix.**
- **The 10 that passed pre-fix** are guards for behaviour that was already correct: one DNS resolution per hop; `.com.ng`, `.co.uk` and trailing-dot handling; ordinary hosts accepted; four already-linear hostile patterns.
- **The 9 skipped** were the 1.5 MB hostile inputs. The old email regex is quadratic (40 KB took 1.4 s), so 1.5 MB would effectively hang.
- **Added during the fixes, each confirmed to fail without its fix:** the tag-limit truncation test, and the phone identity key in the erasure scan (found by the real-MySQL test).

## 2. What changed, per item

| Item | Change | Evidence |
|---|---|---|
| **P0-1 erasure** | Extracted quotes are masked (`[email]`, `[phone]`), so evidence never duplicates a contact value. `eraseContacts` now also: redacts signal quotes and values, findings, source URLs and event reasons; deletes phone duplicate-detection keys equal to an erased number; removes erased values from the **engine-created** CRM record; clears unexpired previews holding a value; deletes cached pages containing one. A **pre-existing** CRM record the engine merely linked to is never modified (`crmRecordNotModified: true`, recorded in the event) | Unit scan of every acquisition table plus engine-created prospects. **Real-MySQL scan of every table for the account** found the phone identity key (`AcquisitionIdentity`, plain text), which the unit scan had missed; fixed and re-verified |
| **P0-2 cleanup** | New `runMaintenance()` (expired previews → rows cleared and marked `expired`; expired cached pages deleted). It runs on **every authorised acquisition API request** and at the **start and end of every queue run**. No cron and no production run | Tests for direct call, queue run and API request |
| **P0-3 keyed hashes** | Suppression values are stored as `hmac:<keyId>:<HMAC-SHA-256>`, keyed by `IA_SUPPRESSION_KEY` (≥32 characters; never in Git). Previous keys still match after rotation. Legacy unsalted rows match only with `IA_SUPPRESSION_LEGACY_MATCH=true`, and are upgraded on match (a duplicate is removed). **Fails closed:** without a valid key, writes throw, the API returns 503 and queue runs don't start. Documented in `docs/suppression-keys.md` | Unit, real-MySQL (unique-key upgrade) and runtime smoke tests (503 without key) |
| **P0-4 URLs / redirects / credentials** | Shared `assertFetchableUrl()` for the start URL **and every redirect hop**, checked **before any DNS lookup**: http/https only, ports 80/443, no credentials, no IP literals (any notation), hostname under a real public suffix, no special-use names (`.local`, `.internal`, `.test`, …). New page status `invalid_redirect`. `pinnedLookup()` (the socket uses the checked address, with no DNS) and `requestHeaders()` (only User-Agent, Accept, Accept-Encoding) are exported and tested | Tests incl. a rebinding fixture (second answer private → refused before connecting) and a pinned-lookup test with a DNS spy |
| **P0-5 Public Suffix List** | `registrableDomain()` uses **tldts 7.4.16** with the PSL private section. Plus a documented 6-entry supplement for site builders the PSL doesn't list (`wordpress.com`, `wpcomstaging.com`, `weebly.com`, `squarespace.com`, `godaddysites.com`, `business.site`; verified against tldts). IP literals are never "same site" | 10 host cases; tenants of one platform are distinct sites and identities |
| **P0-6 linear scanner** | New `web/html.ts` tokenizer: one forward pass, a cached next-`>`, bounded tags (4 KB), raw-text elements skipped via `indexOf`, a 20,000-tag cap. `extract.ts` and `toPlainText` use it. Emails are found per token, not by a regex over the whole text. **A page cut at the tag cap counts as not fully readable**, so absences become `unknown` | 10 hostile patterns at 200 KB (<250 ms) and 1.5 MB (<1 s), incl. unclosed forms, scripts and comments, runs without `>` or `@`, letter and digit runs. Measured before: quadratic (e.g. comments 40 KB = 154 ms, letter run 40 KB = 1,445 ms) |
| **P0-7 time limits** | `Crawl-delay` > 10 s → home page only (`limited: 'crawl_delay_exceeds_limit'`), never a long sleep. Hard **30 s site budget including waits**: a request or wait starts only if it can finish inside the budget (`limited: 'site_time_budget'`); the 45 s task timeout stays above it | Fake-clock tests: 60 s Crawl-delay; 8 s-per-response site stays ≤30 s |
| **P0-8 suspension / origin** | `requireAcquisitionAccess(req)`: suspended or missing account → **403** even with a valid session. Mutations need `Origin` equal to the app origin (or `Sec-Fetch-Site: same-origin`), otherwise 403. The `/acquisition` layout uses `acquisitionPageAllowed()` (flag + admin + active account). The route scanner test requires every POST/DELETE handler to pass `req` | Unit tests; runtime smoke test: suspended admin with a live session → API 403, page 404; foreign / missing origin → 403 |
| **P0-9 crawler URL** | The fixture policy URL is now an obviously fictional `crawler-policy.fixture-only-not-real.com`. A test fails if any test or fixture references `harzotech.com/crawler-policy`. The crawler identity must use a host under a real public suffix. **The crawler stays disabled** (env + `ACTIVATION.liveWebFetch=false`) | Tests |

## 3. Files

**New:**
- `src/lib/acquisition/maintenance.ts`
- `src/lib/acquisition/web/html.ts`
- `tests/acquisition/p0-hardening.test.ts`
- `tests/integration/p0.test.ts`
- `docs/suppression-keys.md`, `docs/phase-2b-p0-report.md`

**Modified, source:**
- `src/lib/acquisition/{contacts,flag,suppression,untrusted}.ts`
- `src/lib/acquisition/tasks/queue.ts`
- `src/lib/acquisition/web/{extract,fetcher,url}.ts`
- `src/app/acquisition/layout.tsx`
- 7 mutation routes under `src/app/api/acquisition/` (now pass `req` to the gate)

**Modified, tests:**
- `tests/setup.ts`, `tests/integration/setup.ts` (test-only key)
- `tests/helpers/{fakePrisma,fakeWeb}.ts` (unique keys enforced in `updateMany`; latency option; fictional policy URL)
- `tests/acquisition/{access,api,infra}.test.ts`

**Modified, config / docs:**
- `package.json`, `package-lock.json`, `.env.example`
- docs status updates (security review, hardening plan, matrix, LIA, audit)

**Untouched:** every protected path (plan §14). P0 made no change to `prisma/`, middleware, WhatsApp, the task queue, AI, outreach, email, Places, auth, billing or `vercel.json`.

## 4. Dependencies

| Package | Version | Licence | Notes |
|---|---|---|---|
| `tldts` | 7.4.16 (exact) | MIT | Ships the Public Suffix List; single dependency `tldts-core`; no Node engine constraint. 7.4.18 is the latest but was 7 days old, so a ≥2-week-old release was chosen. It was already present transitively (dev) via jsdom → tough-cookie; now a direct runtime dependency |
| `tldts-core` | 7.4.16 (exact) | MIT | No dependencies |

- **Lockfile:** only those two entries changed (to the pinned versions); nothing added or removed.
- **`npm audit`:** unchanged at 23 total / 13 production; both packages clean.
- **Install:** `npm ci` clean, no engine warnings.

## 5. Migrations

**None needed.** `valueHash` (`VARCHAR(191)`) holds `hmac:<id>:<64 hex>` (≤89 characters). The full migration rehearsal (baseline, 1 + 2, rollback of 2 then 1, re-apply) was run again on a disposable MySQL 9.4.0: **all checks passed**.

## 6. Verification

| Check | Result |
|---|---|
| `npm ci` | ✅ (0 engine warnings) |
| `tsc --noEmit` | ✅ |
| Unit / component suite | **446/446** on Node 20.20, 22.23 and 24.6 |
| Integration suite (real disposable MySQL) | **6/6** (Phase 2 + P0) |
| `next build` | ✅ on Node 20, 22 and 24; all acquisition pages and routes dynamic |
| Migration rehearsal | ✅ all steps |
| Runtime smoke (local build, synthetic admin) | Same-origin 200; foreign / no origin 403; suspended admin with live session 403 (API) / 404 (page); no key 503 |
| `npm audit` | Unchanged; new packages clean |
| Secrets | No key in Git or env files; key never appears in errors or stored rows (tested); test key is test-only |

## 7. Residual risks and unresolved items

| # | Item | Notes |
|---|---|---|
| R1 | **Legal / privacy dependencies unchanged** | The LIA is still a draft; D-1…D-12 remain open. P0 makes the system safer; it doesn't make a pilot lawful |
| R2 | Erasure and suppression are **per admin account** | Another admin's research of the same clinic is untouched by one admin's erasure. Today's use is single-admin; a module-wide erasure is a P1 design question |
| R3 | Phone duplicate-detection keys are stored in **plain text** while a prospect is active | Erasure deletes them; keying them (HMAC) is a P1 option |
| R4 | Old unsalted suppression rows (local DBs only) stay unsalted until matched during a migration window | Production has none; delete leftovers at the end of the window |
| R5 | **Lost key = lost matching** for email/phone tombstones | Mitigated by escrow (`docs/suppression-keys.md`); old keys must be kept as long as their rows exist |
| R6 | PSL coverage depends on tldts updates; the site-builder supplement is manual | Review on every tldts update |
| R7 | The live transport (pinned socket, TLS) is exercised only through unit-tested pieces, never against a real site | By design (no live access). It would be verified in an approved live test |
| R8 | The origin rule refuses non-browser clients on mutation routes | Intended; scripted admin use would need a deliberate exemption |
| R9 | The scanner is a signal extractor, not a full HTML parser | Unusual markup may be read differently; truncated pages produce `unknown` rather than false absences |
| R10 | The fake Prisma used by unit tests isn't MySQL | Mitigated by the real-MySQL integration suite, which caught R3's underlying gap |
| R11 | Crawler-policy page not published; privacy notice not updated | Crawler stays disabled (D-2, D-3) |

**Unresolved P0 items: none.** All nine are implemented and verified locally.

## 8. Rollback

Nothing is merged or deployed:
- revert the P0 commit(s) on the branch;
- remove `tldts` / `tldts-core` from `package.json` and the lockfile.

There is no schema change to undo. If keyed hashes were ever written to a shared database, rolling back the code would stop them matching. So **don't roll back code without also restoring the previous hashing (or keeping the module disabled)**. Today no shared database holds any.
