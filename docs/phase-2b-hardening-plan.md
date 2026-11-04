# Phase 2b: hardening plan, product limitations and open dependencies

**Status (2026-10-14):** **P0-1…P0-9 implemented and verified locally** (`docs/phase-2b-p0-report.md`). P1 and P2 are not started.

These are fixes and safeguards to the existing research engine, not new agent functionality. They are local only:
- no live fetches, Places, DNS or providers;
- no production access, migration to production, push or deployment;
- the feature flag stays off.

**Invariants every item must keep:**
1. The observed / inferred / unknown evidence model is unchanged.
2. Scoring stays deterministic (`acq-score-v1`). Any change to scoring inputs would bump `scoreVersion` with a test. None of the items below changes the formula.
3. No existing RUNVAX file outside the acquisition module changes, apart from where an item says so explicitly.

## 1. Product limitations

### 1.1 No duplicate-merge tool

**Today:**
- **Strong keys** (place_id, website domain, phone) stop a duplicate from being created.
- **Weak matches** (same name and area) are flagged and routed to `needs_review`.
- **Branches** (same domain, different place IDs) are linked through `orgDomain`.
- **No merge or un-merge:** an admin can only *disqualify* the duplicate.
- **Branches without a place ID** can't be represented: a second CSV row with the same domain and no place ID is treated as a duplicate.

**Proposed: an admin "merge into" action** (P1-2)
- `POST /api/acquisition/prospects/{id}/actions` with `{ action: 'merge_into', targetId, reason }`.
- **Preconditions:** same industry; neither prospect terminal; the target isn't already merged.
- **Moves to the target:**
  - identities, keeping the target's on conflict
  - sources (dedupe by `contentHash`)
  - signals (dedupe by `code` + `contentHash`; then supersession runs)
  - contacts (dedupe by `contactKey`; duplicate flags recomputed)
- **Then:** the target is re-audited and re-scored with the same algorithm. The source prospect becomes `cancelled`, with an event "merged into …".
- **Audit and undo:** a new additive table `AcquisitionMerge` (`sourceId`, `targetId`, moved row IDs, actor, reason, `createdAt`) records each merge, so it can be **undone** within 30 days by moving the recorded rows back. This needs **migration 3**, additive, rehearsed the same way as migrations 1 and 2.
- **Also:** a "mark as branch of" action that links via `orgDomain` without merging, for branches that have no place ID.
- **Tests:**
  - row counts are conserved (nothing lost)
  - merging twice is a no-op
  - suppression and tombstones still apply after a merge
  - undo restores the exact previous state
  - the score after merging equals the score computed from the combined evidence
  - API authorisation matrix
- **Rollback:** revert the code; migration 3's `down.sql` (no production use).

### 1.2 Domain suffix list

**Today:** `registrableDomain()` uses a hard-coded list of 20 two-part suffixes (e.g. `com.ng`), otherwise the last two labels.

**Consequences:**
- **Hosting-platform tenants:** `a.netlify.app` and `b.netlify.app` are treated as the same site *and* the same organisation (F2). That gives false duplicate merges, and the fetcher would follow redirects between unrelated tenants.
- **IP-literal hosts** are compared by their last two octets (F1).
- **Unknown country suffixes** are treated as registrable domains.
- **Wix and Google Business sites** are already excluded via `domainFromUrl`.

**Proposed** (P0-5): use the **Public Suffix List** including its private section. Two options:

| Option | Pros | Cons |
|---|---|---|
| (a) `tldts` dependency, pinned | Maintained, ships the PSL, fast | New runtime dependency (needs approval, an audit, a compatibility check) |
| (b) Vendored PSL snapshot (data file + ~40-line lookup + an update script) | No dependency | Manual refresh cadence; MPL-2.0 attribution |

- **Tests:** a host table covering ccSLDs, platform tenants, IDN/punycode, IP literals and trailing dots; fetcher `sameSite`; identity keys; import dedupe on platform-hosted clinics.
- **Data:** domain identity values may change for platform-hosted sites, so add a local recompute script (no production data exists).
- **Rollback:** revert the code.

## 2. Prioritised implementation plan

