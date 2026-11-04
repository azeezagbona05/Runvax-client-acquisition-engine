# Database migrations: Prisma Migrate baseline runbook

Status (2026-10-14): **prepared and rehearsed locally on a disposable database only. Nothing has been applied to production.** Every production step below needs explicit approval first.

## Background

- Until now the schema has been applied with `prisma db push`. There is no migration history, and production has no `_prisma_migrations` table.
- `prisma/migrations/0_init` is a **baseline**: the SQL for `main`'s schema as it was before the Industry Acquisition work. It must never be *executed* against production. It only gets *marked as applied*.
- `prisma/migrations/1_industry_acquisition` is purely additive: 11 `CREATE TABLE` statements, plus `ADD CONSTRAINT … FOREIGN KEY` on those new tables only. It never alters, drops or rewrites an existing table or column. `tests/acquisition/migration-sql.test.ts` enforces this.
- `1_industry_acquisition/down.sql` is a **manual** rollback. It drops only the 11 new tables.

> ⚠️ `.env` and `.env.local` point `DATABASE_URL` at the **production** database. Prisma and Next.js load those files automatically. Every command in this document sets `DATABASE_URL` explicitly. A variable already set in the shell takes priority over `.env` files. Never run a database command here without it.

## What each command does

| Command | Creates SQL files | Modifies a database | Could contact production |
|---|---|---|---|
| `prisma format`, `prisma validate`, `prisma generate` | – | no | no (no connection) |
| `prisma migrate diff --from-empty / --from-schema-datamodel … --to-schema-datamodel …` | yes (stdout) | no | no (no connection) |
| `prisma migrate diff --from-url $URL …` | yes (stdout) | no (read-only introspection) | **yes, if `$URL` is production** |
| `prisma migrate status` | – | no (reads `_prisma_migrations`) | **yes, via `DATABASE_URL`** |
| `prisma db execute --url $URL --file …` | – | **yes** (runs the file) | **yes, if `$URL` is production** |
| `prisma migrate resolve --applied <name>` | – | **yes** (writes `_prisma_migrations`, creating it if missing) | **yes, via `DATABASE_URL`** |
| `prisma migrate deploy` | – | **yes** (applies pending migrations) | **yes, via `DATABASE_URL`** |
| `scripts/backup-db.sh` | – | no | **yes**: it loads `.env.local`, i.e. production |
| `npm run build` | – | no (but pages may *read* the DB at build time) | **yes, unless `DATABASE_URL` is overridden** |
| `npx vitest run` | – | no | no (`tests/setup.ts` forces a local URL and fakes Prisma) |

**Never use** against any shared database: `prisma migrate dev` (it can offer to reset the database), `prisma migrate reset`, or `prisma db push --accept-data-loss`.

## Migration 2: `2_acquisition_intelligence` (Phase 2)

- **Scope:** 7 new `Acquisition*` tables, plus new columns on Phase 1 `Acquisition*` tables only, which aren't in production yet. No existing RUNVAX table is touched. `tests/acquisition/migration2-sql.test.ts` enforces this.
- **Hand-ordered index swap:** the change from `AcquisitionSuppression (userId, kind, value)` to `(userId, kind, valueHash)`. Prisma's generated order dropped the old unique index first. MySQL refused (error 1553) because the `userId` foreign key needs an index. Both `migration.sql` and `down.sql` now create the replacement index before dropping the old one. The fix was found and verified in rehearsal.
- **Rollback (`down.sql`):** if `AcquisitionSuppression` holds hash-only rows (`value IS NULL`), back them up or delete them first. Otherwise the `MODIFY value NOT NULL` fails. Rolling back also discards the suppression tombstones, so do it only with that understood.

## Migration 3: `3_sales_workflow` (sales-preparation workflow)

