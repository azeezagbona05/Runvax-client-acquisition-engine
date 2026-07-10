#!/bin/bash
# ProspectAI — Database Restore Script
# Usage: ./scripts/restore-db.sh .backups/prospectai_2026-07-05_02-00-00.sql.gz
# WARNING: This overwrites the target database. Run on staging first.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh "$PROJECT_DIR/.backups/"*.sql.gz 2>/dev/null || echo "  No backups found in .backups/"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

# Load .env.local if present
if [ -f "$PROJECT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$PROJECT_DIR/.env.local" | grep -v '^$' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

DB_USER=$(echo "$DATABASE_URL" | sed 's|mysql://\([^:]*\):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed 's|mysql://[^:]*:\([^@]*\)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed 's|mysql://[^@]*@\([^:/]*\).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed 's|.*/\([^?]*\).*|\1|')

echo ""
echo "============================================================"
echo "  RESTORE WARNING"
echo "============================================================"
echo "  Database : $DB_NAME @ $DB_HOST"
echo "  From file: $BACKUP_FILE"
echo "  This will OVERWRITE all data in '$DB_NAME'."
echo "============================================================"
echo ""
read -p "Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "[restore] $(date) — Restoring $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | MYSQL_PWD="$DB_PASS" mysql \
  --host="$DB_HOST" \
  --port="${DB_PORT:-3306}" \
  --user="$DB_USER" \
  "$DB_NAME"

echo "[restore] $(date) — Done."
