# Legitimate-interest assessment (LIA): dental clinic research, Lagos

> **DRAFT for qualified review. Not legal advice. Not approved.**
> This is an engineering draft. It sets out the facts of the system as built (Phase 2, 2026-10-14) and the questions a Nigerian data-protection lawyer or DPO must answer. It does **not** conclude that the processing is lawful. Where the NDPC's GAID 2025 LIA template differs from this structure, the official template takes precedence; this draft is input to it.
>
> Sources checked 2026-10-14 (secondary commentary, to be verified against official texts):
> - NDPA 2023 commentary on s.24 (principles), s.25 (lawful bases, including legitimate interest), s.36 (right to object, including direct marketing) and s.65 (definitions).
> - Commentary on the NDPC GAID: issued 20 March 2025, in effect 19 September 2025, introduces an LIA template.
> - Federal High Court, Abuja: *Onimisi v. Guaranty Trust Holding Co. Plc*, 11 June 2026, as reported.
> - Harzotech's privacy policy, effective 14 May 2025.

| | |
|---|---|
| Controller | Harzotech Nig Ltd (as named in the Harzotech privacy policy), contact info@harzotech.com |
| System | RUNVAX Industry Acquisition Engine: admin-only, behind a feature flag (off), local development only |
| Processing activity assessed | **Research only:** identifying dental clinics in Lagos, recording evidence about their public digital presence and business contact points, and internal prioritisation |
| **Not** covered | Any outreach (email, WhatsApp, calls), follow-up or sales contact. That is a separate processing activity needing its own assessment before any outreach phase. |
| Status of live sources | Google Places, the website crawler, PageSpeed, DNS, Apollo and Snov are all **disabled** |
| Owner / reviewer / sign-off | _to be completed_ |

---

## 1. Purpose test

| # | Purpose | Interest pursued | Whose interest | Is it specific and real? |
|---|---|---|---|---|
| P1 | Identify dental clinics in Lagos that may benefit from Harzotech's services | Commercial: finding potential B2B clients | Harzotech | _reviewer to confirm_ |
| P2 | Assess each clinic's **public** digital presence (website features, booking, enquiry handling) | Understanding whether there is a genuine service need before any contact | Harzotech; arguably the clinic (relevant, not generic, approaches) | _reviewer_ |
| P3 | Record **business** contact points published by the clinic | Being able to reach the business through its own published channels in a later, separately approved phase | Harzotech | _reviewer_ |
| P4 | Internal prioritisation and offer recommendation (deterministic, rule-based) | Focusing effort; avoiding irrelevant pitches | Harzotech | _reviewer_ |
| P5 | Avoid contacting clinics already in Harzotech's CRM, already contacted, suppressed, or that have objected | Respecting objections, avoiding duplicate contact | Data subjects and Harzotech | _reviewer_ |

**Questions:** is commercial B2B prospecting a "legitimate interest" under NDPA s.25 at all, for each purpose separately? (Q-N1)

## 2. Necessity test

| Data element | Why it's needed | Less intrusive alternative considered | Design choice |
|---|---|---|---|
| Clinic business name, website, business address | Identify the organisation (P1) | — | Taken from the clinic's own site or an independent import, never from Google Places |
| Website feature signals | Assess need (P2) | Not assessing at all (would make any later contact generic) | Deterministic rules; ≤300-character quotes; no full-page archive (24 h cache only) |
| Role inbox (`info@`, `reception@`) | Business contact point (P3) | Named individuals' emails | **Only** role inboxes on the clinic's own domain are stored automatically |
| Business phone / WhatsApp number shown on the site | Business contact point (P3) | None stored | Stored with source URL. ⚠️ It may be a person's own mobile (common for small clinics), making it personal data (Q-N4) |
| Named person (name, role, email, phone) | Possibly needed for a later phase | Role inbox only | **Never extracted automatically, no AI.** Admin manual entry only, with source, lawful basis and attestation |
| Suppression hashes | Honour objections and erasures (P5) | Keeping plain values | SHA-256 of the value (see the security review, F14: weak for phones) |
| Provenance (source, URL, date, method) | Accuracy; answering "where did you get my data" (cf. the GTCO order to disclose the source) | — | Recorded per fact |

**Not processed by design:** patient data, reviewer names, social-network profiles, home addresses, guessed emails, data from directories or search engines, Google Places content.

## 3. Balancing test

| Consideration | Facts | Assessment (reviewer) |
|---|---|---|
| Nature of the data subjects | Clinic owners, dentists and staff in their professional capacity; often small practices where the business and the individual overlap | _ |
| Reasonable expectations | Information the clinic itself publishes to attract patients. ⚠️ *Onimisi v. GTCO* (2026) found **no** lawful basis for unsolicited marketing to a non-customer with no prior relationship. Its reach to B2B research (as opposed to marketing) needs assessment. | _ |
| Sensitivity | No special-category data is intended. ⚠️ The 24 h page cache stores raw HTML, which may incidentally include patient testimonials (health data) or staff names | _ |
| Impact on individuals | Research alone has low direct impact. A later unsolicited contact would carry the main impact and needs its own assessment | _ |
| Power imbalance / vulnerability | None identified (business context) | _ |
| Transparency | ⚠️ **Gap:** Harzotech's privacy policy (14 May 2025) doesn't mention business research, prospecting, crawling or B2B contact data | _ |
| Safeguards | Admin-only access behind a flag; human attestation on imports; suppression and tombstones; erasure action; provenance; data minimisation; no AI; daily caps; `robots.txt`-respecting crawler (disabled) | _ |
| Known gaps in the safeguards | F7, F8, F13 and F14 were **fixed locally in Phase 2B P0** (`docs/phase-2b-p0-report.md`). Open: erasure is per admin account (R2); phone dedupe keys are plain text while active (R3); page-cache minimisation (F12) | Technical fixes do not resolve the legal questions below |