- **Scope:** purely additive. Adds:
  - 7 nullable columns on `AcquisitionDraft`: `evidenceSignalIds`, `evidenceHash`, `offerHash`, `offerConfigVersion`, `industryConfigVersion`, `readiness`, `statusReason`;
  - 2 nullable columns on `AcquisitionApproval`: `evidenceHash`, `offerHash`;
  - one new table, `AcquisitionOutcome`, with foreign keys to `User` and `AcquisitionProspect` (cascade).

  No existing RUNVAX table is touched. No column is modified or dropped, and no data changes. `tests/acquisition/migration3-sql.test.ts` enforces this.
- **Rollback (`down.sql`, manual only):**
  1. Export `AcquisitionOutcome` first if it holds data: the rollback drops the table and the recorded outcomes.
  2. Run `down.sql`.
  3. Run `DELETE FROM _prisma_migrations WHERE migration_name = '3_sales_workflow';`.

  Draft rows are kept; only the new columns go.
- **Rehearsed** 2026-10-14 on a fresh throwaway MySQL 9.4.0 (`127.0.0.1:3399`):
  - deploy of 1–3 with no drift;
  - existing tables and row counts identical;
  - the new outcome FK enforced, and a synthetic outcome, draft and approval written to the new columns;
  - rollback of 3 matches the Phase 2 schema exactly, with the draft row kept;
  - rollbacks of 2 and 1 match their earlier schemas;
  - re-apply with no drift.

## 1. Local rehearsal on a disposable database (done)

`scripts/rehearse-acquisition-migration.sh` starts from an empty database on `127.0.0.1` and refuses any other host. It:

1. Builds today's schema from `0_init` and inserts synthetic rows.
2. Confirms `migrate deploy` **refuses** to run without a baseline (P3005).
3. Runs `migrate resolve --applied 0_init`, then `migrate status`, then `migrate deploy`, then `migrate status`.
4. Runs `migrate diff --from-url <local> --to-schema-datamodel prisma/schema.prisma --exit-code`, expecting no drift.
5. Compares `SHOW CREATE TABLE` for every existing table, and row counts, before and after. They must be identical.
6. Checks that the idempotency unique key and the foreign key to `Prospect` are enforced.
7. Writes synthetic rows to migration 3's new columns and outcome table, and checks the outcome foreign key.
8. Rolls back newest first. Each rollback is `down.sql` plus deleting the migration's `_prisma_migrations` row:
   - **Migration 3:** the database must match the Phase 2 schema exactly, and the draft row survives.
   - **Migration 2:** it must match the Phase 1 schema exactly.
   - **Migration 1:** it must match `main`'s schema exactly, with existing rows intact.
9. Re-applies all three, and expects no drift again.

Result on 2026-10-14 (MySQL 9.4.0, throwaway `mysqld` on port 3399): **all steps passed**, for migration 1 and again with migration 2 (after the index-order fix).

To run it again:
```bash
# A throwaway server (its own datadir; does not touch any existing MySQL install)
D=$(mktemp -d)/data && mysqld --no-defaults --initialize-insecure --datadir="$D"
mysqld --no-defaults --datadir="$D" --port=3399 --bind-address=127.0.0.1 --socket=/tmp/runvax-rehearsal.sock --mysqlx=OFF &
REHEARSAL_PORT=3399 bash scripts/rehearse-acquisition-migration.sh
```

Note: macOS file systems are case-insensitive, so MySQL there runs with `lower_case_table_names=2`. Production on Linux is case-sensitive. Prisma's generated SQL quotes names consistently, so this doesn't affect the migration, but it is a known difference between rehearsal and production.

## 2. Rehearsal against the real production *schema* (needs approval)

Don't restore a raw production backup locally: it contains SMTP passwords, WhatsApp tokens and personal data. Instead:

1. **Schema-only dump** (read-only on production; needs approval). It contains no rows, so no credentials or personal data:
   ```bash
   mysqldump --no-data --skip-triggers --set-gtid-purged=OFF -h <prod-host> -u <user> -p <db> > prod-schema.sql
   ```