| Pri | Item | Change | Tests (each must fail on the current code first) | Rollback |
|---|---|---|---|---|
| **P0-1** | F7 erasure completeness | Mask contact values inside quotes at extraction (`tel:080…[masked]`, `info@…[masked]`). On erasure, redact matching values in signals, findings and engine-created `Prospect.businessData` (only when `source='industry-acquisition'`) | After erasure, a scan of every acquisition table plus the engine-created prospect finds no erased value. Scores and `inputHash` are unchanged by masking | Revert |
| **P0-2** | F8 + F13 purge wiring | Run `purgeExpiredImports()` and `purgeExpiredPageCache()` at the start of every acquisition API request and every queue run | Expired previews and cache rows are gone after any API call; integration test on MySQL | Revert |
| **P0-3** | F14 keyed suppression hashes | HMAC-SHA-256 with `IA_SUPPRESSION_KEY` (server secret, documented backup). Matching checks HMAC first, then legacy SHA-256 during transition; new writes use HMAC only | Phone / email can't be found by plain SHA-256; legacy entries still match; rotation procedure test | Revert (legacy rows still match) |
| **P0-4** | F1 + F3 URL hardening | Reject IP-literal hosts, and redirect targets carrying credentials or using non-standard ports | Probe cases from the review become passing tests | Revert |
| **P0-5** | F2 suffix list | PSL as in §1.2 | §1.2 | Revert |
| **P0-6** | F6 linear extractor | Replace the lazy form regex with an `indexOf` scan; cap tag matches; per-page time budget | 1.5 MB hostile page in ≤500 ms; all extractor tests unchanged | Revert |
| **P0-7** | F4 + F17 timing | `Crawl-delay` > 10 s → home page only, rest deferred; deadline checked before every sleep and request | Fake-clock tests: a site never exceeds 35 s per task | Revert |
| **P0-8** | F9 + F10 authorisation | `isSuspended` DB check in `requireAcquisitionAccess()`; `Origin` check on POST/DELETE | Suspended admin → 403; cross-origin POST → 403; matrix test extended | Revert |
| **P0-9** | Fixture identity | Replace the `harzotech.com/crawler-policy` fixture string with an obviously fake domain, so no test implies the page exists | `crawlerIdentity` tests | Revert |
| **P1-1** | F5 per-domain politeness | DB lease per domain (`nextAllowedAt`), reserved atomically | Real-MySQL concurrency test: two branches are spaced ≥ the crawl delay | Revert |
| **P1-2** | Duplicate merge tool | §1.1 (migration 3, additive) | §1.1 | Revert + `down.sql` |
| **P1-3** | Retention job (provisional) | Dry-run report first: what *would* be deleted (named contacts past `retainUntil`, task / run logs > 90 days). Enforcement behind `IA_RETENTION_ENFORCE=true` (default off), pending the LIA | Dry run deletes nothing; enforcement deletes exactly the reported rows and writes `retention_expiry` markers | Flag off |
| **P1-4** | Existing-client exclusion | Admin can suppress a domain with reason `existing_client` (e.g. clinics already served by Harzotech, such as the dental group shown among the client logos on harzotech.com), so they're never researched or pitched | Import / research skip tests | Revert |
| **P1-5** | F12 page-cache minimisation | Store only the `<head>` metadata, links, forms, JSON-LD and the text needed by extractors | Extractor outputs identical on fixtures; cached size reduced | Revert |
| **P1-6** | F11 admin API limits | Per-admin rate limit on import and action routes | 429 test | Revert |
| **P2** | Existing-data remediation | `docs/existing-places-data-assessment.md` §5 (R0–R6): a separate project with its own approvals | Per phase | Per phase |

Every item ends with a full suite run:
- `npm ci`, `tsc`, `vitest` on Node 20, 22 and 24
- the integration suite on a disposable MySQL
- the migration rehearsal (if the schema changes)
- `next build`

Plus a check that the protected files (plan §14) are unchanged against `main`.

## 3. Unresolved legal and provider dependencies

| # | Dependency | Blocks | Owner | Reference |
|---|---|---|---|---|
| D-1 | **LIA review** (Q-N1…Q-N14), especially whether research and any later outreach can rely on legitimate interest given the GAID and *Onimisi v. GTCO* (2026) | Any live research; any outreach | Counsel / DPO | `docs/compliance/dental-pilot-lia.md` |
| D-2 | **Harzotech privacy-notice update** covering business research, sources, retention, objection | Live research | Harzotech + counsel | LIA Q-N5 |
| D-3 | **Crawler-policy page** published on harzotech.com; then `IA_CRAWLER_POLICY_URL` set | Crawler | Harzotech site owner | `docs/crawler-security-review.md` §1 |
| D-4 | Google Places L1–L7 (permitted use, directory restriction, URL storage, in-memory filtering, attribution, EEA vs non-EEA terms) | Places activation | Counsel / Google | `docs/places-activation-dependencies.md` |
| D-5 | Existing Places-derived data (C1–C10) | Remediation R1–R6; CRM-conflict check design | Counsel + product | `docs/existing-places-data-assessment.md` |
| D-6 | PageSpeed Insights: Google APIs terms on storing scores (Q7) | PSI activation | Counsel | `docs/source-retention-matrix.md` F |
| D-7 | Apollo / Snov terms, data-retention and onward-use conditions | Provider activation | Counsel | Matrix J |
| D-8 | Cross-border transfer (database apparently hosted in the UK; app on Vercel) | Live personal data | Counsel | LIA Q-N9 |
| D-9 | NDPC registration as a data controller of major importance; audit filing | Live processing | Counsel | LIA Q-N8 |
| D-10 | Backup retention for erased data | Erasure claims | Ops + counsel | LIA Q-N10 |
| D-11 | Vercel project Node version (≥ 20.19 / 22.12) | Any deploy | Ops | `docs/dependency-audit.md` |
| D-12 | Production schema check (read-only, per-step approval) | Any production migration | You | `docs/production-schema-verification.md` |

## 4. Before a live pilot could even be proposed

1. All P0 items done and verified.
2. D-1, D-2 and D-3 resolved.
3. D-8, D-9 and D-10 answered.
4. A written live-run plan (scope, caps, clinic count, data handling, stop conditions) for your approval.

Places (D-4) and providers (D-6, D-7) can stay disabled for a website-only pilot.
