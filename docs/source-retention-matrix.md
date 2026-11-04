# Source and retention matrix: Industry Acquisition Engine

**Status (2026-10-14): provisional.** Every retention rule here is subject to the LIA (`docs/compliance/dental-pilot-lia.md`) and to provider-terms review. **Storing a place ID, URL, score or derived signal does not by itself make the wider use permissible.**

Disabled providers: Google Places, PageSpeed Insights, Apollo, Snov. The website crawler and live DNS are also off. Their fields are listed so the policy exists before any activation.

**Notation:**
- **Active** = prospect not in a terminal state and not purged.
- **Purge** = full deletion of the prospect, by admin action or a retention job.
- ⚠️ = a known gap (see `docs/crawler-security-review.md`).
- **Q** = open legal or provider question.

## A. Transient: never stored

| Field | Source | Permitted use now | Stored? | Open questions |
|---|---|---|---|---|
| Places `displayName`, `types`, `businessStatus` | Google Places (disabled) | None while disabled. On activation: in-memory exclusion filtering only | ❌ | L4 (is in-memory filtering a permitted use?) |
| Places `websiteUri` | Google Places (disabled) | None while disabled. On activation: in-memory hand-off to the fetcher only | ❌ | L3 (fetching and then storing a site first learned from Places) |
| Places lat/lng, phone, address, rating, reviews, hours, photos | Google Places | **Not requested** (excluded from the field mask) | ❌ | — |
| Raw HTTP response headers | Clinic website | Redirect and content-type handling | ❌ | — |

## B. `AcquisitionCandidate` (Places discovery; no rows while disabled)

| Field | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| `placeId` | Google Places | Identity / dedupe key only | While the candidate exists; refresh per Places docs before reuse | Deleted with the candidate | **L1, L2:** is a place-ID table attached to our research a "listing/directory"? Storage alone isn't permission |
| `area`, `queryIndex`, `industryKey`, `status`, dates | **Ours** (the query we ran) | Bookkeeping | Same | Same | Must never be derived from Places coordinates (§3.2.3(c)(iv)) |

## C. `Prospect` rows created by the engine (`source='industry-acquisition'`)

| Field | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| `businessId` | Place ID (if imported) or `acq_<hash>` (ours) | CRM identity | While active | ⚠️ Not deleted by **erase contacts**; deleted on purge only if the prospect has no conversations | — |
| `businessName` | Import / manual entry | CRM display | While active | Purge | — |
| `businessData.{phone,email,website,address}` | Import / manual entry | CRM display | While active | Erasure removes erased phone/email from engine-created records (P0-1); linked pre-existing CRM records are not modified | Q-N4 |

## D. `AcquisitionProspect`

| Field | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| `state`, `area`, `fitScore`, `lastScoredAt`, `crmConflict` | Ours (derived from independent evidence) | Workflow, prioritisation | While active | Purge | Q-N14 (CRM-conflict check reads existing Places-derived CRM data) |
| `orgDomain` | Derived from the website (import, or clinic site) | Branch linking, suppression matching | While active | Purge | F2 (hosting-platform domains) |

## E. `AcquisitionSource`

| Field | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| `kind`, `method`, `httpStatus`, `robotsAllowed`, `fetchedAt` | Ours | Provenance; answering source requests | With the prospect | Purge | — |
| `url` | Clinic site URL (fetched) or the import's `source_url` | Provenance | With the prospect | Purge | L3 if the URL came from Places |
| `contentHash` | SHA-256 of the page HTML or import row | Idempotency | With the prospect | Purge | — |

## F. `AcquisitionSignal`

| Field | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| `code`, `value`, `basis`, `method`, `confidence` | Clinic website rules / import / industry config / PSI (disabled) | Evidence and scoring | Re-verify every 90 days; freshness 0.5 at 90–180 days; **stale (excluded) after 180**; kept while active | Purge | PSI scores: **Q7** (Google APIs terms on storage) — stored only as "unknown" today |
| `sourceUrl`, `observedAt`, `lastVerifiedAt`, `supersededAt` | Ours | Provenance | Same | Purge | — |
| `evidenceQuote` (≤300 chars) | Clinic website | Shown to the admin as evidence | Same | Phones and emails **masked at extraction**; erasure redacts any remaining match (P0-1) | Q-N13 (incidental personal / health text) |

