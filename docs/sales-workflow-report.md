# Dental sales workflow: completion report

**Date:** 2026-10-14. **Branch:** `feat/industry-acquisition-phase1` (local only; not pushed, merged or deployed).

**Boundaries kept:**
- feature flag off;
- no live fetch, DNS, Places or provider call;
- no model call;
- nothing sent;
- no production access;
- synthetic data only.

## 1. What is implemented

| Requirement | Status | Where |
|---|---|---|
| **AI Receptionist offer configured, unapproved** | ✅ Problem, outcomes, capabilities, scope / exclusions, evidence requirement, prohibited claims and pitch parts are recorded as a **proposal**. `status: unconfigured`, `approvalState: proposed_unapproved`, pricing `unapproved` with no amount. Zero approved claims. The schema refuses an approved offer without owner approval, an amount on unapproved pricing, and an approved claim that contains a prohibited phrase | `config/catalogue.ts`, `config/schema.ts`, `docs/offer-ai-receptionist-proposal.md` |
| **Deterministic pitch generation (no model)** | ✅ Fixed templates. Only *observed*, fresh (≤180 days) weaknesses in the offer's evidence categories are put into words, as "I couldn't find…". Inferred and unknown signals are listed for the reviewer and never stated. The draft has a personalised opening, offer relevance, one CTA, a sign-off and an opt-out line. Generation **refuses with reasons** when evidence is insufficient, there is no or a suppressed recipient, the prospect isn't strategized, or the recommendation differs | `pitch.ts` |
| **Version binding** | ✅ Each draft records:<br>• the cited signal IDs and their content hash (excluding `lastVerifiedAt`, so re-seeing a fact changes nothing)<br>• the offer-config hash and version<br>• the industry-config version | `draftEvidence.ts`, `drafts.ts` |
| **Invalidation** | ✅ A draft becomes **stale** when:<br>• a cited signal is superseded, removed or past freshness<br>• a cited finding disappears<br>• the offer config changes<br>• the recommendation changes<br><br>It becomes **blocked** when the recipient or domain is suppressed or the prospect is inactive. This runs:<br>• after audit and strategize<br>• after manual evidence<br>• before every approve or mark-ready<br>• on every queue read<br><br>When a draft goes stale or blocked, the prospect is rewound to `strategized` | `drafts.ts`, `research/handlers.ts` |
| **Human review queue** | ✅ List (validity re-checked live) and detail (text, cited evidence per sentence, inferred / unknown, history). Actions: **edit** (new version, withdraws approval), **approve** (wording; runs the gate's content rules), **reject** (reason required), **mark ready**, **regenerate** (supersedes). Every decision is an append-only `AcquisitionApproval` row with reviewer, timestamp, text hash, evidence hash and offer hash | `drafts.ts`, `/acquisition/drafts`, `DraftReview.tsx` |
| **"Ready" can't be reached by an invalid draft** | ✅ `mark_ready` requires all of:<br>• status `approved`<br>• current evidence, offer and recommendation<br>• a latest approval bound to this exact text, evidence and offer<br>• every rule of the existing delivery gate passing<br><br>Only the three delivery-time rules (sender identity, live sending, daily cap) are deferred, and they're still shown. Rejected, stale, unapproved or insufficiently evidenced drafts, and drafts for unapproved offers (`offer_unconfigured`), are refused with reasons | `drafts.ts`, `gate.ts` |
| **Existing gate and security reused** | ✅ Same `evaluateDraftGate` / `checkDraftForDelivery`, same `requireAcquisitionAccess(req)` (flag → 404, admin allowlist, suspended → 403, same-origin mutations, suppression key) and the same suppression service. No new mechanism | routes under `src/app/api/acquisition/` |
| **Sales-outcome tracking (manual)** | ✅ Recording-only outcomes:<br>• sent (ready draft only, re-checked at recording, attested)<br>• reply (positive / neutral / negative)<br>• opt-out<br>• objection<br>• meeting booked<br>• proposal sent (amount + currency)<br>• won (value + currency + reason)<br>• lost (reason)<br><br>The existing lifecycle edges are enforced, so out-of-order outcomes are refused | `outcomes.ts`, new `AcquisitionOutcome` table |
| **Opt-out is effective** | ✅ Opt-out and objection, in any state, including before anything was sent:<br>• keyed suppression of the recipient email and phone, plus the clinic domain (always for an objection; for an opt-out from a clinic inbox)<br>• pending tasks cancelled and drafts blocked<br>• prospect moved to `suppressed`<br><br>It refuses if there's nothing to key the suppression on. Afterwards, generation, contact storage and the gate all refuse | `outcomes.ts` |
| **Funnel metrics** | ✅ Distinct prospects per step, replies by latest sentiment, opt-outs and objections, proposal / won values per currency, and rates. Recorded outcomes only, labelled as such. Shown as an Overview card | `funnelMetrics`, `/api/acquisition/metrics` |
| **Manual observed evidence** | ✅ Website-observable signals only. The page must be on the prospect's own domain, attestation is required, and the note is masked (≤300 chars). It feeds re-audit and re-score through the queue and invalidates drafts immediately | `evidence.ts`, `PitchPanel.tsx` |

**Deliberately not done:**
- **The CRM `Prospect` row is not updated with outcomes.** Its `stage` drives existing RUNVAX automation:
  - Rex auto-drafts for `found`;
  - Atlas suggests follow-ups for `contacted`, `interested` and `proposal`.

  Mirroring outcomes there would feed engine prospects into those flows. The acquisition lifecycle and pipeline events (existing) plus `AcquisitionOutcome` (new) hold the history instead.
- No delivery adapter, automatic follow-up, reply detection or sending.

## 2. Files changed and why

### New

| File | Why |
|---|---|
| `src/lib/acquisition/pitch.ts` | Pure template generator and refusal rules |
| `src/lib/acquisition/draftEvidence.ts` | Evidence / offer hashing and current-evidence check |
| `src/lib/acquisition/drafts.ts` | Generation, validity, invalidation, blocking, review actions, list / detail |
| `src/lib/acquisition/evidence.ts` | Manual observed-evidence entry |
| `src/lib/acquisition/outcomes.ts` | Outcome recording, opt-out / objection suppression, funnel metrics |
| `src/app/api/acquisition/prospects/[id]/{drafts,evidence,outcomes}/route.ts` | Gated POST routes |
| `src/app/api/acquisition/drafts/route.ts` | Gated GET (queue) |
| `src/app/api/acquisition/drafts/[id]/route.ts` | Gated GET (detail) |
| `src/app/api/acquisition/drafts/[id]/actions/route.ts` | Gated POST (review actions) |
| `src/app/api/acquisition/metrics/route.ts` | Gated GET (funnel metrics) |
| `src/app/acquisition/drafts/page.tsx` | Review queue |
| `src/app/acquisition/drafts/[id]/page.tsx` | Review screen |
| `src/app/acquisition/_components/DraftReview.tsx` | Review UI |
| `src/app/acquisition/_components/PitchPanel.tsx` | Pitch generation and evidence UI |
| `prisma/migrations/3_sales_workflow/{migration.sql,down.sql}` | Additive migration and manual rollback |
| `docs/offer-ai-receptionist-proposal.md` | Owner-review document |
| `docs/sales-workflow-report.md` | This report |
| `tests/acquisition/{pitch,sales-workflow,sales-api,migration3-sql}.test.ts` | Unit, workflow, route and migration-guard tests |
| `tests/integration/sales.test.ts` | Real-MySQL test of the workflow |

### Modified

| File | Change |
|---|---|
| `prisma/schema.prisma` | Draft / approval binding columns, `AcquisitionOutcome`, relation fields; status / action comments |
| `config/schema.ts` | Optional offer `proposal`, `evidenceRequirement`, `prohibitedClaims`, `pitch`, plus the refines above |
| `config/catalogue.ts` | AI Receptionist proposal (unapproved) |
| `gate.ts` | Accepts `ready` as approved. Approvals are stale when evidence or offer hashes differ. Offer-level prohibited claims. Delivery check uses the latest text decision, includes the domain in its suppression lookup, and loads the business name with a plain query instead of a nested `include` |
| `research/handlers.ts` | Invalidate stale drafts after audit and strategize |
| `contacts.ts` (`eraseContacts`) | Erases draft text and recipient, and redacts review and outcome notes |
| `admin.ts` | Domain suppression blocks drafts; overview "sending" label |
| `http.ts` | Maps `DraftError` / `TransitionError` to 400 |
| `tasks/handlers.ts` | Registry calls research handlers lazily. This fixes a latent import cycle (research → contacts → queue → registry) that, depending on import order, left handlers undefined. It surfaced in this phase's tests |
| `ProspectDetail.tsx` | Pitch and evidence section; note text |
| `format.ts` | `apiResult` (keeps 422 refusals) |
| `page.tsx` | Funnel card; copy |
| `scripts/rehearse-acquisition-migration.sh` | Covers migration 3 and its rollback |
| `docs/database-migrations.md` | Migration 3 section |
| `tests/acquisition/{boundaries,api,gate}.test.ts`, `tests/ui/acquisition-ui.test.tsx` | Boundaries updated: drafts are created only by `drafts.ts`, still no delivery, still no outreach-phase tasks. Gate fixture claim changed because "24/7" is now prohibited. New UI tests |

**Not modified:** outreach, email, WhatsApp, billing, auth, cron and middleware code.

## 3. Verification (actual results)

| Gate | Result |
|---|---|
| `npm ci` | exit 0 |
| `tsc --noEmit` | exit 0 |
| Vitest, Node 20.20.2 / 22.23.3 / 24.21.0 | **25 files, 520 tests passed** on each (was 21 / 460 before this phase) |
| Integration suite (real MySQL 9.4.0, throwaway `127.0.0.1:3399`) | **3 files, 7 tests passed** (includes the new sales workflow) |
| `next build`, Node 20 / 22 / 24 | exit 0 on each (dummy `DATABASE_URL`); all new routes are dynamic |
| Protected files | No change in the working tree |

Requested test coverage:

| Requested | Covered by |
|---|---|
| Accurate attribution | `pitch.test.ts` › evidence attribution; `sales-workflow` › binds the draft… |
| No unsupported claims | `pitch.test.ts` › no unsupported claims; an edit adding a claim can't be approved |
| Insufficient evidence blocks | `pitch.test.ts` › refusals; Glow / Ivory refused in the workflow |
| Unapproved offer can't be ready | "the real (unapproved) offer…" (workflow, integration, UI) |
| Edit invalidates approval | "an edit withdraws approval…"; "a text change made outside the review flow…" |
| Evidence change invalidates | Manual contradicting evidence; re-audit removing evidence; offer-config change. Re-confirming the same evidence does **not** invalidate |
| Admin-only | `sales-api.test.ts` (non-admin, suspended, cross-origin) plus the generic sweep over every route in `api.test.ts` / `access.test.ts` |
| Opt-outs block outreach | Opt-out after send, objection before send, domain suppression, erasure |
| Accurate funnel metrics | "lifecycle events produce accurate funnel metrics" |

The ready path is proven with a **hypothetical, test-only owner approval** applied in memory and restored after each test. The real catalogue is asserted to stay unapproved.

## 4. Migration and rollback evidence

Migration `3_sales_workflow` is additive:
- 9 nullable columns on two acquisition tables;
- 1 new table, with FKs to `User` and `AcquisitionProspect`.

Rehearsed on a fresh throwaway MySQL 9.4.0 (scratchpad datadir, `127.0.0.1:3399`, deleted afterwards) with `scripts/rehearse-acquisition-migration.sh`:
- baseline refusal (P3005), then deploy of 1–3;
- **no drift**;
- existing table definitions and row counts **identical**;
- outcome FK enforced, with a synthetic outcome, draft and approval written;
- **rollback of 3** matches the Phase 2 schema exactly, and the draft row is kept;
- rollbacks of 2 and 1 match their earlier schemas, with existing rows intact;
- re-apply with no drift.

**All checks passed.**

**Rollback steps:**
1. Export `AcquisitionOutcome`.
2. Run `3_sales_workflow/down.sql`.
3. Delete the migration's `_prisma_migrations` row.

Nothing was applied to production.

## 5. Limitations and risks

1. **Legal: outreach is not assessed.** The LIA covers research only. Recording "sent" assumes someone delivers the text outside RUNVAX. That must not happen until a qualified opinion answers Q-N1, Q-N2 and Q-N4 (*Onimisi v. GTCO* 2026; consent vs legitimate interest for B2B email to role inboxes and named staff).
2. **The offer content is engineering-proposed**, not Harzotech's. "Is preparing an AI Receptionist" may be inaccurate either way.
3. **Human edits are checked only by pattern.** The gate catches claim-like language, prohibited phrases, placeholders, length and the opt-out line. It can't verify a new *factual* statement a reviewer types. The approver is responsible.
4. **No four-eyes rule.** The same admin can edit and approve.
5. **"I looked at…" wording.** For crawler-observed evidence, the observer was the bot. The reviewer should open the cited page before approving. Approval implies they stand behind it.
6. **"Sent" is attested, not verified.** RUNVAX can't confirm that the text delivered outside matched the approved text, or when.
7. **Opt-out scope for a named contact.** Only that person's email and phone are suppressed, not the clinic's domain. This is a judgement call for legal review.
8. **Existing-automation interaction (protected code, not changed):**
   - The existing `cron/prepare-drafts` (Rex) selects CRM prospects with `stage='found'`, `outreachSentAt=null` and `autoDraftEnabled`. Engine-created prospects match, so it could create WhatsApp `OutreachDraft`s that bypass this gate.
   - Atlas can suggest reactivating `found` / `contacted` prospects.
   - **Mitigation now:** keep the admin account's `autoDraftEnabled` off for any pilot.
   - **Proper fix (separate approval):** exclude `source='industry-acquisition'` in those selectors.
9. **Amounts** are whole currency units in a 32-bit `INT` (max about 2.1 billion).
10. **Validity is re-checked on every queue load** (≤100 drafts, a few queries each). That's fine for a pilot, not for large volumes.
11. **Metrics are per admin account and from manual entries only.** Reply sentiment is the reviewer's judgement, and the latest reply per prospect counts.

## 6. Single best next step

**Get the qualified Nigerian data-protection opinion on outreach (LIA Q-N2, with Q-N1 / Q-N4).** At the same time, have the business owner correct or approve `docs/offer-ai-receptionist-proposal.md`.

Everything built here stops at "ready". Whether any pitch may lawfully be delivered, and in what form (role inbox only, consent first, or not at all), decides whether the next phase is a delivery adapter or a redesign. The owner's offer approval is the other unblocker, and needs no code.
