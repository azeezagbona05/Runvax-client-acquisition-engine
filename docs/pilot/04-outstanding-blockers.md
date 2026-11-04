# Outstanding blockers and known limitations

**State confirmed on 2026-10-18:** branch `feat/industry-acquisition-phase1`, local only (browser-link gap closed afterwards; see §C). Nothing pushed, merged, deployed or migrated. The feature flag is off and no outreach is enabled anywhere.

This list is split four ways so that nobody mistakes one kind of blocker for another: **engineering is done**; the rest belongs to the **owner**, **counsel** or **production operations**.

## A. Completed engineering (tested locally; nothing in production)

| Done | Evidence |
|---|---|
| Research, scoring, offer recommendation and deterministic pitch drafts; human review queue with approvals bound to the exact text, evidence and offer version; manual outcome tracking and funnel; opt-out blocks everything | `docs/sales-workflow-report.md` |
| Agent Command Centre: every agent's real state, task details, per-clinic timeline | `docs/agent-command-centre.md` |
| Rex, Atlas and the task handlers **cannot** draft for acquisition clinics, including a suppressed one (proven fail-first on real MySQL) | `docs/stabilisation-and-readiness.md` |
| The three existing **server-side** send routes (email, proposal email, WhatsApp API) refuse acquisition clinics (409) and suppressed recipients (403); ordinary prospects unchanged | `docs/pilot-readiness.md` §1 |
| One-step evidence checklist; readiness checklist that matches what generation does | `docs/stabilisation-and-readiness.md` |
| Intake → pitch → approval → recorded sent → reply → meeting → proposal → won exercised **in a browser** on synthetic data | `docs/pilot-readiness.md` §2 |
| Three migrations rehearsed with rollback on throwaway MySQL; runbook corrected to 3 migrations, 19 tables | `docs/database-migrations.md` |
| Last recorded results at `2428528`: 609 of 609 unit tests on Node 20, 22, 24; 18 of 18 real-MySQL integration tests; builds on all three | `docs/pilot-readiness.md` §2 |

*These results were not re-run in this step (documents only).*

## B. Outstanding blockers

| ID | Blocker | Category | Who | What it blocks |
|---|---|---|---|---|
| O1 | Offer decisions: scope, deliverables, implementation, integrations, support, price, approved claims, sender identity, the person who handles enquiries, wording, the 10 clinics, success and stop rules | **Owner** | Owner | Marking any pitch **ready**; recording any pitch as **sent** (`01-owner-decision-sheet.md`) |
| O2 | Offer approval put into product config and deployed | **Owner → engineering** | Owner approves; engineering makes a small change, then a deploy | The same as O1. The config rejects an approval missing any required field |
| L1 | Outreach opinion (Q-N2): may unsolicited B2B email go to clinic role inboxes on legitimate interest, or is consent needed? | **Counsel** | Counsel | **Contacting any clinic.** Open; nothing here treats it as settled |
| L2 | Research basis and personal-data status of role inboxes and business phones (Q-N1, Q-N4) | **Counsel** | Counsel | Holding real clinic data, even before contact |
| L3 | Privacy-notice update (Q-N5): the current policy does not mention prospecting | **Counsel / owner** | Counsel drafts; owner publishes | Real data collection |
| L4 | Remaining questions to be ruled **before the pilot or before scaling** (DPIA Q-N6, NDPC registration Q-N8, cross-border Q-N9, retention Q-N7, backups and erasure Q-N10) | **Counsel** | Counsel | Possibly the pilot; certainly scaling. Counsel decides which |
| P1 | Production approval and a change window | **Production** | Approver | Everything below |
| P2 | Backup taken **and verified** (the backup script has a known caveat to check) | **Production** | Ops | Migrations |
| P3 | Read-only production schema check: drift must be empty | **Production** | Ops | Baselining and migrating |
| P4 | Apply 3 migrations to production | **Production** | Ops | Using the feature at all |
| P5 | Secrets and settings: suppression key (generated, stored, escrowed), admin allowlist, then the flag for the pilot | **Production** | Ops / owner | Using the feature; without the key every acquisition route returns 503 |
| P6 | Merge and deploy the branch | **Production** | Approver | Protection of the send routes in production, and everything else |
| P7 | Named people and a daily routine: who records replies and opt-outs, a daily log check, a stop rule | **Owner / ops** | Owner | A safe pilot (`03-…` Gate 8) |

**No engineering blocker remains for a manual, email-only, 10-clinic pilot** other than the small config change in O2 once the owner approves. Sender identity, a delivery adapter, a crawler, Places, OpenAI and a scheduler are **not** needed.

## C. Browser-opened `mailto:` and `wa.me` links (closed for RUNVAX's own buttons; limits remain)

**Status:** closed in the UI for Industry Acquisition clinics. Details and evidence: `docs/outreach-bypass-closure.md`.

**What changed:** every RUNVAX button that opened a `wa.me` or `mailto:` link now (1) shows a disabled control with an explanation for an acquisition clinic, and (2) before opening anything, asks the server (`POST /api/outreach/check`), which uses the **same** recipient and suppression matching as the three send routes. A stale page, a suppressed contact, or an unsaved search result for an acquisition clinic is refused there. If the server can't be asked, nothing opens.

**What is still true (do not overstate the control):**
- This controls **RUNVAX's own buttons**. Anyone can still message a clinic from their own phone, WhatsApp or mailbox; no software here can stop that, and RUNVAX won't see it. The pilot rule stands: the sanctioned path is the approved text on the review page, sent by hand and **recorded in RUNVAX**; honouring an opt-out after any outside message is a human responsibility.
- `tel:` links are now gated the same way. Copy-to-clipboard and the share sheet are **not** controlled (they hand data to the person, with no recipient to check); Share is hidden for acquisition clinics.
- If `/api/outreach/check` is down, WhatsApp and email-link buttons stop opening for everyone (fail-closed, deliberate).
- Search-page bulk send now reports each refused recipient and why (fixed).
- Disabling the buttons is display only; the click-time server check is the authority.

## D. Other known limitations (accepted for the pilot)

- Acquisition clinics remain **visible CRM rows**: they show in the Pipeline and in CRM counts. This is display only.
- An opt-out recorded in the engine is **per account** and does not mark the clinic in the wider CRM.
- Monitoring is a **manual daily check**; the module has no alerting.
- Evidence entry is manual (the crawler is off). A pitch needs about 5 recorded observations per clinic.
- Only role inboxes are used; named-contact entry has no screen.
- Qualification answers after a reply can only be saved as a 500-character note.
- Provisional retention periods are documented but **not enforced**.

## E. Not verified in this step
Production settings (never read) · whether `NEXT_PUBLIC_SENTRY_DSN` is set in production · the backup script's health · whether production's schema matches · whether the sending mailbox will be accepted by receiving mail servers · what the full privacy policy says beyond what our draft assessment cites · whether the AI Receptionist exists as described.

## Not done, by instruction
No push, merge, deploy, migration, flag change, message or contact with any real prospect. No new agent, integration or UI.
