# Industry Acquisition Engine

An admin-only module for Harzotech's own B2B acquisition, starting with dental clinics in Lagos. It is **off by default** and **sends nothing**: Phase 1 is the foundation only.

## Turning it on (local only until approved)

```bash
INDUSTRY_ACQUISITION_ENABLED=true   # anything else, including unset, means off
```

The module stays closed unless both conditions hold: the flag is on, and the signed-in email is in `ADMIN_EMAILS`.

| Layer | Off | Signed out | Not an admin |
|---|---|---|---|
| `/api/acquisition/*`, via `requireAcquisitionAccess()` | 404 | 401 | 403 |
| `/acquisition` page layout (rendered on every request) | 404 | 404 | 404 |
| `src/middleware.ts` (outer layer) | — | → `/admin/login` | → `/command-centre` |
| Sidebar link | hidden | hidden | hidden |

`tests/acquisition/access.test.ts` fails if any route file under `src/app/api/acquisition/` doesn't call the gate first.

## Layout

```
src/lib/acquisition/
  flag.ts                 feature flag + route gate
  config/schema.ts        Zod schema for industry packs (strict, data only, policy literals)
  config/catalogue.ts     dental offers — all "unconfigured" until approved details exist
  config/industries/      one data file per industry
  config/registry.ts      loads and validates the packs
  lifecycle.ts            prospect states, allowed transitions, recorded events
  tasks/                  isolated queue (AcquisitionTask), task types, handlers
  llm.ts, models.ts       structured-output model calls, model selection, cost estimates
  untrusted.ts            wraps third-party content as data before it reaches a model
  gate.ts                 blocking delivery gate — the only path toward sending
  suppression.ts          opt-out / suppression list
  redact.ts               strips secrets from stored errors
```

## Rules the code enforces

- **Separate queue.** Tasks live in `AcquisitionTask`, not `AgentTask`. The existing drainer (`src/lib/tasks/queue.ts`) and its 15-tasks-per-run budget never see them. `IA_TASK_BUDGET` (default 10, maximum 50) and `IA_TASK_TIMEOUT_MS` (default 45 s) bound each drain.
- **Idempotent.** A task's key is its type, prospect and a hash of its input. Repeating the same work returns the existing task. Pass a different `runKey` in the input to request a deliberate re-run.
- **Bounded retries.** Waits of 10, 20 and 40 minutes between attempts; after `maxAttempts` the task becomes `dead`. Every attempt is an `AcquisitionAgentRun` row recording model, tokens, estimated cost, duration and the redacted error.
- **No free-form state changes.** Handlers return structured, validated output. The prospect's state changes only through `transitionProspect()`, which checks the allowed transitions and records an event. No transition skips `draft_pending_approval → approved`.
- **Model output is untrusted.** It is constrained by OpenAI structured outputs, then validated again with Zod. The model gets no tools and no database access.
- **The delivery gate blocks; it doesn't warn.** `deliverDraft()` is the only send path. It fails unless:
  - the exact current text was approved;
  - the recipient is present and not bounced or conflicting, and not suppressed;
  - the prospect is still active;
  - the draft cites findings that belong to this prospect;
  - the offer is `approved`;
  - there are no unapproved price, guarantee, statistic, outcome, testimonial or timeline claims;
  - there are no prohibited industry phrases and no placeholders;
  - it's within the word limit and has an unsubscribe line;
  - a sender identity with a postal address is configured;
  - live sending is enabled and under the daily cap;
  - and the existing RUNVAX quality gate passes.

  With the shipped dental pack, every draft is blocked: offers are unconfigured, live sending is off and no sender identity exists.

## Adding an industry

1. Copy `config/industries/dental.ts` to a new file and change the data: id, geography, discovery queries, roles, categories (weights must sum to 1), offers, guidance and compliance.
2. Add it to the list in `config/registry.ts`.
3. Run `npx vitest run`. The schema rejects unknown keys, functions, weights that don't sum to 1, references to unknown offers or categories, and any attempt to switch off approval or turn on auto-send.

No engine code changes are needed unless the industry needs a truly new kind of check.

## Phase 2: prospect intelligence (research only)

**Flow:**
1. A CSV or manual import is previewed. Nothing is created until an admin attests and commits.
2. Commit creates a `Prospect` plus an `AcquisitionProspect`.
3. Then `acq.research_contacts` → `acq.audit` → `acq.strategize` run, ending at `strategized` or `needs_review`.
4. Queue runs are manual only: Overview → "Run queue now".

| Area | Where | Rule |
|---|---|---|
| Live access switches | `activation.ts` | Places, live web fetch, PageSpeed, DNS: all `false`; a code change is needed to flip one (tripwire test) |
| Daily budgets | `budget.ts`, `time.ts` | One conditional UPDATE reserves a unit before every call, on the Africa/Lagos day; Places 50/day (hard max 200) |
| Website fetcher | `web/fetcher.ts`, `ssrf.ts`, `robots.ts`, `url.ts` | Honest identity required; `robots.txt` (5xx/403/429/timeout = disallow); public-address check on every hop; size/type/redirect/time limits |
| Extraction | `web/extract.ts` | Deterministic; only role inboxes on the clinic's domain and published business phones; JavaScript-rendered pages give `unknown` |
| Imports | `imports/csv.ts`, `imports/service.ts` | Own CSV parser; Google-sourced rows rejected; named contacts need a lawful basis; suppressed/erased values rejected |
| Duplicates / CRM | `identity.ts` | place_id / domain / phone merge; name+area flagged; branches linked; existing CRM read-only |
| Contacts / erasure | `contacts.ts`, `suppression.ts` | Suppression checked first; SHA-256 tombstones; erasure purges cache, cancels tasks, PII-free event |
| Scoring / offers | `scoring.ts` | `acq-score-v1`, explainable breakdown, coverage and contactability kept separate, "Internal: offer not yet approved for sale" |
| Places | `places/adapter.ts` | No transport; `searchPlaces()` throws; ingestion keeps `place_id` only |
| Admin API / UI | `admin.ts`, `http.ts`, `/api/acquisition/*`, `/acquisition` | Gated per route and method; no outreach controls |

**Running the tests:**
```bash
npx vitest run                     # unit + component suite (in-memory Prisma, no network)
# integration suite: real Prisma against a DISPOSABLE local MySQL on 127.0.0.1:3399 only
TEST_DATABASE_URL=mysql://root@127.0.0.1:3399/runvax_ia_rehearsal npm run test:integration
```

Phase 2B P0 hardening: `docs/phase-2b-p0-report.md`, keys: `docs/suppression-keys.md`.

Related: `docs/phase-2-plan.md`, `docs/places-activation-dependencies.md`, `docs/existing-places-data-assessment.md`, `docs/compliance/dental-pilot-lia.md` (draft), `docs/source-retention-matrix.md`, `docs/crawler-security-review.md`, `docs/phase-2b-hardening-plan.md`.

## Phase status

| Phase | State |
|---|---|
| 1 Foundation | Done locally (branch `feat/industry-acquisition-phase1`); not deployed |
| 2 Prospect intelligence | Steps 2.0–2.6 done locally; synthetic run complete; live access **not** approved; Places **disabled** |
| 3 Strategy and drafts | Not started |
| 4 Conversations | Not started |
| 5 Provider integrations / sending identity | Not started |
| 6 Pilot | Not started |
| 7 Expansion | Covered by "Adding an industry" above |
