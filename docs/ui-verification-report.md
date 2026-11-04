# Dental Acquisition OS: current-state verification (browser + regression)

**Date:** 2026-10-15. **Branch:** `feat/industry-acquisition-phase1`. **Inspected at:** `ebe19fb` ("Sales workflow…"), plus this sprint's fixes (committed on top). Nothing pushed, merged or deployed.

**How it was run:**
- Local Next.js dev server in headless Chrome, against a throwaway local MySQL (`127.0.0.1:3399`, deleted afterwards).
- Process env overrode the production `.env`: local `DATABASE_URL`, and OpenAI, Google, SMTP, Paystack, Resend and other keys blanked. I checked no remote connections were open.
- Synthetic clinics only (`*-fixture.ng`). Nothing was sent, fetched or contacted.
- Screenshots: `docs/ui-check/` (9 files).

## 1. What actually exists

| Area | Status (verified in a browser) |
|---|---|
| Overview | ✅ Works. Counts, funnel, queue, budgets, live-access switches |
| CSV import / manual add | ✅ Works: preview → attest → create. A changed file is re-checked (a suppressed clinic was rejected, an existing one flagged duplicate). A byte-identical file returns the earlier batch (wording fixed) |
| Run research queue | ✅ Works (manual button). With the crawler off, every clinic ends at **0% coverage / "Insufficient evidence"** |
| Manual observed evidence | ✅ Works; this is the **only** way to get evidence today |
| Re-score from evidence | ⚠️ Was **broken** (the rescore was silently dropped); fixed this sprint, see section 3 |
| Prospect profile | ✅ Renders fully: score, rule breakdown, recommendation, evidence, findings, contacts, sources, audit trail |
| Pitch generation | ✅ Works once the clinic has enough observed evidence; refuses with reasons otherwise |
| Review queue and draft review | ✅ Edit, approve, reject, regenerate work. **"Mark ready" is refused** for the real (unapproved) AI Receptionist offer, as designed |
| Outcomes | ✅ Opt-out verified: draft blocked, prospect suppressed, email and domain suppressed, funnel updated, new pitch refused. Out-of-order outcomes ("reply" before "sent", "sent" before "ready") refused with reasons |
| Reaching **sent → reply → meeting → proposal → won** | ❌ **Not reachable in the app today**: it needs a "ready" draft, which needs an owner-approved offer. Verified by automated tests only (including real MySQL), not in a browser |
| Google Places discovery, live website research, OpenAI, sending, follow-ups | ❌ Disabled or absent (by design) |

**Realistic effort today:** to get one pitch for one clinic, an admin must import it, run the queue, type evidence one signal at a time (about 6 form submissions), run the queue again, generate, review, and then copy the text out by hand. Without a live crawler this is more work than writing the email directly.

## 2. UI/UX findings and fixes

**Verdict:** the layout is clean and navigable on desktop and phone, with no horizontal overflow on any acquisition screen. The defects were readability and workflow gaps, not structure.

| # | Defect found | Fix |
|---|---|---|
| 1 | **Light-theme contrast:** the "not approved for sale" notice, warning bullets, "Observed/Inferred" badges, red "Reject" label and "accepted/duplicate" text were pale-on-light and nearly invisible; text areas rendered as a dull grey box | Scoped CSS (`.acq-scope` wrapper, light mode only; 16 lines in `globals.css`). No other page affected |
| 2 | Review actions could be clicked while a request was still running | Buttons disabled while busy |
| 3 | Success confirmations vanished after any action that changes status (e.g. you never saw "suppressed: email, domain") | Message passed up so it survives the reload |
| 4 | "Decision history" empty with no message | "No decisions recorded yet." (and a note for blocked drafts) |
| 5 | The review queue was only reachable via a small link; no count of drafts awaiting approval | "Review queue" link in the tab bar, "N pitches awaiting your approval" line on Overview |
| 6 | After saving evidence the page said "run the queue", a button on another tab | "Run queue now" button right there |
| 7 | Re-uploading an identical CSV showed stale "accepted" results beside "Nothing has been created yet" | Honest message: already imported, nothing re-checked |
| 8 | Evidence table not scrollable on a phone; timestamps broke mid-word | Wrapped; no-wrap dates |

Not fixed (minor or existing RUNVAX): the mobile bottom nav has no Acquisition entry (use the URL). A regenerated draft's version number skips after an edit. The existing "Getting started" floating widget overlaps content. The existing `/admin` page logs a React key warning.

