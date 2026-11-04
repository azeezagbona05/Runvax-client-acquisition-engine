# Production schema verification: read-only procedure

**Status: proposed. Nothing in this document has been run against production.** Each step marked 🔒 contacts production and needs its own explicit approval before it runs. Approving one step doesn't approve the next.

## Purpose

Before production is baselined (`docs/database-migrations.md` §5), confirm that its **actual structure** matches `main`'s `prisma/schema.prisma`. If it doesn't, marking `0_init` as applied would record a schema that isn't really there.

## Guarantees

| Requirement | How it's met |
|---|---|
| No writes or schema changes | Only `SELECT` on `information_schema` / server variables, `SHOW GRANTS`, Prisma introspection (`migrate diff`), and optionally `SHOW CREATE TABLE`. **Never** run: `migrate resolve`, `migrate deploy`, `migrate dev`, `migrate reset`, `migrate status`, `db push`, `db execute`, `db pull` (that one would also overwrite the local schema file). |
| No application-data queries | No `SELECT` against any application table. No row counts, `TABLE_ROWS` or `DATA_LENGTH` (those are derived from data). |
| No records or secrets copied | Outputs are DDL and metadata only: table, column and index definitions. The optional export is `SHOW CREATE TABLE` per base table (no triggers, routines, events or `DEFINER`s), with `AUTO_INCREMENT` counters stripped. |
| Credentials protected | The connection URL is read from a file you create (`chmod 600`). It's passed to tools through an environment variable or a `chmod 600` option file. It never appears in command arguments (`ps`), shell history, logs or outputs, and I never print it. |
| Outputs protected | Everything goes in a `chmod 700` folder in the session scratchpad (outside the repo) and is deleted at the end. Nothing is committed. |

## Prerequisite (you do this, outside this session)

**Recommended: a dedicated metadata-only MySQL account.** Created in your hosting control panel, or by an administrator:

```sql
CREATE USER 'runvax_schema_ro'@'<your-ip-or-%>' IDENTIFIED BY '<strong password>';
GRANT REFERENCES ON `<database>`.* TO 'runvax_schema_ro'@'<your-ip-or-%>';
```

