# Stabilisation and end-to-end readiness

**Date:** 2026-10-17. **Branch:** `feat/industry-acquisition-phase1`, starting from `66acac3`. Local only: nothing pushed, merged, deployed or migrated in production. The feature flag stays off; `autoDraftEnabled` was never turned on outside a disposable test database.

Phase 4 (live integrations) is in [live-integration-readiness.md](live-integration-readiness.md).

## Phase 1: Stabilise

### Root cause of the disk exhaustion and the high CPU: mine, now fixed

| Finding | Evidence |
|---|---|
| A `mysqld` (PID 13636) had run for **3 days 14 hours at ~98% CPU** | `ps`; started 14 Oct 08:30 |
| It was **my own** throwaway test server from the start of this work | Its command line ran from my scratchpad data directory on port 3399, and it matched the background task I was told earlier to stop |
| I had **deleted its data directory without stopping it** | `lsof`: its open files sat in a directory that no longer exists |
| It held a **deleted `error.log` of 33.9 GB** open on both stdout and stderr | `lsof` showed fd 1 and 2 on the same unlinked file |
| That unlinked file kept consuming disk until the process exited | After I stopped the process, free space rose from 3.9 GB to 7.4 GB immediately and to **35 GB** shortly after (APFS reclaims space gradually) |

**What I did:**
- Identified it read-only first (`ps`, `lsof`) and confirmed it was mine before acting.
- Sent SIGTERM. It didn't exit within 15 s, and its data directory no longer existed (nothing to preserve), so I sent SIGKILL.
- **Did not touch** your own Homebrew `mysqld` (PID 1023, 0% CPU), nor any other process.

**The mistake, stated plainly:** I removed a running database's directory. This phase I started and stopped my throwaway server by recorded PID, shut it down gracefully and confirmed it had exited **before** deleting anything. It exited in 2 seconds with a 2 KB log.

**Why the disk looked worse than my footprint:** the rest of the 193 GB used is yours (not mine to delete). Other contributors during the gates: the gitignored `.next` build folder (1.2 GB per build) and a 1.1 GB `~/.npm/_npx` cache, which I left alone.

### Databases and environment
- **Both `.env` and `.env.local` point `DATABASE_URL` at the production host** (`mysql.uk.cloudlogin.co`, database `aievo_prostrack`). Nothing I ran used them: every command used an overridden local URL.
- Test databases lived only in my own throwaway servers, which are now deleted.
- Your Homebrew MySQL requires a password I don't have, so I could not list it. I never connected to it.

### Results (final run, after all changes)

| Check | Result |
|---|---|
| Clean `npm ci` | passed (32 GB free) |
| `tsc --noEmit` | clean |
| Vitest on Node 20.20, 22.23, 24.22 | **588 / 588 on each** |
| `next build` on Node 20 / 22 / 24 | passes on all three |
| Real-MySQL integration suite | **18 / 18** (5 files, includes the new isolation test) |

### The flaky tokenizer test: environmental, not a regression
- **Test:** `lt run (1.5 MB) under 1000 ms`, a wall-clock check on the HTML tokenizer (unchanged since Phase 2B).
- **Failures seen:** 1.06 to 1.39 s on Node 20 and 24, in parallel runs, while the machine was loaded (load average up to 14.7, a runaway `mysqld`, disk full).
- **Isolation:** it passed 3 of 3 alone, and in a serial run.
- **Measured, on a calmer machine:** a median of about 330 ms (Node 20), 280 ms (22) and 184 ms (24).
- **Scaling:** doubling the input doubles the time (ratios 1.8 to 2.1 on all three), so the scanner is **linear**. The original quadratic bug quadrupled per doubling and used about 10 s.
- **What I changed:** the checks now measure the process's **CPU time** instead of wall-clock. **The limits (250 ms and 1000 ms) are unchanged.** CPU time can't be inflated by other processes, but a quadratic scanner would still burn roughly 10 s of CPU, so the checks stay effective.
- **Honest caveat:** I tried to reproduce the flake on demand with 10 busy-loop processes and could **not**. The old test passed under that load too, so I have no empirical proof the change fixes it, only the reasoning above. After the change, all parallel runs on Node 20, 22 and 24 passed.

## Phase 2: Isolation from existing RUNVAX automation

### What the trace found

| Existing path | Can create outreach drafts? | Reached engine clinics before the fix? |
|---|---|---|
| Rex daily cron (`prepare-drafts`) | Yes | **Yes** if `autoDraftEnabled` is on |
| Atlas "reactivate cold leads" (explicit click) | Yes | **Yes**, once a clinic was idle 14 days |
| Atlas "follow up interested" | Yes | Only if a clinic was moved to interested/proposal by hand |
| Existing task handlers (`detect_opportunity`, `draft_outreach`) | Yes | Yes, for any prospect handed to them |
| Campaign cron, auto-prospect | Yes | **No**: they dedupe on `businessId` and tag only *new* rows |
| Dashboard, assistant context, stats, Pipeline | No (display only) | Visible, but they take no action |
| Email and WhatsApp sending | Human-initiated from modals | Not automated; the email routes now require sign-in |