## 3. Functional bugs found by using it (fixed, each with a regression test)

1. **Manual evidence never re-scored a clinic.** The audit's chained rescore had the same input as the first one, so the queue's idempotency key dropped it. A clinic with 11 observed weaknesses stayed "1/100, no offer". This also affected the existing **Re-audit** button. Fix: the audit passes its `runKey` on. Result in the browser: Coral went from 1 to **36 (medium), 83% coverage, AI Receptionist, high confidence**.
2. **A fresh "unknown" could hide a manual observation.** Scoring picked the most recently verified signal per code, so a re-audit of an unreadable site would override evidence entered by hand. Fix: an observation is never shadowed by an "unknown". Not triggered today (crawler off), but it would be once a crawler runs.
3. **Approve could race an edit.** Approve clicked while an edit was saving stamped the *old* text hash on a draft with *new* text. The gate's stale-approval check still stopped "ready", but the state was inconsistent. Fix: every review status change is conditional on the draft version the reviewer saw.

## 4. Existing RUNVAX regression

**Verified:**
- **Diff vs `main`, every changed existing file reviewed:**
  - `send-email` route: now requires sign-in and refuses suspended accounts.
  - `proposal/send-email` route: now requires sign-in and the `proposals` plan feature. Anonymous callers get **401** (tested live); signed-in callers were not tested with a real send.
  - `middleware.ts`: gates `/acquisition`.
  - `Sidebar.tsx`: admin-only link. *This file, plus `package.json` and `.env.example`, was missing from my earlier "three files" answer.*
  - `globals.css` (this sprint): 16 scoped lines.
- The only callers of the two email routes are signed-in modals.
- Customer account: dashboard, Find Prospects, Pipeline and Settings load with no console or network errors. `/acquisition` redirects to the dashboard, there is no Acquisition link, and the acquisition APIs return 403.
- Admin: dashboard, pipeline and settings load cleanly.
- **Flag OFF** (the production default): `/acquisition` and every `/api/acquisition/*` route return **404** to an admin, and there is no sidebar link.
- Anonymous `/acquisition` redirects to login.
- Automated: 525 tests pass on Node 20.20, 22.23 and 24.22 (including the pre-existing baseline tests). `tsc` and `npm ci` clean. `next build` passes on all three. Integration suite on real MySQL: 7/7.

**Not safely testable here (not claimed as verified):**
- Real email or WhatsApp sending, Paystack billing, OpenAI or Google calls, and lead discovery (keys were deliberately blanked).
- Signed-in sends through the two changed email routes.
- Rex or Atlas executing (the cron needs a secret, and `autoDraftEnabled` must not be enabled). Analysed by reading the code and running its selection logic read-only.
- Behaviour against the production schema or data.

## 5. Isolation risks (still open)

1. **Engine clinics are written into the existing CRM.** Each import creates a `Prospect` row (`source='industry-acquisition'`, `stage='found'`). They appear in the sidebar CRM count and in the admin's regular Pipeline (confirmed in a browser).
2. **Rex (`cron/prepare-drafts`) would pick them up.** It selects `stage='found'` with no outreach sent, for users with `autoDraftEnabled=true`.
   - Run read-only against the local data: the engine prospects match **4 of 4** if auto-draft is on, and **0** as written today (default off).
   - If an admin turned auto-draft on, Rex would queue WhatsApp drafts for these clinics, bypassing the acquisition gate and suppression.
   - Atlas "cold lead" suggestions would also list them after 14 days.
   - **Mitigation now:** keep `autoDraftEnabled` off. **Proper fix** (a separate approval, protected code): exclude `source='industry-acquisition'` in those two selectors.
3. Suppression covers the acquisition tables only. A clinic that opted out is not marked in the existing CRM.

## 6. Recommendation

**Park it behind the flag (flag stays off). Don't add more to it.**

Why:
- The engine works as designed, and the sprint fixed three real bugs. But it cannot yet produce a sale: no live research, no sending, an unapproved offer, and an open legal question about unsolicited B2B outreach in Nigeria.
- Each lead needs manual evidence entry, which costs more than it saves.
- It carries a known CRM and Rex overlap.

Re-open only if both of these happen:
- **(a)** The owner approves the AI Receptionist offer, and legal confirms how, and whether, Harzotech may contact clinics.
- **(b)** A cheap manual test shows demand: send 10 hand-written pitches outside the tool and see whether anyone replies.

If (b) is positive, build the *minimum*: live evidence capture, a send adapter, and the Rex exclusion. Not the full pipeline.