## G. `AcquisitionFinding`, `AcquisitionScore`, `AcquisitionRecommendation`

| Field | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| Findings (`finding`, `evidence`, `impactHypothesis`, `validationQuestion`) | Derived from signals | Internal research | While active | Purge; ⚠️ `evidence` copies the quote (F7) | — |
| Scores (`total`, `band`, `coverage`, `contactability`, `breakdown`, `eligibility`) | Derived (deterministic, `acq-score-v1`) | Internal prioritisation; always shown as an estimate | Append-only history while active | Purge | Scores are never derived from Places content |
| Recommendations | Derived | Internal; "not approved for sale" | While active | Purge | — |

## H. `AcquisitionDecisionMaker` (contact points)

| Kind | Source | Permitted use | Retention | Deletion | Open questions |
|---|---|---|---|---|---|
| `role_inbox` | Clinic's own domain (site) / import | Future contact (separate approval) | While active; `lastVerifiedAt` refreshed on re-sight | Erase contacts → deleted + tombstone; purge | Q-N4 |
| `business_phone` | Clinic site (`tel:`, `wa.me`, text) / import | Same | Same | Same | Q-N4 (personal mobile) |
| `manual_named` (name, role, email, phone) | **Admin entry or import only**, with source + lawful basis + attestation | Same | `retainUntil` = +180 days (**provisional, not enforced**) | Same | Q-N1, Q-N2, Q-N7 |
| `mxValid` | DNS (disabled) | — | — | — | Live DNS approval |
| `sourceUrl`, `sourceNote`, `evidenceQuote` | Ours / site | Provenance | With the contact | Deleted with the contact | — |

## I. Operational tables

| Table / field | Contents | Retention | Deletion | Gap |
|---|---|---|---|---|
| `AcquisitionPageCache.html` | Raw HTML of fetched pages (may incidentally contain personal / health data) | ≤24 h | Purged on every authorised API request and queue run (P0-2); erasure purges the domain and pages containing a value | F12 (minimisation) open |
| `AcquisitionImportBatch.rows` | Parsed accepted rows, **including contact columns** | Until commit or 24 h | Cleared on commit; expired previews cleared on every API request and queue run (P0-2); erasure clears previews holding a value | — |
| `AcquisitionImportBatch.results` | Row outcomes and reasons (no raw values) | With the batch | — | — |
| `AcquisitionSuppression` | Kind + **keyed HMAC-SHA-256** of the value (+ plain domain) + reason (P0-3) | Indefinite (opt-out / objection / erasure); 180 days for `retention_expiry` | Not deletable from the UI (by design) | Key management: `docs/suppression-keys.md` (R5 lost-key risk) |
| `AcquisitionProviderUsage` | Counters | Indefinite (tiny) | — | — |
| `AcquisitionTask.input/output`, `AcquisitionAgentRun` | IDs, hashes, redacted errors, counts | 90 days (proposed; **not enforced**) | — | No retention job yet |
| `AcquisitionPipelineEvent` | State changes, actor, reason (no personal data by design) | With the prospect | Purge | Free-text reasons from admins could contain personal data (policy: don't) |

## J. Disabled providers: fields, if ever enabled

| Provider | Fields it could supply | Policy until terms are reviewed |
|---|---|---|
| Google Places | See A and B | Disabled; only `placeId` may ever be persisted (L1–L7 still unresolved) |
| PageSpeed Insights | Performance scores | Disabled; recorded as "unknown". Storage of scores pending Q7 |
| Apollo | Names, titles, emails, email status, LinkedIn URLs | Disabled; named data needs Q-N1/Q-N2 plus provider terms; email status is never "verified" |
| Snov | Same | Disabled; interface stub only |

## K. Existing RUNVAX tables

See `docs/existing-places-data-assessment.md`. They're not part of this matrix's policy. The acquisition engine doesn't read or write them, except for the read-only CRM-conflict check on `Prospect`.