### Proven on real MySQL, fail-first
With the three code changes **reverted** (tests kept), the new tests failed:
- Rex queued **6** prospects instead of 4. The two extra were engine clinics, **including the suppressed one**.
- Atlas counted **8** cold prospects instead of 5.
- The task handlers drafted messages for engine clinics.

With the fix, all pass. Four further tests pass either way and guard unchanged behaviour: Rex's cron authentication, ordinary prospects still being drafted for, and the SQL fact below.

### The fix: 11 added lines in 3 existing files
- `src/lib/acquisition/isolation.ts` (new, imports nothing): `ACQUISITION_SOURCE`, `notAcquisition`, `isAcquisitionProspect`.
- `cron/prepare-drafts/route.ts`, `lib/atlas.ts` (cold leads and stale interested), `lib/tasks/handlers.ts` (both handlers).
- **A subtlety the fix had to respect:** ordinary prospects have `source = NULL`, and in SQL `NULL != 'x'` is not true. A bare `source: { not: ... }` would have **silently dropped every ordinary prospect from Rex and Atlas**. The fix is `source IS NULL OR source != 'industry-acquisition'`. The real-MySQL test demonstrates the pitfall and proves ordinary NULL-source, `manual`, `campaign` and `auto-prospect` prospects are all still processed.

### Requested guarantees

| Guarantee | How it is shown |
|---|---|
| Ordinary RUNVAX prospects continue through established workflows | Real MySQL: all four ordinary source types queued by Rex; five ordinary cold leads drafted by Atlas; `draft_outreach` still drafts; `detect_opportunity` still analyses |
| Acquisition prospects cannot trigger unintended outreach | Rex, Atlas and both handlers exclude or skip them (`acquisition_prospect`); `composeOutreach` is never called for them |
| Suppressed prospects remain blocked | A suppressed engine clinic is excluded from all three paths. Before the fix Rex queued it |
| Authentication, billing, messaging unchanged | Rex still returns 401 without the secret. **No auth, billing, email, WhatsApp, middleware or schema file was touched.** The baseline email-route tests pass |
| A future draft-creating path can't slip by | A tripwire test lists every file that creates outreach drafts (today `atlas.ts` and `tasks/handlers.ts`) and fails if a new one appears without the isolation rule |

### Remaining isolation facts (decisions for you; not changed)
1. **Manual outreach from the Pipeline.** Engine clinics still appear in the existing Pipeline and CRM counts (display only). An admin could open one and use the existing email or WhatsApp modals, which **bypass the acquisition gate and suppression**. That's a human action, and I didn't change CRM behaviour. Options: leave it, add a warning badge on engine rows, or hide them from the Pipeline.
2. An opt-out recorded in the engine does **not** mark the clinic in the CRM.
3. `autoDraftEnabled` is now safe for engine clinics, but I'd still keep it off for the pilot admin.

## Phase 3: Minimum viable workflow

**Inventory (against intake → qualification → analysis → recommendation → pitch):** everything exists except two small, pilot-blocking gaps. I built only those, reusing existing code, with no schema change and no new screens:

| Gap | What I built |
|---|---|
| Evidence entry took about 6 form submissions per clinic (found in the browser) | One **checklist** for all observations, **one submission, one audit**. Same safeguards: the clinic's own domain, attestation, no duplicates, masked note. The single-signal API still works |
| You only learned why a pitch couldn't be made after clicking Generate | A **readiness checklist** on the clinic profile: eligible state, offer recommended, enough observed evidence, a clinic email contact, not suppressed, and whether the offer is approved. It shows which evidence would help |

**Readiness is trustworthy by construction:** it uses the *same loader and the same rules* as generation (I refactored generation into a shared function), writes nothing, and a test compares readiness to the real result for every synthetic clinic, one to one.

**Still partial:** post-contact qualification answers exist only as ≤500-character notes on reply or meeting outcomes. Named contacts have no screen. Both are fine for a role-inbox pilot.

## Phase 4 and the shortest path to a pilot
See [live-integration-readiness.md](live-integration-readiness.md). In short: **neither OpenAI nor Places is wired into the engine**, and the shortest controlled pilot needs neither. It needs the owner's offer approval, a legal opinion on outreach, an approved production migration and key setup, and a manual send of about 10 pitches.

## Tests added or changed
- `tests/integration/isolation.test.ts` (new, real MySQL, 7 tests)
- `tests/acquisition/isolation.test.ts` (new, 7 tests)
- `tests/acquisition/prep-workflow.test.ts` (new, 8 tests)
- `tests/ui/acquisition-ui.test.tsx` (+4 tests)
- `tests/acquisition/p0-hardening.test.ts` (timing method changed; limits unchanged)
- `tests/helpers/fakePrisma.ts` (added the schema's `startedAt` default for agent runs)