## 4. Data categories and sources (summary; full detail in `docs/source-retention-matrix.md`)

| Category | Personal data? | Sources | Retention (provisional) |
|---|---|---|---|
| Organisation identity and website facts | Generally no (may identify a sole practitioner) | Clinic website, independent imports, manual entry | While active; re-verify every 90 days; stale after 180 days |
| Role inboxes | Possibly (Q-N4) | Clinic website, imports | While active |
| Business phones | Possibly, if a personal mobile (Q-N4) | Clinic website, imports | While active |
| Named contacts | **Yes** | Admin entry or import only, with a lawful basis | 180 days without engagement (provisional rule, not yet enforced) |
| Evidence quotes | May contain personal data | Clinic website | With the signal |
| Raw page HTML | May contain personal / health data | Clinic website | ≤24 h |
| Import previews | **Yes**, if contact columns are used | CSV upload | ≤24 h intended; ⚠️ purge not wired (F8) |
| Suppression hashes | Pseudonymised | Objections, erasures | Indefinite (needed to honour the objection) |
| Audit events, task logs | No personal data by design | System | 90 days (logs) / with the prospect (events) |

## 5. Access controls

- Only signed-in users whose email is on the `ADMIN_EMAILS` allowlist can reach it, and only while `INDUSTRY_ACQUISITION_ENABLED=true`. The check is enforced on every route and method (tests).
- Every admin action is recorded with the admin's email and a required reason.
- ⚠️ A suspended admin's existing session is not blocked (F9).
- There's no state-changing-request origin check beyond NextAuth's `SameSite=Lax` cookie (F10).
- Personal data is stored on the RUNVAX MySQL database. ⚠️ The configured host appears to be in the UK (`mysql.uk.cloudlogin.co`), and the app runs on Vercel. Both raise cross-border transfer questions (Q-N9).

## 6. Objection, access and source requests

| Request | Procedure (in the tool) | Gap |
|---|---|---|
| "Stop / object" (s.36) | Admin action **suppress domain** or **erase contacts**: suppression or tombstone written; pending tasks cancelled; prospect moved to `suppressed` | Channel: info@harzotech.com (privacy policy: response within 30 days). There's no in-product intake form |
| "Where did you get my data?" | Prospect detail page shows the source, URL, date and method for every fact and contact | Process owner to be named |
| "Delete my data" | **Erase contacts**: decision-maker rows deleted, values tombstoned, the domain's cached pages purged, tasks cancelled, PII-free event | ⚠️ F7: values may remain in signal / finding quotes and `Prospect.businessData` until fixed. Backups (Q-N10) |
| "Correct my data" | Delete the contact and re-add it manually with the correct source | No edit-in-place yet |

## 7. Retention and deletion

See `docs/source-retention-matrix.md`. Every retention period is **provisional**, pending this review. The 180-day rule for inactive named contacts is designed (`retainUntil` is recorded) but **not enforced**. Harzotech's privacy policy states 24 months for "lead and enquiry records", and the two must be reconciled (Q-N7).

## 8. Questions requiring qualified Nigerian review

| # | Question |
|---|---|
| Q-N1 | Is B2B prospect **research** (no contact) a legitimate interest under NDPA s.25, and does it pass the balancing test for small clinics where business and owner overlap? |
| Q-N2 | For any **future outreach**: given the GAID's consent provisions as reported and *Onimisi v. GTCO* (2026), can unsolicited B2B email to clinic role inboxes or named staff rely on legitimate interest, or is prior consent required? Does the answer differ for role inboxes versus named individuals? |
| Q-N3 | Does the GAID's LIA template apply, and in what form must this LIA be documented and retained? |
| Q-N4 | Are role inboxes and business phone numbers of small clinics personal data, for example where the number is the owner's personal mobile? |
| Q-N5 | What notice must be given to individuals whose data is obtained from sources other than themselves, and when? What must Harzotech's privacy policy add (research, sources, purposes, retention, objection route)? |
| Q-N6 | Is a DPIA required for this processing (or for the later outreach), under the NDPA and GAID? |
| Q-N7 | Are the proposed retention periods adequate and consistent with the privacy policy's 24 months for lead records? |
| Q-N8 | Does Harzotech need to register with the NDPC as a data controller of major importance, and are audit filings due (the GAID mentions the 2026 audit cycle)? |
| Q-N9 | Cross-border transfer: the database appears to be hosted in the UK and the app on Vercel. What NDPA transfer requirements apply? |
| Q-N10 | How should erasure interact with database backups, and what backup retention is acceptable? |
| Q-N11 | If WhatsApp, SMS or phone outreach is ever considered: which NCC rules on unsolicited communications apply, and how do they interact with the existing RUNVAX WhatsApp workflow? |
| Q-N12 | Do any other Nigerian laws on unsolicited electronic messages apply (for example cybercrime or consumer-protection provisions)? Counsel to identify — not assumed here. |
| Q-N13 | Is incidental health data in cached page HTML (patient testimonials) acceptable for ≤24 h, or must the cache strip text before storage? |
| Q-N14 | Can the "possible duplicate" and CRM-conflict checks lawfully read existing CRM data that was itself sourced from Google Places? (See the existing-data assessment.) |

## 9. Outcome

| Field | Value |
|---|---|
| Conclusion | _Not assessed — pending qualified review_ |
| Conditions / mitigations required | _e.g. fix F7, F8, F14; update the privacy notice; …_ |
| Reviewed by / role / date | _ |
| Next review | Before any live research, and again before any outreach phase |
