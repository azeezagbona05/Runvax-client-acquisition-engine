# Pilot readiness assessment (go / no-go)

**Verified on 2026-10-19** against branch `feat/industry-acquisition-phase1`, HEAD `5e174d4`, working tree clean, local only. Nothing pushed, merged, deployed or migrated. *(This file sits beside `03-production-release-checklist.md`; they are different documents.)*

**Question this answers:** can Harzotech run a safe, local, manual pilot on 20 independently sourced dental clinics, and what genuinely stands in the way?

**Short answer:** **GO for Stages A to C** (select, research, draft and review pitches) on a local database. **NO-GO for real outreach** until the owner approves the offer and counsel answers the outreach question. Neither blocker is engineering.

## 1. What was verified today, and what is only carried over

| Check | Result today | Notes |
|---|---|---|
| Branch, HEAD, tree | `feat/industry-acquisition-phase1`, `5e174d4`, clean | |
| Typecheck | clean | |
| Unit tests | **738 of 738** on Node 20, 22 and 24 | These prove the code does what it was written to do, **not** that the pilot will work commercially |
| Integration tests | **18 of 18** on a throwaway local MySQL (explicit URL, never the `.env` database) | |
| Builds | **Not re-run today.** Last pass: Node 20/22/24 at `39bdfeb`, Node 20/24 at `5e174d4` | |
| Pilot-scale dry run (20 synthetic clinics, local DB, flag on, all provider keys blank) | 20 accepted, committed; queue drained in 8 runs / 3.3 s; **every live switch false** | See section 2 |
| Full lifecycle (evidence, draft, approve, ready, sent, reply, meeting, proposal, won), opt-out after a recorded send, stale approval, server send-route guards, browser link gating | Passed in this project at `66acfe2` to `87d075d` | **Carried over, not re-run today.** Code changed since is discovery and the paste box only |

## 2. What the 20-clinic dry run showed (the facts that shape the plan)
- Importing 20 clinics from a list (name, website, phone, area) works and is fast.
- With **no manual evidence**, all 20 sit at state `strategized` with score 1, **no offer recommendation**, and a pitch is refused with four reasons: no recommendation, no observed weakness, **no clinic email contact**, offer not approved.
- So the system does not shortcut the research: **evidence is entered by a person, per clinic**, and nothing qualifies until it is. That is the real effort in this pilot, and its cost has **not been measured yet**.
- The funnel metrics are all zero or empty until outcomes are recorded. They are correctly empty, not broken.

## 3. Capability assessment

| # | Workflow | Status | Verified basis | Notes and conditions |
|---|---|---|---|---|
| 1 | Import clinics through Route A (independent sources) | **READY** | Dry run today; CSV and paste box tested | Use the CSV template if you need the **role inbox** (`email` column). See defect D1 |
| 2 | Validate sources, detect duplicates | **READY** | Tests today; earlier browser runs | Google Maps/Places-sourced rows and missing sources are refused; same website with a different place is treated as a branch; a suppressed domain is refused |
| 3 | Research a clinic and enter evidence by hand | **READY** (one owner decision, O-1 in `05`) | Earlier lifecycle runs | One form per clinic; evidence must be from the clinic's **own** website; attested. Time per clinic **unmeasured**. Holding real clinic data is flagged by the counsel questions (Q-N1, Q-N4); see O-1 |
| 4 | Score prospects, recommend an offer | **READY** for scoring; **BLOCKED, OWNER DECISION** for a pitch-eligible recommendation | Dry run + earlier runs | Scores are estimates. A recommendation that can lead to a pitch needs an approved offer (decision D2) |
| 5 | Generate, review, edit, approve pitch drafts | **BLOCKED, OWNER DECISION** | Dry run (generation refused); earlier runs (works once the offer is approved) | Needs the offer approved **in the product configuration**: scope, description, approver and date, version. Pitches are fixed templates (no AI, no price, ends with an opt-out line). Approval is bound to the exact text and evidence |
| 6 | Record stages and commercial outcomes | **READY** once a draft is ready | Earlier runs; integration tests | "Sent" can only be recorded against a ready draft, so it inherits blocker 5. Reply, meeting, proposal, won, lost, opt-out follow |
| 7 | Opt-outs and suppression | **READY** | Earlier runs; integration tests | Needs a suppression key of at least 32 characters in the local environment, otherwise the module fails closed (503) |
| 8 | Command centre and prospect timelines | **READY** | Earlier browser runs | Read-only views of agents, tasks and per-clinic history |
| 9 | Export or review pilot results | **PARTIAL, DEFERRED** | Metrics endpoint exercised today | A funnel view exists (counts and rates). There is **no export**. For 20 clinics a spreadsheet kept by the named person is enough. Not needed to test the hypothesis |

