# Production release checklist: Industry Acquisition pilot

**Status: a plan. Nothing here has been run against production.** Every step that touches production (marked 🔒) needs **explicit written approval before it runs**, and a named person to run it. Engineering has not read production settings, connected to the production database, pushed, merged or deployed.

**Release candidate:** `feat/industry-acquisition-phase1` at or after `2428528` (local only).
**What ships:** 3 migrations that only touch the new acquisition tables (no pre-existing RUNVAX table is altered or dropped); the acquisition module (admin-only, **flag off by default**); the recipient check on the three existing send routes; Rex and Atlas exclusions; 11 added lines in existing automation.
**What does NOT ship active:** no outreach, no scheduler, no website crawling, no Google Places, no AI, no automatic drafting.

**Safety facts that shape the order** (all tested):
- Code and migrations can ship in **either order**. Before the migration, the send-route check treats "acquisition tables not found" as "no acquisition data" and allows the send, so normal sending keeps working.
- With the flag unset, the whole module returns 404.
- Without a valid suppression key, every acquisition route returns **503** and the queue won't start (fail-closed).

## Gate 0: approvals in hand (do not start without these)
- [ ] 🔒 Written approval to change production (named approver, date).
- [ ] Owner decisions complete (`01-owner-decision-sheet.md`) and the approved offer wording agreed.
- [ ] Counsel's outreach opinion received **or** the owner has recorded, in writing, a decision to proceed without it. *(That decision is the owner's, not engineering's. Sending no message needs neither.)*
- [ ] A change window, and one person watching during it.

## Gate 1: release candidate and regression tests
- [ ] Freeze the commit hash; record it: `__________`. The working tree is clean.
- [ ] **Offer configuration:** the approved wording is in `src/lib/acquisition/config/catalogue.ts` *only* if the owner has approved it. Confirm no test-only approval text ("LOCAL TEST ONLY") is present: `grep -n "LOCAL TEST" src/lib/acquisition/config/catalogue.ts` returns nothing.
- [ ] On that commit, record results for each:
  - `npm ci`
  - `npm run typecheck`
  - `npm test` on **Node 20, 22 and 24**
  - integration suite on a **throwaway local MySQL** (`TEST_DATABASE_URL=mysql://root@127.0.0.1:3399/<db> npm run test:integration`), never the production URL
  - `npx next build` on Node 20, 22 and 24, with a dummy `DATABASE_URL`

  Last recorded run (at `2428528`; not re-run since, because the later work is documents only): 609 of 609 unit tests on all three Node versions, 18 of 18 integration tests, all builds pass.
- [ ] **Existing-workflow regression** is part of those runs: the CRM, Rex, Atlas, email and WhatsApp baselines and the real-MySQL isolation test. Record that they pass. *No message is sent by any test.*
- [ ] Stop if any test fails. Investigate; do not skip.

## Gate 2: backup 🔒
- [ ] Take a fresh backup with `scripts/backup-db.sh` (`mysqldump --single-transaction`). **Known caveat:** the script exports `.env.local` in a way that breaks on values with spaces or quotes, so **check its output before relying on it**.
- [ ] The dump contains credentials and personal data: store it **encrypted, off the laptop**, and delete local copies after the window. Never restore a raw production dump onto a laptop.
- [ ] **Verify the backup without restoring it locally:** list the tables in the dump; compare row counts for key tables (`User`, `Prospect`, `Payment`) with production. Record backup identifier, time, size, and who verified it.
- [ ] Decide where a restore would be tested, if at all (for example, an isolated managed database). **A backup that has never been restored is unproven.**

## Gate 3: production schema verification 🔒 (read-only)
Follow `docs/production-schema-verification.md`; each step needs its own approval.
- [ ] A dedicated **metadata-only** database account (`REFERENCES` only). Remove it afterwards.
- [ ] Step 3, Prisma drift check against `main`'s schema: output **must be empty**, or every difference reviewed and understood. **Do not baseline a database that drifts.**
- [ ] Record the MySQL version and whether it is MySQL or MariaDB (rehearsals used MySQL 9.4).
- [ ] Clean up the account and any local output.