- In MySQL, `information_schema` only shows objects the account holds *some* privilege on. `REFERENCES` makes table and column definitions visible, but **cannot read rows** (no `SELECT`) and can't change anything (no `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`).
- **Tested locally on 2026-10-14** (throwaway MySQL 9.4.0, `main`'s schema, one synthetic row) with an account holding only `REFERENCES`:

  | Action | Result |
  |---|---|
  | List tables, read column types and collations, read engines | ✅ visible |
  | `SHOW CREATE TABLE` | ✅ works |
  | Prisma `migrate diff --from-schema-datasource` (step 3) | ✅ works: "empty migration" against `main`; against the branch, exactly the committed `1_industry_acquisition` SQL |
  | `SELECT` rows | ❌ `ERROR 1142 SELECT command denied` |
  | `INSERT` / `ALTER` / `CREATE TABLE` / create `_prisma_migrations` | ❌ all denied (1142) |
  | `mysqldump --no-data` | ❌ fails: it needs `SELECT`. **That's why step 4 now uses `SHOW CREATE TABLE`.** |
  | Introspection left the database unchanged | ✅ same table count before and after |

  Production may be a different MySQL version, or MariaDB. Step 1 reports both, and I'd re-check the behaviour above against that version before going on.
- Some hosting panels only offer preset privilege bundles. If `REFERENCES` alone isn't possible, the next safest choice is `SELECT` + `SHOW VIEW`. Our commands still never read rows, but that account technically *could*. Step 1 shows the actual grants before anything else runs.
- Then put the account's URL in a file only you can read:
  ```bash
  mkdir -p ~/.config/runvax && umask 077
  printf '%s' 'mysql://runvax_schema_ro:<password>@<host>:3306/<database>' > ~/.config/runvax/prod-schema-ro.url
  chmod 600 ~/.config/runvax/prod-schema-ro.url
  ```
- Afterwards, drop the account (`DROP USER 'runvax_schema_ro'@'…';`) and delete the file.

*Alternative, not recommended:* reuse the application's existing credentials. They have full write privileges, so safety then rests entirely on the commands being read-only. Choose this only by saying so explicitly.

## L. Local preparation (no production contact; no approval needed)

```bash
W=$(mktemp -d "$SCRATCHPAD/prodschema.XXXX") && chmod 700 "$W"
git show main:prisma/schema.prisma > "$W/main.prisma"
cp prisma/schema.prisma "$W/branch.prisma"
cat > "$W/prod-ds.prisma" <<'EOF'
datasource db {
  provider = "mysql"
  url      = env("RUNVAX_PROD_RO_URL")
}
EOF
# mysql client option file built from the URL file, without echoing it:
node -e '
  const fs=require("fs"); const u=new URL(fs.readFileSync(process.argv[1],"utf8").trim());
  const cnf=`[client]\nhost=${u.hostname}\nport=${u.port||3306}\nuser=${decodeURIComponent(u.username)}\npassword=${decodeURIComponent(u.password)}\ndatabase=${u.pathname.slice(1)}\n`;
  fs.writeFileSync(process.argv[2], cnf, {mode:0o600});
' ~/.config/runvax/prod-schema-ro.url "$W/client.cnf"
```

**Effect:** local files only. `client.cnf` holds the password, so it is mode 600 and deleted in step 5.

## 🔒 Step 1: who am I, what can I do, what server is this

```bash
mysql --defaults-extra-file="$W/client.cnf" --batch --connect-timeout=10 -e "
  SELECT CURRENT_USER() AS account, VERSION() AS version, @@version_comment AS distribution,
         @@lower_case_table_names AS lctn, @@character_set_database AS db_charset,
         @@collation_database AS db_collation, @@default_storage_engine AS default_engine;
  SHOW GRANTS;" > "$W/step1.txt"
```

- **Effect on production:** one connection, server variables and the account's own grants. No table is touched.
- **Output:** account name, server version, MySQL or MariaDB, charset/collation, grant statements (MySQL never shows passwords in `SHOW GRANTS`).
- **Stop if** the grants include any write privilege (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `INDEX`, `ALL PRIVILEGES`) and you haven't explicitly accepted the alternative above. Also stop if the server is **MariaDB**: some commands below change (`mariadb-dump`; no `--set-gtid-purged`), and I'd revise them for approval.

## 🔒 Step 2: structural inventory (metadata only)

```bash
mysql --defaults-extra-file="$W/client.cnf" --batch --connect-timeout=10 -e "
  SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
    FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME;
  SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('User','Prospect') AND COLUMN_NAME = 'id';
  SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND (TABLE_NAME LIKE 'Acquisition%' OR TABLE_NAME = '_prisma_migrations');" > "$W/step2.txt"
```

- **Effect on production:** reads the data dictionary only. No locks on application tables.
- **What it answers:**
  - Every table is InnoDB. Foreign keys require it; a MyISAM `User` or `Prospect` would make the new foreign keys fail.
  - `User.id` and `Prospect.id` are `varchar(191)` `utf8mb4_unicode_ci`, which the new foreign-key columns must match.
  - No `Acquisition*` tables and no `_prisma_migrations` table exist yet.

## 🔒 Step 3: Prisma drift check (introspection only)

```bash
RUNVAX_PROD_RO_URL="$(cat ~/.config/runvax/prod-schema-ro.url)" \
DATABASE_URL="mysql://unused@127.0.0.1:1/unused" \
npx prisma migrate diff --from-schema-datasource "$W/prod-ds.prisma" \
  --to-schema-datamodel "$W/main.prisma" --script --exit-code > "$W/drift-vs-main.sql"; echo "exit $?"

RUNVAX_PROD_RO_URL="$(cat ~/.config/runvax/prod-schema-ro.url)" \
DATABASE_URL="mysql://unused@127.0.0.1:1/unused" \
npx prisma migrate diff --from-schema-datasource "$W/prod-ds.prisma" \
  --to-schema-datamodel "$W/branch.prisma" --script > "$W/expected-deploy.sql"
diff -w "$W/expected-deploy.sql" prisma/migrations/1_industry_acquisition/migration.sql && echo "deploy SQL matches the committed migration"
```

- **Effect on production:** Prisma introspects `information_schema` (tables, columns, indexes, foreign keys). It runs no DML and no DDL, creates nothing (no `_prisma_migrations`, no shadow database), and reads no rows.
- `DATABASE_URL` is set to a dead local address so nothing falls back to `.env`.
- **Go/no-go:**
  - `drift-vs-main.sql` must be empty (`-- This is an empty migration.`, exit 0).
  - `expected-deploy.sql` must match `1_industry_acquisition/migration.sql`.
  - Any difference is reported to you line by line before anything else happens.

## 🔒 Step 4 (optional): exact-structure export via `SHOW CREATE TABLE`

Only if step 3 shows drift, or if you want the local rehearsal (`scripts/rehearse-acquisition-migration.sh`) to run against production's exact DDL instead of `0_init`. `mysqldump` is **not** used: it needs `SELECT` (tested above).

```bash
for t in $(mysql --defaults-extra-file="$W/client.cnf" -N -e \
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY 1"); do
  mysql --defaults-extra-file="$W/client.cnf" -N --raw -e "SHOW CREATE TABLE \`$t\`" \
    | cut -f2- | sed -E 's/ AUTO_INCREMENT=[0-9]+//' >> "$W/prod-schema.sql"
  printf ';\n' >> "$W/prod-schema.sql"
done
chmod 600 "$W/prod-schema.sql"
grep -ciE '^INSERT|^REPLACE|^LOAD DATA' "$W/prod-schema.sql"   # must print 0
```

- **Effect on production:** one metadata query, then one `SHOW CREATE TABLE` per table. Each takes only a brief shared metadata lock, and no application rows are read (the account can't read them).
- **Contents:** `CREATE TABLE` statements only.
- **Use:** replayed (with `FOREIGN_KEY_CHECKS=0` around it) into a throwaway local `mysqld` for the rehearsal, then deleted. Tested locally: the replayed schema compared to `main`'s Prisma schema gave "empty migration".

## Step 5: cleanup (local)

```bash
rm -rf "$W"; unset W
```

You then drop the read-only account and delete `~/.config/runvax/prod-schema-ro.url`, or keep them for the later production-migration window.

## What I'll report after each approved step

The pass or fail of each check, plus any drift as DDL. Never the URL, the password or any row data.
