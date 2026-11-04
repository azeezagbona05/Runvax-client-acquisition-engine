# Agent Command Centre: what was built, what it shows, what is still missing

**Date:** 2026-10-17. **Branch:** `feat/industry-acquisition-phase1`, built on `8b0efec`. Local only: nothing pushed, merged or deployed, flag off by default.

**Scope kept:**
- No new agents, live discovery, scheduler, AI or outreach integration.
- No schema or migration change. Everything shown comes from rows the queue already saves.
- No change to the existing discovery engine, CRM, email, WhatsApp, billing, auth or cron code.

## 1. The agents, as they really are

| Agent | Real state | Task type(s) |
|---|---|---|
| Discovery | **Disabled.** The task always skips (`places_disabled`). No Google Places connection exists | `acq.discover` |
| Contacts | **Rule-based, limited.** Keeps imported contacts. Reads a site only if website fetching is on (it is off) | `acq.research_contacts` |
| Website audit | **Rule-based, limited.** Derives findings from recorded signals, including evidence entered by hand. Site reading is off | `acq.audit` |
| Strategy | **Rule-based, works.** Deterministic score and offer recommendation | `acq.strategize` |
| Outreach | **Manual, not a queue agent.** Its task is a no-op. Pitches are generated on request from fixed templates | `acq.draft_outreach` |
| Follow-up | **Not built.** Tasks are no-ops | `acq.classify_reply`, `acq.follow_up` |
| Qualification | **Not built.** Task is a no-op | `acq.qualify` |

No model is called anywhere in the acquisition engine, so none of these is described as AI.

## 2. What the screens now show

| Requirement | Where | Notes |
|---|---|---|
| One card per agent: purpose, real capability, state, limitation | **Overview → Agents** | States: running, last run failed, work queued, waiting to retry, idle, disabled, manual, not implemented |
| Current task, last run, recent activity, links to clinics | Agent card | "Nothing is executing" is stated explicitly |
| Clinics processed, findings, contacts | Agent card | Only recorded figures. A metric with no record reads **unavailable** (for example "Model, tokens, cost" for rule-based agents) |
| Skips with reasons, failures with actionable errors, next action | Agent card | Next action is derived from real queue counts |
| Queued vs executing vs completed vs waiting | Badges everywhere | Queued, Waiting to retry, Retry due, Running, **Running (lease expired)**, Completed, Skipped, Attempt failed, Failed permanently, Cancelled |
| Clickable activity rows | **Activity tab** | Table on desktop, compact cards on phones. Status filter. Queued tasks included |
| Task details | `/acquisition/tasks/[id]` | ID, type, agent, clinic, status, attempts, timestamps, duration, sanitised input and output, skip reason, error, **attempt-by-attempt retry history**, parent and queued-next tasks, links to the clinic and its audit trail |
| Per-clinic task history | **Clinic profile → Task timeline** | One chronological list. **Agent executions** (purple), **queued tasks**, **clinic state changes** and **recorded admin actions** carry different labels |

Fields the database doesn't hold are shown as unavailable and never filled in:
- the task's own start time (taken from its first attempt, otherwise unavailable);
- a duration for a task that never ran;
- evidence references for handlers that record none;
- model, provider and cost.

**Sanitising:**
- Secrets in errors and output are redacted (tokens, `Bearer`, URL credentials, passwords).
- Fields named like secrets are hidden (`apiKey`, `token`, `password`, and so on).
- Phone numbers and email addresses are masked.
- Output is bounded in size and depth.

## 3. How "Run queue now" really behaves

Verified from the code, the browser and a **real MySQL** integration test:

- **Sequential within one press.** Tasks are claimed oldest-first and executed **one at a time**, up to the per-press budget (**10** by default, max 50). Four clinics need 12 chained tasks: the first press claimed 10, the second claimed the remaining 2 (observed in the browser).
- **Chained tasks** (contacts → audit → strategize) are queued as each task finishes, so they can run in the same press if the budget allows.
- **Failures are saved.** A failed attempt records an error-bearing run and puts the task back with a retry time (10, 20, 40 minutes, capped at 2 hours). After 3 attempts the task becomes **dead**. Errors are redacted before saving.
- **Concurrent presses are safe.** Two presses at once run concurrently, each claiming different tasks. The claim is atomic. Real MySQL test: 8 tasks, two simultaneous runs, **each task executed exactly once**, and neither run ever executed two tasks at once.
- **A runner that dies** leaves a task "running" with an expired lease. The next press resets and retries it (tested on real MySQL). The UI labels it **Running (lease expired)** and does not call it running.
- **Not scoped to the person pressing the button.** The runner takes any account's pending tasks. Only admins have acquisition tasks today, so this makes no practical difference.
- **Daily cap:** 200 tasks per Africa/Lagos day, shared platform-wide.
- **No scheduler.** Nothing runs unless someone presses the button. The page is a snapshot with a Refresh button, not a live feed.
- **A skipped task is recorded as a "succeeded" run.** The screens take the outcome from the task's real state, so a skip is never shown as completed.
- **Per-task timeout 45 s; the route stops at 60 s.** Ten slow tasks could outlast the route on a serverless host. The lease mechanism recovers them. I haven't tested that on a real host.

