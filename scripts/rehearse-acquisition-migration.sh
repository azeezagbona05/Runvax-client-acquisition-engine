#!/bin/bash
# Rehearses the Prisma baseline + acquisition migrations 1–3 (and their manual
# rollbacks, newest first) against a
# DISPOSABLE local MySQL. Refuses to run against anything but 127.0.0.1.
# See docs/database-migrations.md. Usage:
#   REHEARSAL_PORT=3399 bash scripts/rehearse-acquisition-migration.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${REHEARSAL_PORT:?set REHEARSAL_PORT to the throwaway mysqld port}"
DB=runvax_ia_rehearsal
export DATABASE_URL="mysql://root@127.0.0.1:${PORT}/${DB}"
case "$DATABASE_URL" in mysql://root@127.0.0.1:*/runvax_ia_rehearsal) ;; *) echo "refusing non-local URL"; exit 1;; esac

TMP=$(mktemp -d)
git show main:prisma/schema.prisma > "$TMP/schema.main.prisma"
# Schema as of migration 1 (the commit that added it) — target of the migration-2 rollback.
P1_REF=$(git log --diff-filter=A --format=%H -1 -- prisma/migrations/1_industry_acquisition/migration.sql)
git show "$P1_REF:prisma/schema.prisma" > "$TMP/schema.phase1.prisma"
# Schema as of migration 2 — target of the migration-3 rollback.
P2_REF=$(git log --diff-filter=A --format=%H -1 -- prisma/migrations/2_acquisition_intelligence/migration.sql)
git show "$P2_REF:prisma/schema.prisma" > "$TMP/schema.phase2.prisma"
q() { mysql -u root -h 127.0.0.1 -P "$PORT" "$DB" "$@"; }
prisma() { npx prisma "$@" 2>&1 | grep -vE 'Update available|^│|^┌|^└|^\s*$|major-version|npm i ' || true; }
snapshot() {
  for t in $(q -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB' AND table_name NOT LIKE 'Acquisition%' AND table_name <> '_prisma_migrations' ORDER BY 1"); do
    q -N -e "SHOW CREATE TABLE \`$t\`"
  done
}
counts() { q -N -e "SELECT 'User',COUNT(*) FROM User UNION ALL SELECT 'Prospect',COUNT(*) FROM Prospect UNION ALL SELECT 'AgentTask',COUNT(*) FROM AgentTask UNION ALL SELECT 'OutreachDraft',COUNT(*) FROM OutreachDraft"; }
nodrift() { npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel "$1" --exit-code >/dev/null 2>&1; }

echo "== 0. fresh disposable database"
mysql -u root -h 127.0.0.1 -P "$PORT" -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "== A. today's schema from 0_init + synthetic rows"
prisma db execute --url "$DATABASE_URL" --file prisma/migrations/0_init/migration.sql
q -e "
INSERT INTO User (id,email,plan,createdAt,updatedAt) VALUES ('u_admin','admin@example.test','agency',NOW(3),NOW(3)),('u_cust','customer@example.test','pro',NOW(3),NOW(3));
INSERT INTO Prospect (id,userId,businessId,businessName,businessData,stage,savedAt,updatedAt) VALUES ('p1','u_admin','place_1','Clinic One','{}','found',NOW(3),NOW(3)),('p2','u_cust','place_2','Clinic Two','{}','contacted',NOW(3),NOW(3));
INSERT INTO AgentTask (id,userId,type,status,attempts,maxAttempts,scheduledAt,createdAt) VALUES ('t1','u_cust','detect_opportunity','pending',0,3,NOW(3),NOW(3));
INSERT INTO OutreachDraft (id,userId,prospectId,channel,whatsapp,status,createdAt) VALUES ('d1','u_cust','p2','whatsapp','Hi','pending',NOW(3));"
snapshot > "$TMP/before.sql"; counts > "$TMP/counts-before.txt"; cat "$TMP/counts-before.txt"

echo "== B. deploy without a baseline must refuse (P3005)"
out=$(prisma migrate deploy); [[ $out == *P3005* ]] && echo "refused (P3005)" || { echo "expected P3005"; exit 1; }

echo "== C-F. baseline, deploy, status"
prisma migrate resolve --applied 0_init
prisma migrate status
prisma migrate deploy
prisma migrate status

echo "== G. no drift vs prisma/schema.prisma"
nodrift prisma/schema.prisma && echo "NO DRIFT" || { echo "DRIFT FOUND"; exit 1; }

echo "== H. existing tables and rows unchanged"
snapshot > "$TMP/after.sql"; counts > "$TMP/counts-after.txt"
diff -q "$TMP/before.sql" "$TMP/after.sql" && echo "existing table definitions IDENTICAL"
diff -q "$TMP/counts-before.txt" "$TMP/counts-after.txt" && echo "existing row counts IDENTICAL"

echo "== I. constraints on the new tables"
q -e "INSERT INTO AcquisitionProspect (id,userId,prospectId,industryKey,state,updatedAt) VALUES ('ap1','u_admin','p1','dental','discovered',NOW(3));
INSERT INTO AcquisitionTask (id,userId,type,acqProspectId,idempotencyKey) VALUES ('at1','u_admin','acq.discover','ap1','k1');"
# These inserts must FAIL; capture output so pipefail doesn't treat that as a script error.
out=$(q -e "INSERT INTO AcquisitionTask (id,userId,type,idempotencyKey) VALUES ('at2','u_admin','acq.discover','k1');" 2>&1 || true)
[[ $out == *"Duplicate entry"* ]] && echo "idempotency unique key enforced" || { echo "unique key NOT enforced"; exit 1; }
out=$(q -e "INSERT INTO AcquisitionProspect (id,userId,prospectId,industryKey,updatedAt) VALUES ('ap2','u_admin','nope','dental',NOW(3));" 2>&1 || true)
[[ $out == *"foreign key constraint fails"* ]] && echo "FK to Prospect enforced" || { echo "FK NOT enforced"; exit 1; }

echo "== I2. migration 3 columns and outcome table work on real MySQL"
q -e "INSERT INTO AcquisitionDraft (id,userId,acqProspectId,channel,body,evidenceFindingIds,offerId,status,version,idempotencyKey,updatedAt,evidenceSignalIds,evidenceHash,offerHash,offerConfigVersion,industryConfigVersion,readiness,statusReason)
  VALUES ('ad1','u_admin','ap1','email','synthetic body','[]','ai_receptionist','approved',1,'pitch:ap1:v1',NOW(3),'[\"s1\"]',REPEAT('e',64),REPEAT('o',64),1,2,'{\"ready\":false}','synthetic');
INSERT INTO AcquisitionApproval (id,userId,draftId,action,actorEmail,bodyHashAfter,evidenceHash,offerHash) VALUES ('aa1','u_admin','ad1','approve','admin@example.test',REPEAT('b',64),REPEAT('e',64),REPEAT('o',64));
INSERT INTO AcquisitionOutcome (id,userId,acqProspectId,draftId,type,amount,currency,reason,actorEmail,occurredAt) VALUES ('ao1','u_admin','ap1','ad1','proposal_sent',450000,'NGN',NULL,'admin@example.test',NOW(3));"
q -N -e "SELECT CONCAT('outcome amount ', amount, ' ', currency) FROM AcquisitionOutcome WHERE id='ao1'"
out=$(q -e "INSERT INTO AcquisitionOutcome (id,userId,acqProspectId,type,actorEmail,occurredAt) VALUES ('ao2','u_admin','nope','sent','a@x',NOW(3));" 2>&1 || true)
[[ $out == *"foreign key constraint fails"* ]] && echo "outcome FK to AcquisitionProspect enforced" || { echo "outcome FK NOT enforced"; exit 1; }
counts > "$TMP/counts-after3.txt"; diff -q "$TMP/counts-before.txt" "$TMP/counts-after3.txt" && echo "existing row counts still IDENTICAL"

echo "== J0. rollback migration 3 (keeps the draft row, drops its new columns and the outcome table)"
prisma db execute --url "$DATABASE_URL" --file prisma/migrations/3_sales_workflow/down.sql
q -e "DELETE FROM _prisma_migrations WHERE migration_name='3_sales_workflow';"
nodrift "$TMP/schema.phase2.prisma" && echo "after rollback of 3: matches the Phase 2 schema exactly" || { echo "ROLLBACK 3 MISMATCH"; exit 1; }
q -N -e "SELECT CONCAT('draft rows kept: ', COUNT(*)) FROM AcquisitionDraft WHERE id='ad1'"
q -e "DELETE FROM AcquisitionApproval; DELETE FROM AcquisitionDraft;"

echo "== J1. rollback migration 2"
prisma db execute --url "$DATABASE_URL" --file prisma/migrations/2_acquisition_intelligence/down.sql
q -e "DELETE FROM _prisma_migrations WHERE migration_name='2_acquisition_intelligence';"
nodrift "$TMP/schema.phase1.prisma" && echo "after rollback of 2: matches the Phase 1 schema exactly" || { echo "ROLLBACK 2 MISMATCH"; exit 1; }

echo "== J2. rollback migration 1"
prisma db execute --url "$DATABASE_URL" --file prisma/migrations/1_industry_acquisition/down.sql
q -e "DELETE FROM _prisma_migrations WHERE migration_name='1_industry_acquisition';"
nodrift "$TMP/schema.main.prisma" && echo "after rollback: matches main's schema exactly" || { echo "ROLLBACK MISMATCH"; exit 1; }
snapshot > "$TMP/rolledback.sql"; counts > "$TMP/counts-rolledback.txt"
diff -q "$TMP/before.sql" "$TMP/rolledback.sql" && diff -q "$TMP/counts-before.txt" "$TMP/counts-rolledback.txt" && echo "existing tables + rows intact after rollback"

echo "== K. re-apply"
prisma migrate deploy
nodrift prisma/schema.prisma && echo "re-applied: NO DRIFT"
rm -rf "$TMP"
echo "== ALL CHECKS PASSED"