Also **DEFERRED** (not needed for the pilot): Route B Google Places finder (built, off), automatic website reading, any AI model, scheduler, automatic follow-up, WhatsApp or SMS, production deployment.

## 4. Genuine blockers

| ID | Blocker | Category | Owner | Why it blocks | Blocks what |
|---|---|---|---|---|---|
| B1 | Offer not approved: scope, deliverables, price policy, approved claims, who handles enquiries, sender identity | **OWNER DECISION** | Business owner | The product refuses to mark a pitch ready or record one sent without it. Engineering must not guess commercial terms | Stage C completion and everything after |
| B2 | Does an AI Receptionist exist to demonstrate? | **OWNER DECISION** | Business owner | The proposed wording says Harzotech is "preparing" it. If nothing exists, the pilot tests **demand for an offer**, and the pitch and call must say so honestly. Engineering has not verified the product exists (doc 04, section E) | Wording of every pitch |
| B3 | May an unsolicited email reach a clinic's role inbox (Q-N2)? Is a role inbox or a business phone personal data (Q-N4)? | **LEGAL/PRIVACY** | Counsel | Governs any real-world contact, and whether preparing records is itself acceptable | Stage D (all outreach) |
| B4 | Privacy notice does not mention prospecting (Q-N5); sender identity and postal address requirements | **LEGAL/PRIVACY** | Counsel drafts, owner publishes | Transparency obligations for data obtained from a source other than the person | Stage D |
| B5 | A named person who records every reply and opt-out the same day, and the stop rule | **OWNER DECISION** | Business owner | Without it, an opt-out could be missed | Stage D |

**Not blockers (and why):**
- Route B legal questions L1 to L7: Route B is off and not needed; Route A covers the pilot.
- Production approval, migrations, deployment, backup, secrets: not needed for a **local** pilot.
- Export, scheduler, website crawler, AI drafting, Places: not needed to test whether the offer and list quality produce replies.
- No verified engineering defect blocks the pilot. One minor defect has a workaround (D1).

## 5. Defects found (reported, not fixed)

**D1: the "paste a list" box has no role-inbox column.**
- *Reproduce:* paste three clinics, import, open one and view its pitch readiness. "A clinic email contact exists" fails.
- *Impact:* clinics added by paste cannot reach "ready". Not a blocker: the **CSV import accepts an `email` column** for role inboxes (info@, reception@, etc.), and a contact can be added by hand.
- *Smallest fix (not applied):* add an optional fifth field, `email`, to the paste converter (about 10 lines plus tests). Recommended only if the person loading clinics prefers paste to CSV.

## 6. Requirements for running the pilot locally and safely
1. **A dedicated local database.** The `.env` / `.env.local` `DATABASE_URL` points at **production**. Never run the app, Prisma or tests with it. Create a new database (for example `runvax_pilot`) on your local MySQL, then run `npx prisma migrate deploy` with the URL passed explicitly on that command.
2. **Override configuration for every command and for the dev server** (a process variable wins over `.env`; an empty string counts as set): `DATABASE_URL` (local host only), `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (a local value), `ADMIN_EMAILS` (the pilot admin only), `INDUSTRY_ACQUISITION_ENABLED=true`, `IA_SUPPRESSION_KEY` (32+ characters, generated locally, escrowed: losing it means opt-outs can no longer be matched) and `IA_SUPPRESSION_KEY_ID`. Blank every provider key (OpenAI, Places, SMTP, WhatsApp and the rest) so nothing live can be reached.
3. **Before starting, print the database host** and confirm it is `127.0.0.1` or `localhost`.
4. Leave off: the Places finder, website crawling, PageSpeed, any AI use, automatic drafting.
5. **Data handling:** the pilot database holds business information about real clinics. Back it up, keep it on the owner's machine, and do not share it. Record only what the clinic published about itself on its own website, and role inboxes or business numbers (no personal names or personal mobile numbers).
6. Enabling the flag with a missing or short suppression key makes every outbound send in RUNVAX return 503. Set the key first.

## 7. Verdict
- **GO:** Stages A to C locally, today, once decisions O-1 and D0 to D1 (in `05-owner-decisions.md`) are made.
- **NO-GO:** any real outreach, until B1, B2, B3, B4 and B5 are resolved.
- **Engineering action needed:** none for the pilot. After the owner approves the offer, one small configuration change enters it into the product (a reviewed change; not done here).