## 4. Browser evidence (headless Chrome, throwaway local database, synthetic clinics)

Screenshots are in `docs/ui-check/agent-centre/`.

**States produced by the real queue:**
- **Work queued** (before pressing the button), then **completed** tasks.
- A real **skipped** task, created by suppressing a clinic and re-auditing it. Its reason is "The clinic is suppressed".
- The empty states, and the "not found" state.

**States I inserted as clearly labelled synthetic rows.** The real handlers can't fail on demand with the crawler off, so these exercise the display only: **failed permanently**, **waiting to retry**, **running** and **running (lease expired)**. The error text reads "SEEDED", and a fake `Bearer …` token and `password=…` were included to confirm redaction. Nothing leaked.

**Checked at desktop and phone:**
- Overview, Activity, task detail, clinic profile and timeline: no horizontal overflow, and no console errors from the new screens.
- **Permission paths:**
  - Customer: `/acquisition` and task pages redirect to the dashboard, and the three new APIs return 403.
  - Anonymous: the APIs return 401, and the page redirects to login.
  - Unknown task: shows "Not found".
- **Loading, error, empty and permission-denied** states are covered by UI tests.

## 5. Defects found while verifying (all fixed, each with a regression test)

1. A run recorded as "succeeded" was labelled **Completed** even when the task was **skipped**. A task that had **failed permanently** was labelled "Retry due". Both are now derived from the task's real state.
2. A stale-lease task was described as "Running now".
3. The failures list left out tasks waiting to retry after a failure.
4. The secret-hiding rule hid harmless fields such as `industryKey` and `runKey` (found by a test).
5. **Phone layout:** the Activity table pushed status and outcome off screen. Each task now renders as a compact card on phones.
6. Agent descriptions repeated their own label ("Rule-based, no AI. Rule-based, no AI…").

## 6. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| Vitest, Node 22.23 and 24.22 | **569 / 569** |
| Vitest, Node 20.20, serial | **569 / 569** |
| Vitest, Node 20.20, default parallel | **568 / 569**: see the note below |
| Integration suite, real MySQL 9.4 | **11 / 11** (includes the new queue and observability test) |
| `next build`, Node 20 / 22 / 24 | passes on all three |
| Existing baseline and acquisition tests | all pass |
| Changed files | acquisition code, tests and docs only. No schema, migration or protected RUNVAX file |
| `npm ci` | passed earlier in this sprint, skipped on the final run because the disk was nearly full and dependencies hadn't changed |

**The one failing test:** `lt run (1.5 MB) under 1000 ms`, a wall-clock check on the HTML tokenizer, fails in the default *parallel* run on Node 20 only (1.06 to 1.25 s against the 1.0 s limit). It passes alone and in the serial run, and it passed on 22 and 24. The tokenizer hasn't changed since Phase 2B. The machine was under heavy load: your own Homebrew `mysqld` was using 99% CPU, and the disk was at 100%. I judge it a load-sensitive timing check, not a regression, but I didn't edit it. Consider loosening that threshold (a quadratic regression took about 10 s, so 3 s would still catch it).

**A disk-space incident:** during the gates the disk filled (1.1 GB free), and one build failed with `ENOSPC`. I freed my own throwaway database and the gitignored `.next` build folder, then re-ran the gates. You may want to clear more space.

## 7. What is still missing (documented, not disguised)

- **Scheduler:** nothing runs automatically.
- **Discovery:** the agent is disabled. No Places connection exists. Clinics enter by CSV or manually.
- **Live website research:** the crawler is off, so contacts and audit work only from imported and hand-entered data.
- **AI:** none anywhere. No model, no reasoning.
- **Follow-up, qualification** and an outreach *queue* agent: not built.
- **Live progress:** the Overview is a snapshot. A press runs inside one request, so a "Running" row is only visible if another tab or someone else is mid-run.
- **Stored per run:** the saved run doesn't hold its own output or skip reason. Those live on the task and reflect its last attempt, so a retried task's earlier attempts show only an error.

## 8. Open risks

- The engine's clinics are still written into the existing CRM as stage `found`. Rex would draft WhatsApp messages for them if `autoDraftEnabled` were on. Keep it off. The fix (excluding `source='industry-acquisition'`) is protected code and needs your approval.
- The "Clinics processed" and "Findings on file" figures are counts of completed tasks and current rows. They are true but not per-run, and are labelled accordingly.