2. Load it into a disposable local database, add synthetic rows, then run the steps from section 1 against it. This proves the baseline matches production's *actual* structure, including collations and foreign-key compatibility with the existing `User` and `Prospect` columns.
3. If real data ever becomes necessary, stop and agree a documented secure process first (sanitisation, encrypted storage, deletion afterwards).

## 3. Production drift check (needs approval)

Read-only. It shows how production differs from `main`'s Prisma schema:
```bash
git show main:prisma/schema.prisma > /tmp/schema.main.prisma
DATABASE_URL="<prod-url>" npx prisma migrate diff \
  --from-url "<prod-url>" --to-schema-datamodel /tmp/schema.main.prisma --script
```
**Go/no-go:** the output must be empty (`-- This is an empty migration.`), or every difference must be reviewed and understood. **Do not baseline a database that drifts.** Marking `0_init` as applied would then record a schema that isn't really there.

## 4. Backup (needs approval)

- `scripts/backup-db.sh` runs `mysqldump --single-transaction` (a consistent snapshot without locking InnoDB tables) and writes a gzipped file to `.backups/`, which is git-ignored.
- **The dump contains credentials and personal data.** Store it encrypted, outside the laptop if possible, and delete local copies after the change window.
- Check the backup by listing the tables in the dump and comparing row counts for key tables (`User`, `Prospect`, `Payment`) against production. Don't do that by restoring it onto a laptop; see section 2.
- Caveat: the script exports `.env.local` through `xargs`, which breaks on values containing spaces or quotes. Check its output before relying on it.

## 5. Production steps (each needs approval, in a change window)

1. Fresh backup (section 4). Re-run the drift check (section 3) and confirm it's still empty.
2. Create the baseline record. This only creates `_prisma_migrations` and inserts one row:
   ```bash
   DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 0_init
   ```
3. `DATABASE_URL="<prod-url>" npx prisma migrate status`: the pending migrations should be exactly `1_industry_acquisition`, `2_acquisition_intelligence` and `3_sales_workflow`, in that order.
4. `DATABASE_URL="<prod-url>" npx prisma migrate deploy`.
5. Verify:
   - `migrate status` reports "up to date".
   - `SHOW TABLES LIKE 'Acquisition%'` returns **19** tables (11 from migration 1, 7 from migration 2, 1 from migration 3).
   - Row counts of existing key tables are unchanged.
   - `migrate diff --from-url <prod> --to-schema-datamodel prisma/schema.prisma --exit-code` returns 0.
   - The app works end to end with `INDUSTRY_ACQUISITION_ENABLED` unset.

Code and migration can ship in either order. No existing table gained a column (the only change to `User` is a relation field, which adds no SQL), so existing queries are unaffected. The existing send routes now run a recipient check that reads the acquisition tables; **while those tables don't exist yet, that check treats "table not found" as "no acquisition data" and allows the send** (tested), so normal RUNVAX sending keeps working before the migration is applied. Rex and Atlas filter on `Prospect.source`, which already exists. The feature itself stays off.

## 6. Rollback

In order of preference:

1. **Turn the flag off.** Unset `INDUSTRY_ACQUISITION_ENABLED` and redeploy. The module goes dark, and the new tables are inert.
2. **Revert the code.** Redeploy the previous build. The new tables are ignored by the old client.
3. **Drop the new tables** (only with approval), newest migration first: `3_sales_workflow/down.sql`, then `2_acquisition_intelligence/down.sql`, then `1_industry_acquisition/down.sql`. Delete each migration's `_prisma_migrations` row as you go, e.g. after the last one `DELETE FROM _prisma_migrations WHERE migration_name = '1_industry_acquisition';`. Rehearsed in section 1.
4. **Restore from backup.** Last resort, because it discards every write since the backup.

The `0_init` baseline row is harmless to leave in place. It only records history.