## Gate 4: secrets and configuration (host settings; never in Git)
- [ ] **`IA_SUPPRESSION_KEY`**: at least 32 characters; generate with `openssl rand -base64 48`; production scope only; **never reused from local or staging**.
- [ ] **`IA_SUPPRESSION_KEY_ID`**: for example `k1`.
- [ ] **Escrow the key** in a separate secret store with owner-only access. **Losing it means opt-outs can no longer be matched** (`docs/suppression-keys.md`).
- [ ] `IA_SUPPRESSION_LEGACY_MATCH` and `IA_SUPPRESSION_KEYS_PREVIOUS` **unset** (production starts fresh).
- [ ] **Admin allowlist:** the pilot admin's email is in `ADMIN_EMAILS`. It is read when the app starts, so **a redeploy is needed** after changing it. Confirm only the intended people are listed.
- [ ] Leave **off / unset**: `IA_CRAWLER_ENABLED`, `IA_PLACES_ENABLED`, any OpenAI use for acquisition.
- [ ] **`INDUSTRY_ACQUISITION_ENABLED` stays unset** until Gate 7.
- [ ] **`autoDraftEnabled` stays off** for the pilot admin (it is now safe for acquisition clinics, but there's no reason to take the risk).

## Gate 5: migrations 🔒 (`docs/database-migrations.md` §5)
- [ ] Re-run the drift check; confirm still empty.
- [ ] `migrate resolve --applied 0_init` (creates `_prisma_migrations` with one row).
- [ ] `migrate status`: **exactly three** pending: `1_industry_acquisition`, `2_acquisition_intelligence`, `3_sales_workflow`.
- [ ] `migrate deploy`. **No pre-existing RUNVAX table is touched.** Migration 1 creates the acquisition tables; migrations 2 and 3 add tables and nullable columns to them, and migration 2 also swaps one index on `AcquisitionSuppression`, a table migration 1 has just created.
- [ ] Verify all of: `migrate status` up to date · `SHOW TABLES LIKE 'Acquisition%'` returns **19** · existing key-table row counts unchanged · `migrate diff` against the branch schema is empty · **the app works with the flag unset**.
- [ ] Stop and use the rollback if anything differs.

## Gate 6: deploy the code, flag still OFF 🔒
- [ ] Merge and deploy (needs approval; nothing is pushed or merged yet).
- [ ] **Smoke test: no messages sent, no real recipients:**
  - sign in; the dashboard, Find Prospects, Pipeline and Settings load;
  - signed-out calls to the send routes return **401**;
  - `/acquisition` and `/api/acquisition/status` return **404** to the admin (flag off).
- [ ] Watch the logs for 15 minutes: no new errors, and no `[recipient guard]` lines (it should say nothing for ordinary sends).
- [ ] The existing daily crons are unchanged (the list in `vercel.json`); **acquisition adds no cron**.

## Gate 7: enable for the pilot only 🔒
- [ ] Set `INDUSTRY_ACQUISITION_ENABLED=true` (production scope) and redeploy.
- [ ] Verify: admin reaches `/acquisition` · a **non-admin** is redirected and gets 403 from the APIs · anonymous gets 401 · `/api/acquisition/status` returns 200 (**a 503 means the key is wrong**).
- [ ] On the Overview: every "live access" switch is **off**; the crawler shows disabled; Places shows disabled; sending shows disabled.
- [ ] Import only the **first approved pilot clinic**. **Do not create fake clinics in production.**

## Gate 8: monitoring (nothing here alerts automatically)
**Be honest about what exists:** a manual daily check is the only monitoring. There is no alerting for the acquisition module.
- [ ] **Sentry** is configured in code but active only if `NEXT_PUBLIC_SENTRY_DSN` is set. **Not verified for production.** Check it.
- [ ] Daily, during the pilot, review the host's function logs for: `[acquisition api]`, `[acquisition] task failed`, `[recipient guard] check failed`.
- [ ] Daily, open the Overview and the Agent activity tab: **dead or failing tasks** should be zero or explained.
- [ ] Daily, this query must return **0** (no existing-automation draft for an acquisition clinic):
  `SELECT COUNT(*) FROM OutreachDraft d JOIN Prospect p ON p.id = d.prospectId WHERE p.source = 'industry-acquisition';`
- [ ] Daily, reconcile: every reply or opt-out received is **recorded in RUNVAX** the same day.
- [ ] Stop rule: any complaint, unexpected message, or a non-zero count above **pauses the pilot**.

## Rollback (`docs/database-migrations.md` §6), in order of preference
1. **Turn the feature off:** unset `INDUSTRY_ACQUISITION_ENABLED` and redeploy. The module goes dark; the tables are inert; the send-route protections stay in force.
2. **Revert the code:** redeploy the previous build. The new tables are ignored.
3. 🔒 **Drop the new tables**, newest first: `3_sales_workflow/down.sql`, `2_…/down.sql`, `1_…/down.sql`, deleting each migration's `_prisma_migrations` row. **Export `AcquisitionOutcome` first** (it holds recorded outcomes). Rolling back also discards the suppression list, **which would re-expose opted-out clinics: do not do this while any outreach has happened.**
4. 🔒 **Restore from backup:** last resort; it discards every write since the backup.

## After the window
- [ ] Record: commit hash, backup identifier, migration output, who approved and ran each gate, and the time.
- [ ] 24-hour review of the logs and the daily checks before any clinic is contacted.
- [ ] Delete local copies of backups and schema outputs.

**Out of scope for this release (and not to be started):** a scheduler, any new agent, website crawling, Google Places, OpenAI, any automatic outreach or follow-up.
