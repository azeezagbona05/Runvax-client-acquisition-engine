# Phase 2 plan: prospect intelligence (dental clinics, Lagos), revision 2

**Status (2026-10-14): steps 2.0–2.6 implemented locally on `feat/industry-acquisition-phase1`. The synthetic run (2.7) is complete. Live access is not approved. Places is disabled.** This revision applies your decisions D1–D7 and the current Google Maps Platform terms.

**What Phase 2 produces:** evidence-backed prospect records and internal recommendations.

**What Phase 2 does not do, at any point:**
- send email or WhatsApp
- contact a prospect
- draft outreach or run follow-ups
- call an AI model
- export contact data
- run a cron
- access live data without separate approval (D7)
- touch production

---

## 0. What changed since revision 1, and why

| Area | Revision 1 | Revision 2 | Reason |
|---|---|---|---|
| Google Places content | Store as signals with a 90-day expiry | **Store only `place_id`.** Everything else is used in memory, or shown live with Google attribution, and never persisted. Places-derived signals don't feed the stored score. | Google Maps Platform terms (§1) |
| Places client | Reuse `lib/google-places.ts` | New acquisition adapter with a minimal field mask | The existing client requests more fields (more cost, more content we may not keep) and its mask can't be changed without editing it |
| `CachedBusiness`, `LeadTrigger` | Read for signals | **Not used** | They hold or derive from cached Places content (§1.3) |
| Prospect creation | At discovery | **Only after an independent source** (the clinic's own website, CSV, manual entry). A Places-only discovery stays a place-ID-only *candidate*. | `Prospect.businessName` is required, and a name copied from Places can't be saved |
| Decision-maker names | Deterministic patterns + optional AI | **No automatic extraction of personal names.** No AI. Names come only from manual admin entry with a source. | D2 |
| AI calls in Phase 2 | Optional | **None** (a test enforces zero model calls) | D2; nothing else in Phase 2 needs a model |
| Crawler identity | `RunvaxResearchBot` + suggested URL | The fetcher **won't run** until a genuine policy or contact URL is configured | D1 |
| Retention | Blanket figures | Per-source, per-field matrix (§2); 180-day contact rule proposed separately; tombstones stop deleted data coming back | D3 |
| Places cap | 50/day | 50/day hard cap, reserved atomically **before** every call (retries and concurrent runs included), plus per-run and per-task limits | D4 |
| Live mini-run | Optional in 2.7 | Synthetic run only; live access needs separate approval | D7 |

---

## 1. Google Places terms as they apply here

These are the current terms I read on 2026-10-14. They're quoted for engineering purposes, not as legal advice (see Q2, §15).

### 1.1 What the terms say

- **Places API policies** (developers.google.com, *last updated 2026-10-08*):
  - "You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions."
  - "You can therefore store place ID values indefinitely."
  - "You must always credit the author when displaying photos or reviews."
  - "When displaying Places API data without a Google Map, you must include the Google logo."
- **Service Specific Terms** (*last modified 2026-06-10*, non-EEA):
  - §A.3: "Customer may cache (a) place_id from Places API…"
  - §14.3: "Customer may temporarily cache latitude and longitude values from the Places API for up to 30 consecutive calendar days, after which Customer must delete [them]."
- **Maps Platform Terms** (*last modified 2026-08-26*), §3.2.3:
  - (a)(iii): "Customer will not… copy and save business names, addresses, or user reviews."
  - (b): "Customer will not cache Google Maps Content except as expressly permitted under the Maps Service Specific Terms."
  - (c): "Customer will not create content based on Google Maps Content", including (iv) using Places latitude/longitude "as an input for point-in-polygon analysis" and (vii) using it "to improve machine learning and artificial intelligence models."
  - (d)(iii): "…will not use the Google Maps Core Services in a listings or directory service…"

### 1.2 Engineering rules that follow

1. **Persist only `place_id`** from Places, together with *our own* metadata about it: when it was discovered, which query and area *we* searched, and our status for it.
2. All other Places fields are requested only for the duration of one task, held in memory, and dropped: name, address, phone, `websiteUri`, rating, review count, hours, business status, types, reviews, photos.
3. **Derived data isn't treated as exempt.** Signals computed from Places content (e.g. "high review volume") are **not stored** and **not used in the persisted score**. They can be shown live in the UI, fetched on demand against the cap, with Google attribution.
4. Latitude and longitude aren't requested at all. Area comes from the query we ran ("dentist in Lekki"), never from point-in-polygon on Places coordinates.
5. Transient uses of Places data:
   - **Exclusion filtering:** dropping suppliers, labs and closed businesses by name keyword, type or status.
   - **Finding the clinic's own website**, which is then fetched and becomes the independent source.
6. ⚠️ **Open legal question (Q2):** storing the clinic's website URL after it was first learned from Places. Proposed treatment: store it only after we've fetched the site ourselves, recording the *final* URL and its canonical URL as observed from the site. Even so, the "listings or directory service" restriction in §3.2.3(d)(iii) needs review before any live run.

### 1.3 Existing RUNVAX behaviour (out of Phase 2 scope; reported, not changed)

Several existing tables appear to store Places content beyond what the current terms permit:
- `CachedBusiness`: names, addresses, phones, ratings, reviews; 90-day cleanup.
- `SearchCache`: raw results, 7 days.
- `BusinessSnapshot`: rating and review counts, 90 days.
- `LeadTrigger`: business names and derived triggers.
- `Prospect.businessData`: Places fields, no expiry.

The code comment calling the 90-day cleanup "Google Places ToS compliance" isn't supported by the terms quoted above. **This needs a separate decision** (Q3). Phase 2 neither changes nor relies on any of it.

---

## 2. Retention matrix: by source and field

Every stored fact records its source, method, `observedAt` and confidence. "Prospect active" means the state isn't terminal and the record hasn't been purged.

| Source | Field / data | Stored? | Retention | Basis / notes |
|---|---|---|---|---|
| **Google Places API** | `place_id` | ✅ | Indefinite while it's a candidate or prospect. Refreshed per the Places docs before reuse; deleted when the candidate or prospect is purged. | Service Terms §A.3; Places policies |
| | Latitude / longitude | ❌ (not requested) | — | Allowed for 30 days (§14.3), but not needed; point-in-polygon is barred |
| | Name, address, phone, `websiteUri`, rating, review count, hours, status, types | ❌ (in memory for one task only) | — | §3.2.3(a)(iii), (b) |
| | Reviews, photos | ❌ (not requested) | — | §3.2.3(a)(iii); attribution rules |
| | Signals or scores derived from the above | ❌ | — | §3.2.3(c); your D3 instruction |
| | Live display in the UI | Not stored; fetched on demand | — | Counts against the cap; Google logo and attribution shown |
| **Clinic's own website** (robots-permitted public pages) | Business name, address, business phone, WhatsApp number shown on the site, role inboxes (`info@`, `reception@`) | ✅ as signals: URL, `observedAt`, quote ≤300 chars | While active. **Re-verified every 90 days.** If not re-verified for 180 days it's marked *stale*: excluded from scoring, kept for re-verification. Deleted when the prospect is purged. | Independent source. Business contact data, not personal data. |
| | Feature signals (booking, form, chat, JSON-LD, service pages, viewport, HTTPS) | ✅ | Same as above | Independent observation |
| | Final and canonical site URL | ✅ (see §1.2.6) | Same as above | Observed by fetching the site |
| | Named work emails (`dr.ade@clinic.ng`), staff names and roles | ❌ (not extracted in Phase 2; Q4/Q5) | — | D2; data minimisation |
| | Raw page text / HTML | Temporary only | **≤24 h** in `AcquisitionPageCache`; purged after each queue run and by expiry | Needed only to run extractors |
| **PageSpeed Insights API** | Mobile/desktop performance score and date | ✅ | 90 days, then refreshed or deleted | Google APIs Terms of Service apply. **To be confirmed (Q7).** Not Maps content. |
| **DNS MX lookup** | `mxValid` and the date checked | ✅ | Same as the contact it belongs to | Derived from public DNS |
| **CSV import** (independent sources you supply) | Business fields as imported | ✅ with `source` and `source_url` per row | While active; same re-verification rules | You attest the data was lawfully obtained. **Rows whose source is Google Maps, Google or Places are rejected**, so Places content can't be laundered in. |
| | Contact name, role, named email (personal data) | ✅ only from CSV or manual entry, with a lawful-basis field | **180-day inactive rule** (§2.1), subject to review | NDPA 2023, legitimate interest. Your LIA is needed before any outreach use. |
| **Manual entry** (admin) | Same as CSV | ✅ with a required source | Same as CSV | Same Google-source rejection |
| **Apollo / Snov** (disabled) | — | ❌ in Phase 2 | Per provider terms, when enabled later | Interface only |
| **Internal derived** | Findings, scores, recommendations (from independent sources only) | ✅ | While the prospect is active; deleted with it | Built only from stored, independent signals |
| **Suppression / tombstones** | Kind + **SHA-256 of the normalised value** (domains also kept in plain text) + reason + date | ✅ | **Indefinite** for opt-out, objection or erasure. 180 days for retention-expiry markers (§2.1) | So deleted or objected-to data can't be re-ingested |
| **Operational** | `AcquisitionAgentRun`, `AcquisitionTask` rows | ✅ (IDs, hashes and redacted errors only; **no contact values in task inputs or outputs**) | 90 days | Observability |
| **Database backups** | Everything above, as of the backup | Out of scope here | Per your backup retention | **Deleted data persists in backups until they expire (Q6)** |

### 2.1 Proposed 180-day inactive-contact rule (separate rule; needs privacy and outreach review)

- **Scope:** personal contact data on a prospect: contact name, role, named email and direct personal phone, from CSV or manual entry.
- **Trigger:** 180 days since the later of `createdAt` or `lastVerifiedAt`, **with no engagement**. Engagement means an approved and sent message, a reply, or an admin "keep" with a reason. None of those exist in Phase 2.
- **Action:** hard-delete the decision-maker row. Record a pipeline event **with no personal data** ("1 contact deleted by retention rule"). Write a `retention_expiry` tombstone (a hash) that blocks re-import of the same value by CSV or manual entry for 180 days, unless an admin re-adds it with a fresh source and reason.
- **Not the same as suppression:** an expired contact isn't an objection, so it can be legitimately re-collected later from a fresh source.

### 2.2 Erasure, opt-out and objection

- **Admin action `erase_contacts`** (reason required):
  - deletes the decision-maker rows
  - writes permanent tombstones for each value (email, phone)
  - cancels the prospect's pending tasks
  - records an event with no personal data
- **Opt-out or objection:** writes the same permanent tombstone as a suppression (kind email, domain or phone).
- **Every write path checks tombstones first:** CSV preview, manual entry, extraction results, future providers. A matching value is **dropped and the drop counted**, never stored.
- **Erasure covers the temporary page cache too:** cached pages for that domain are deleted immediately.

---

## 3. Permitted public sources

**For clinic research:**

| ✅ Permitted | How it's used |
|---|---|
| Google Places API (Text Search, minimal field mask) | Discovery and identity (`place_id`); in-memory exclusion filtering; finding the website (§1.2) |
| The clinic's own website | Public pages only. `robots.txt` respected. No logins, forms, paywalls or query-string crawling. At most 5 pages. Domains that ask not to be crawled go on a `crawl_domain` blocklist. |
| PageSpeed Insights API | Performance of the clinic's own site |
| Public DNS (MX records) | Whether an email domain can receive mail |
| CSV / manual data from independent, lawful sources you supply | Any field, with a source |
| Apollo / Snov | **Interface only; disabled** |

**Not permitted:**
- copying or scraping Google Maps or Google Search
- other search engines
- business directories (vConnect, BusinessList, Jiji and similar)
- social networks (Facebook, Instagram, LinkedIn, X, TikTok)
- review sites
- automated querying of the MDCN register
- WHOIS personal data
- SMTP mailbox probing
- guessing email patterns (`firstname@domain`)
- AI inference of names, emails, phones or owners
- the existing `/api/emails`, `/api/enrich-email` and `/api/verify-email` code paths

**For decision-maker research (D2):**
- **Automatic:** role contact points published on the clinic's own site only: role inboxes, the business phone, the WhatsApp number shown on the site. Each is labelled `role_inbox` / `business_phone`, with no person attached.
- **Manual:** named people only through admin entry with a source URL or description and a lawful-basis field. Labelled `manual`, confidence chosen by the admin, and never shown as "verified" unless the admin records how it was verified.
- **Not done:** inferring owners or practice managers, extracting names, guessing emails.

**Limitation, stated plainly:**
- Many Lagos clinics have **no website**. A Places-only discovery then has **no independent source**, so nothing but its `place_id` is kept. Status: `no_independent_source`.
- Those clinics can only become prospects through CSV or manual data from independent sources. Copying the Google listing by hand doesn't count, and is rejected.
- Named decision makers will usually be **absent**. Contactability will mostly be `role_inbox` or `business_phone`.

### 3.1 Crawler identity (D1)

- **User agent:** `RunvaxResearchBot/1.0 (+${IA_CRAWLER_POLICY_URL})`. No browser identity is ever sent.
- **Fetcher refuses to run** unless `IA_CRAWLER_POLICY_URL` is set to a genuine Harzotech or RUNVAX crawler-policy or contact URL (Q1). Synthetic tests use a test value against fixtures only.
- **`robots.txt` rules:**
  - Our user agent's own group applies; otherwise the `*` group.
  - `Disallow` and `Allow` are honoured with longest-match precedence.
  - `Crawl-delay` is honoured, with a minimum of 2 s.
  - 404 means allowed. 401, 403, 5xx or a timeout means **disallowed for the whole site**.
  - Cached for 24 h.
- **Site terms:** they can't be read reliably by a machine. Mitigations: low volume, own-site only, honouring `noindex`/`nofollow` meta for link-following, and a domain blocklist the admin can add to at any time (`crawl_domain` suppression).

---

## 4. Discovery and duplicate detection (Agent 1)

**Places discovery** (`acq.discover`, input `{industryKey, area, queryIndex}`):
1. Reserve **1** Places request against the cap (§7). If refused, the task is skipped as `budget_exhausted` and rescheduled.
2. Text Search with the query from config (`"<query> in <area>, Lagos"`), **first page only**. Minimal field mask: `places.id, places.displayName, places.types, places.businessStatus, places.websiteUri`.
3. In memory: drop excluded keywords, types and non-operational businesses.
4. For each remaining result, upsert an `AcquisitionCandidate` with `place_id`, area (from our query), `discoveredAt`, `queryIndex`. If it had a website, enqueue `acq.research_site` with `{candidateId}` only. **The URL isn't stored or passed in the task.** The research task makes its own Place Details call (`websiteUri` only, 1 more reserved request) to get it again. *(Alternative for review: allow passing the URL inside one task chain in memory. Not possible here, because each task runs as a separate invocation.)*
5. Candidates without a website are marked `no_independent_source`.

**Candidate → prospect** (`acq.research_site`):
- Reserve 1 Places request, then fetch `websiteUri` in memory.
- Run the safe fetcher on the clinic's site (§5).
- If the site yields an **independently observed business name** (JSON-LD `name`, `og:site_name`, `<title>`, or a header), create the `Prospect` (`source='industry-acquisition'`, `businessName` from the site) and the `AcquisitionProspect`, with signals and sources.
- Otherwise mark the candidate `no_independent_source`.

**CSV import:**
- **Columns:**
  - required: `business_name`, `source`
  - optional: `website`, `phone`, `email`, `address`, `area`, `city`, `place_id`, `contact_name`, `contact_role`, `contact_email`, `lawful_basis`, `source_url`
- **Checks:**
  - Own RFC 4180 parser: UTF-8, ≤2 MB, ≤1,000 rows, Zod validation per row.
  - `source` must not mention Google, Google Maps or Places.
  - Values are checked against tombstones and suppressions.
  - Cells starting with `=`, `+`, `-` or `@` are flagged and stored as text.
- **Preview first** (per-row accept / duplicate / reject reasons; only the batch record is written), **then commit**, with your attestation that the data was lawfully obtained.
- A website from CSV is queued for the safe fetcher like any other.

**Manual add:** same schema and checks, one record at a time.

**Duplicate detection** (`AcquisitionIdentity`):
- **Strong keys:**
  - `place_id`
  - the registrable domain (via `domainFromUrl`, which rejects social and builder hosts)
  - the normalised business phone (`normalizePhone`)

  A match means **merge**: a new source on the existing prospect, never a second record.
- **Weak key:** `normalizeForDedup(name) + area`. Flagged *possible duplicate*; an admin decides.
- **Multi-branch groups:** different place IDs on the same domain are separate candidates or prospects, linked by the domain key. A role inbox can belong to only one prospect's outreach contact slot.
- **Your existing CRM** (read only): if a `Prospect` with the same `businessId` (place ID) or domain already exists, or has `outreachSentAt` set, the prospect is flagged `crmConflict` and becomes **ineligible**. This catches clinics already pitched through the WhatsApp workflow.
- **Idempotency:**
  - every task uses the Phase 1 idempotency key
  - unique constraints on candidate (`userId, placeId`), identity, import file hash and signal (`acqProspectId, code, sourceId, contentHash`)
  - CSV rows without a place ID get `businessId = acq_<sha256(domain|phone|name)>`

---

## 5. Website signals (Agent 3, independent sources only)

**Safe fetcher limits:**
- http/https on ports 80/443 only.
- **SSRF guard:** DNS is resolved and private, loopback, link-local, CGNAT, multicast and metadata addresses (IPv4 and IPv6) are refused. The check is repeated **after every redirect**, at most 3. The connection is pinned to the checked IP to prevent DNS rebinding.
- Same registrable domain only.
- 8 s timeout, 1.5 MB per page, `text/html` only.
- At least 2 s between requests to the same host (or its `Crawl-delay`).
- One host at a time; at most 5 pages per site, chosen from config path hints and same-site links.
- Pages cached ≤24 h.
- `IA_WEB_PAGES_DAILY_CAP` (500) is reserved atomically, the same way as the Places cap.

**Extractors** (deterministic). Every signal records the URL, `observedAt`, a quote ≤300 chars, `method='html_rule'` and a rule-defined confidence:

| Signal | Rule | Confidence |
|---|---|---|
| `online_booking_present` | Link or iframe to a known booking provider (configurable list) | high |
| `booking_cta_to_form` | "Book (an) appointment" CTA pointing at an on-site form | medium |
| `online_booking_absent` | No booking provider, no booking form, page fully readable | medium; **unknown** if the page looks JavaScript-rendered |
| `contact_form_present` | `<form>` with email/phone/message fields | high |
| `whatsapp_entry_point` | `wa.me` / `api.whatsapp.com` link | high |
| `chat_widget_present` | Known chat-widget script host | high |
| `click_to_call` | `tel:` link | high |
| `structured_data_dentist` | JSON-LD `@type` of `Dentist`, `MedicalBusiness` or `LocalBusiness` | high |
| `service_pages` | Links or headings naming services from the config list | medium |
| `opening_hours_published` | Hours text or `openingHours` in JSON-LD | medium |
| `mobile_viewport`, `https` | Viewport meta; final URL scheme | high |
| `business_name`, `business_address`, `business_phone`, `role_inbox` | JSON-LD, `og:` tags, `tel:`, `mailto:` / text (role-type addresses only; Cloudflare email decoding supported) | high (structured) / medium (text) |
| `pagespeed_mobile` | PSI API (cap `IA_PSI_DAILY_CAP` 100) | high |

**JavaScript-rendered detection:** when visible text is under 500 characters and single-page-app markers are present (an empty `#root` or `#__next`, a script-only body), **absence-type signals become `unknown`**. They never count as an observed absence.

**Findings:** per-category rules from config v2 turn signals into `AcquisitionFinding` rows. Each row records strength or weakness, observed or inferred, evidence, source, date, impact hypothesis, confidence, validation question and solution category.

---

## 6. Deterministic scoring formula, provenance and confidence

**Inputs:** stored signals from independent sources (website, PSI, CSV, manual) plus category inferences from *our own* config. **No Places-derived input. No AI.**

```
For each stored signal s (not superseded, not stale):
  basis(s)       = observed 1.0 | inferred 0.4 | unknown 0
  confidence(s)  = high 1.0 | medium 0.7 | low 0.4
  freshness(s)   = 1.0 if verified within 90 days | 0.5 if 90–180 days | 0 if older (stale)
For each rule r in category c (config v2: {signal, weight}; strength signals have negative weight):
  contribution(r) = weight(r) × basis(s) × confidence(s) × freshness(s)   (0 when the signal is absent)
S_c   = clamp(Σ_r contribution(r), 0, 1)
Score = round(100 × Σ_c W_c × S_c)                (W_c from config; Σ W_c = 1)
```

**Shown next to the score, never folded into it:**
- **Evidence coverage** = (categories with ≥1 observed, fresh signal) ÷ (number of categories).
- **Contactability:**
  - `named_manual`: an admin-entered named contact
  - `role_inbox`
  - `business_phone`
  - `none`
- **Band** (a rule table in config):

  | Band | Rule |
  |---|---|
  | `high` | Score ≥ 50, coverage ≥ 0.5 and contactability ≥ `role_inbox` |
  | `medium` | Score ≥ 30 and coverage ≥ 0.34 |
  | `insufficient_evidence` | Coverage < 0.34 |
  | `low` | Everything else |

**Eligibility checks** (each stored with its reason). The prospect must be:
- inside the configured geography (from our query area, or an address observed on the site)
- not an excluded type
- not suppressed or tombstoned
- free of a CRM conflict
- not marked `no_independent_source`

**Stored per score** (`AcquisitionScore`, append-only):
- the total, band, coverage, contactability and eligibility
- a breakdown for every category and rule: the signal ID, basis, confidence, freshness, contribution and source URL
- `scoreVersion` and `configVersion`

A test recomputes the total from the breakdown and must match it exactly.

**Worked example** (synthetic S2: phone-only site, no booking, no form, readable HTML). Booking friction:
- `online_booking_absent`: weight 0.7, observed (1.0), medium (0.7), fresh (1.0) → 0.49
- `click_to_call` only: weight 0.2, observed, high (1.0), fresh → 0.2
- S_booking = 0.69

With W_booking = 0.2, that contributes 13.8 points. Every other category is computed the same way and the total is the rounded sum.

**Offer mapping** (deterministic):
- Any category with S_c ≥ 0.3 nominates its configured offers.
- Each offer's value is Σ W_c × S_c over the categories it solves.
- **Primary** is the highest. **Secondary** is shown if it's at least 60% of the primary.
- The rationale is a template filled from the finding IDs, with dates and URLs, plus the config's validation questions and missing information.
- All four offers are `unconfigured`, so every recommendation carries **"Internal: offer not yet approved for sale."** No prices, scope, timelines, results or guarantees anywhere.

---

## 7. The 50-request daily Places cap (D4) and the other limits

**Atomic reservation.** `AcquisitionProviderUsage` is platform-wide, with a unique key on (`provider`, `day`), where the day is the Africa/Lagos calendar date (Q8).

```ts
// before EVERY Places HTTP call, including retries:
await prisma.acquisitionProviderUsage.upsert({ where: { provider_day }, create: { provider, day, calls: 0 }, update: {} });
const r = await prisma.acquisitionProviderUsage.updateMany({
  where: { provider: 'google_places', day, calls: { lt: cap }, pausedUntil: null_or_past },
  data:  { calls: { increment: 1 } },
});
if (r.count === 0) → no call; task outcome "skipped: budget_exhausted" (or "provider_paused"), rescheduled to the next Lagos day
```

- **Why it's safe under concurrency:** MySQL evaluates `calls < cap` and the increment in **one statement**, so N concurrent runs can never reserve more than `cap`.
- **Every attempt is reserved:** failed calls, 4xx/5xx responses and timeouts all count against the cap.
- **429 / quota errors:** the provider is paused until the next Lagos day. Five consecutive failures within 15 minutes pause it for 30 minutes.
- **Limits:**

  | Limit | Value |
  |---|---|
  | `IA_PLACES_DAILY_CAP` | 50, hard maximum in code 200 (raising it needs a code change) |
  | `IA_PLACES_PER_RUN` | 5 |
  | Per task | 1 request |
  | `IA_PLACES_ENABLED` | Default **false**; the adapter refuses to run when off, and it stays off until D7 approval |

- **The cap is a ceiling, not a target.** Discovery is queued only by an explicit admin action, for an explicit area and query list.
- **The same mechanism covers:** `IA_PSI_DAILY_CAP` (100), `IA_WEB_PAGES_DAILY_CAP` (500), `IA_DAILY_TASK_CAP` (200 tasks/day) and the Phase 1 per-run `IA_TASK_BUDGET` (10, max 50).
- **Usage reporting:** each Places call also goes through the existing `logGooglePlacesReqs`, so it shows up in your usage numbers.
- **Cost guard:** before any live run (D7), the field mask is checked against current Places pricing, and the worst case (cap × price) is shown on the Overview.

---

## 8. Phase 2 versus future outreach

| | Phase 2 (research) | Future outreach phase (separate approval) |
|---|---|---|
| Lifecycle | `discovered → contacts_researched → audited → strategized` (and `needs_review`, `disqualified`, `suppressed`, `cancelled`) | `draft_pending_approval` onwards |
| Tables written | Candidate, Prospect, AcquisitionProspect, Source, Identity, Signal, Finding, Score, Recommendation, DecisionMaker (role/manual), Suppression, ImportBatch, PageCache, ProviderUsage, Task, AgentRun, PipelineEvent | AcquisitionDraft, AcquisitionApproval |
| AI models | **None** | Drafting, subject to the gate |
| Sending | **None.** `deliverDraft()` is unchanged and unreachable from Phase 2 code | Through the blocking gate plus a sending identity (Phase 5) |
| Contact data leaving the system | **No export, no copy-to-clipboard of contact lists** | To be designed |
| UI | No compose, send or follow-up controls | Review queue |

**Enforced by tests:**
- No Phase 2 handler enqueues `acq.draft_outreach`.
- No `AcquisitionDraft` rows are written.
- `runStructured`, `nodemailer` and the WhatsApp routes are never called.
- `fetch` never reaches a host outside the fixtures.

**Entry criteria for any outreach phase:**
- approved offer details
- a completed LIA
- the 180-day rule reviewed
- a sending identity with a postal address
- your explicit approval

---

## 9. Privacy, suppression, deletion and security

- **Privacy:**
  - minimisation per §2–3
  - no personal names extracted automatically
  - no patient data; testimonial text isn't stored
  - task payloads carry IDs only
  - I'll draft an LIA template (`docs/compliance/dental-pilot-lia.md`) for you or counsel. It isn't legal advice.
- **Suppression and tombstones:**
  - Kinds: `email`, `phone`, `domain`, `crawl_domain`.
  - Stored as SHA-256 of the normalised value; domains also in plain text.
  - Reasons: `opt_out`, `objection`, `erasure`, `complaint`, `bounce`, `manual`, `retention_expiry` (with an expiry).
  - Checked on every write path (§2.2).
- **Deletion:**
  - Prospect purge deletes, in this order: signals → findings → scores → recommendations → decision makers → sources → identities → page cache → acquisition prospect.
  - The `Prospect` row is deleted too, **only if** its `source` is `industry-acquisition` and it has no conversations.
  - A non-personal event is kept.
- **Security:**
  - Admin-only access, enforced by the gate on every route (the scanner test covers new routes).
  - SSRF guard and redirect re-checks.
  - `robots.txt`.
  - Size and time limits.
  - CSV formula-injection flag and file limits.
  - React escaping only: fetched content is never rendered as HTML (no `dangerouslySetInnerHTML`).
  - Secrets redacted in all stored errors.
  - Provider keys server-only.
  - Config validated with Zod at load.
  - **No new runtime dependencies.**
- **Rollback:** §13.

---

## 10. Data model: migration `2_acquisition_intelligence` (additive)

**No existing RUNVAX table or column changes.** Phase 1 `Acquisition*` tables aren't in production yet; they get only new columns or changed constraints. The guard test and rehearsal are extended to migration 2, including its `down.sql`.

- **New:**
  - `AcquisitionCandidate`: `placeId`, `industryKey`, `area`, `queryIndex`, `status` (`pending_research` / `promoted` / `no_independent_source` / `excluded`), `acqProspectId?`, `discoveredAt`. Unique (`userId`, `placeId`).
  - `AcquisitionImportBatch`
  - `AcquisitionIdentity`
  - `AcquisitionSignal`
  - `AcquisitionScore`
  - `AcquisitionPageCache`
  - `AcquisitionProviderUsage` (platform-wide; `pausedUntil`, `consecutiveFailures`)
- **Changed (Phase 1 tables only):**
  - `AcquisitionSuppression`: `valueHash` (unique with `userId` and `kind`); `value` becomes nullable (plain text for domains only); `expiresAt`; new reasons.
  - `AcquisitionDecisionMaker`: `kind` (`role_inbox` / `business_phone` / `manual_named`), `sourceUrl`, `evidenceQuote`, `mxValid`, `lastVerifiedAt`, `lawfulBasis`, `retainUntil`, `flags`.
  - `AcquisitionProspect`: `candidateId`, `importBatchId`, `area`, `crmConflict`, `lastScoredAt`.
  - `AcquisitionSource`: `httpStatus`, `robotsAllowed`, `method`.
  - `AcquisitionFinding`: `signalIds`.
  - `AcquisitionRecommendation`: `scoreId`, `offerStatusAtTime`.
- **Config v2 (dental):** machine-readable signal rules per category; band rules; booking-provider and chat-widget host lists; contact-page path hints; query list per area; `prohibitedImportSources`.

---

## 11. Synthetic test scenarios

Fixture websites live as local HTML files. Places and PSI responses are fixture JSON. `fetch` is mocked, so nothing touches the network.

| # | Scenario | Expected result |
|---|---|---|
| S1 | Modern site: booking provider, WhatsApp, JSON-LD Dentist, contact form | Strengths recorded; low booking and enquiry scores; band `low`/`medium`; recommendation names the strongest remaining category, or "no strong opportunity" |
| S2 | Phone-only site, no booking or form, readable | `online_booking_absent` observed; booking friction ≈0.69; primary AI Receptionist or AI Voice Agent per weights; matches the worked example |
| S3 | JavaScript-only shell | Absence signals `unknown`; coverage < 0.34; band `insufficient_evidence` |
| S4 | `robots.txt: Disallow: /` | No page fetched; source `robots_disallowed`; candidate stays `no_independent_source` |
| S5 | `robots.txt` returns 503 / timeout | Treated as disallowed |
| S6 | Places result without a website | Candidate with `place_id` only; **zero other Places fields anywhere in the DB** (asserted by scanning every written row) |
| S7 | Same clinic via Places and CSV (same domain) | One prospect, two sources, no duplicate identities |
| S8 | Two branches, two place IDs, one domain | Two candidates or prospects linked by domain; the role inbox held by only one |
| S9 | Suppressed domain | Excluded; no contacts or signals stored |
| S10 | Erased email re-imported by CSV | Row rejected (tombstone); drop counted; value not stored |
| S11 | CSV with `source="Google Maps"`; a formula cell; a 3 MB file; 1,001 rows | Google row rejected; formula cell flagged; file and row limits enforced |
| S12 | Clinic already in your CRM with `outreachSentAt` | `crmConflict`, ineligible |
| S13 | Website resolves to 10.0.0.5; redirect to 169.254.169.254; IPv6 `::1` | All refused before connecting |
| S14 | 10 concurrent drains trying 60 Places calls; retries; one 429 | Exactly 50 reserved; retries counted; 429 pauses until the next Lagos day; skipped tasks rescheduled, not failed |
| S15 | Cloudflare-obfuscated `info@` plus `dr.ade@clinic.ng` on the page | `info@` stored as `role_inbox`; the named address **not stored** |
| S16 | Signals verified 100 and 200 days ago | Freshness 0.5 and 0 (stale, excluded); re-verify task queued |
| S17 | Re-run every task; re-import the same CSV | Zero new rows of any kind |
| S18 | Erasure on a prospect with a cached page | Decision makers deleted, tombstones written, cache purged, tasks cancelled, event has no personal data |
| S19 | Fetcher without `IA_CRAWLER_POLICY_URL`, or Places with `IA_PLACES_ENABLED=false` | Refused with a clear reason; no network |
| S20 | Full chain on fixture set S1–S3, S7, S12 | Ends at `strategized` / `needs_review`; no draft, no model call, no send |

**Synthetic run deliverable** (before any D7 request): a report with, per fixture clinic, the final state, score breakdown, band, eligibility, recommendation and provenance; plus queue and run metrics, cap counters and the full test results.

---

## 12. Acceptance criteria (measurable)

1. With the flag off: 404 on every new route and page. With the flag on: 401/403 for non-admins. Automated, and covering 100% of route files.
2. Migration 2 passes the guard test (no `ALTER`/`DROP` on any non-`Acquisition*` table) and the disposable-DB rehearsal, including rollback. `git diff main` shows no change to existing models.
3. **S6 database scan:** after any run, no column anywhere holds a Places-sourced value other than `placeId`. Checked by comparing stored rows against the fixture's name, phone, address and rating strings.
4. For every stored signal, finding and score input: source, URL or place ID, `observedAt`, method and confidence are all present (100%).
5. Score determinism: the same inputs give the same output across 3 runs. The breakdown recomputes to the stored total exactly.
6. Idempotency (S17): 0 duplicate rows of any type.
7. Cap (S14): exactly `cap` reservations under 10× concurrency; 0 HTTP calls beyond the cap.
8. Tombstones and suppression (S9, S10, S18): 0 suppressed or erased values stored.
9. Boundaries: 0 draft rows, 0 `acq.draft_outreach` tasks, 0 model calls, 0 `nodemailer` or WhatsApp calls, 0 non-fixture fetches.
10. `npm ci`, `tsc --noEmit`, `vitest run` and `next build` pass on Node 20, 22 and 24. All 206 existing tests stay green.
11. The files in §14 are unchanged against `main` (checked with `git diff --name-only`).

---

## 13. Rollback

1. The flag stays off, so nothing is reachable.
2. Revert the Phase 2 commits on the branch. Nothing is merged or deployed.
3. Migration 2 `down.sql` drops only migration 2 tables and columns, and is rehearsed.
4. Synthetic runs write only to disposable local databases, which are deleted afterwards.

---

## 14. Existing files that stay untouched

- **Task queue, AI, outreach:** `src/lib/tasks/*`, `src/lib/ai.ts`, `src/lib/outreach/*`, `src/lib/opportunity/*`, `src/lib/scoring.ts`
- **WhatsApp:** `src/lib/waMessage.ts`, `src/lib/phone.ts` (imported only), `src/lib/waRateLimit.ts`, `src/lib/whatsapp-constants.ts`, `src/app/api/whatsapp/*`, `src/components/WaDailyCounter.tsx`
- **Email:** `src/app/api/emails/*`, `api/enrich-email/*`, `api/verify-email/*`, `api/send-email/*`, `api/proposal/*`, `src/lib/email.ts`
- **Places, Apollo, auto-prospect:** `src/lib/google-places.ts`, `src/lib/apollo.ts` (imported only), `src/lib/autoProspect.ts`, `src/lib/overpass.ts` (imported only), `src/app/api/search/*`, `api/details/*`, `api/pagespeed/*`
- **Auth, billing, admin:** `src/lib/auth.ts`, `src/lib/adminAuth.ts`, `src/lib/usage.ts` (imported only), `src/lib/billing.ts`, `src/lib/paystack.ts`, `src/lib/plans.ts`, `src/lib/features.ts`, `src/app/api/payments/*`, `src/app/admin/*`
- **Config and existing Prisma models:** every existing model's columns in `prisma/schema.prisma`; `vercel.json`, `next.config.mjs`, `middleware.ts` (root), `src/middleware.ts` (already covers `/acquisition`), `.env*` (except `.env.example` documentation)
- **Phase 1 safety pieces:** `src/lib/acquisition/gate.ts` (no sending path added), `src/lib/acquisition/llm.ts` (not called in Phase 2)

**Expected to change:**
- `prisma/schema.prisma` (Acquisition models only)
- `prisma/migrations/2_*`
- `src/lib/acquisition/**`, except the two files listed above
- `src/app/acquisition/**`, `src/app/api/acquisition/**`
- `tests/**`, `docs/**`
- `scripts/rehearse-acquisition-migration.sh`, `.env.example`
- `package.json` / lockfile **only if** D5 test libraries are needed

---

## 15. Unresolved questions

| # | Question | Default until answered |
|---|---|---|
| Q1 | Which genuine crawler-policy or contact URL should the user agent carry: a Harzotech page, or a RUNVAX `/bot` page (the latter needs a deploy)? | Fetcher disabled outside tests |
| Q2 | Legal review of: (a) storing a clinic's website URL first learned from Places, after fetching the site ourselves; (b) whether a Places-fed prospect database falls under §3.2.3(d)(iii) "listings or directory service". | No live Places use (D7) |
| Q3 | Existing RUNVAX tables appear to store Places content beyond the current terms (§1.3). Plan a separate remediation? | Untouched; reported only |
| Q4 | May names and roles published on a clinic's own team page be extracted deterministically (no AI) in a later phase? | No |
| Q5 | May named work emails published on the clinic's own site be stored (classified, under the 180-day rule)? | No; role inboxes only |
| Q6 | The 180-day inactive rule (§2.1) and backup retention for deleted data: privacy and outreach review | Rule designed; reviewed before enforcement matters (no outreach in Phase 2) |
| Q7 | Do the Google APIs Terms (PageSpeed Insights) allow storing scores for 90 days? | Store with `checkedAt`; confirm before live use |
| Q8 | Should the daily cap reset by Africa/Lagos calendar day or UTC? | Africa/Lagos |
| Q9 | D5: frontend tests are needed for the CSV preview and prospect detail screens. OK to add pinned `jsdom` + `@testing-library/react` (with React 18 compatibility checked)? | Add only when those tests are written; versions reported first |

---

## 16. Implementation sequence

Each step is a separate local commit, with all quality gates passing before the next.

| Step | Content |
|---|---|
| 2.0 | Migration 2 + config v2 + guard and rehearsal updates |
| 2.1 | Infrastructure: atomic provider caps, circuit breaker, safe fetcher (SSRF, `robots.txt`, identity check), page cache, tombstones and purge |
| 2.2 | Discovery: Places adapter (disabled by default), candidates, CSV/manual import with preview and commit, duplicate detection, CRM conflict check |
| 2.3 | Contacts: role inboxes and business phones from the site, MX check, manual named entry, provider interface (disabled), erasure |
| 2.4 | Site audit: extractors, findings |
| 2.5 | Scoring and offer mapping, versioned, with breakdowns |
| 2.6 | API routes and admin UI (frontend tests per Q9) |
| 2.7 | **Synthetic run** S1–S20, then a report of outputs and test results to you. **Stop.** Live access needs separate approval (D7). |
