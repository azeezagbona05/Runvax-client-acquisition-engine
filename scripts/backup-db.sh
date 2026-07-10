#!/bin/bash
# ProspectAI — Database Backup Script
# Usage: ./scripts/backup-db.sh
# Cron (daily at 2am): 0 2 * * * /path/to/project/scripts/backup-db.sh >> /var/log/prospectai-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/.backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Load .env.local if present (for local runs)
if [ -f "$PROJECT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$PROJECT_DIR/.env.local" | grep -v '^$' | xargs)
fi

# Parse DATABASE_URL: mysql://user:pass@host:port/dbname
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: DATABASE_URL not set"
  exit 1
fi

DB_USER=$(echo "$DATABASE_URL" | sed 's|mysql://\([^:]*\):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed 's|mysql://[^:]*:\([^@]*\)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed 's|mysql://[^@]*@\([^:/]*\).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed 's|.*/\([^?]*\).*|\1|')

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/prospectai_${TIMESTAMP}.sql.gz"

echo "[backup] $(date) — Starting backup of $DB_NAME@$DB_HOST..."

MYSQL_PWD="$DB_PASS" mysqldump \
  --host="$DB_HOST" \
  --port="${DB_PORT:-3306}" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[backup] $(date) — Done. File: $BACKUP_FILE ($SIZE)"

# Rotate old backups
find "$BACKUP_DIR" -name "prospectai_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
echo "[backup] Cleaned up backups older than $KEEP_DAYS days."

# Optional: upload to cloud storage
# Uncomment and configure for your provider:

# --- AWS S3 ---
# aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET:-prospectai-backups}/db/$TIMESTAMP.sql.gz" --region "${AWS_REGION:-eu-west-1}"

# --- Google Cloud Storage ---
# gsutil cp "$BACKUP_FILE" "gs://${GCS_BUCKET:-prospectai-backups}/db/$TIMESTAMP.sql.gz"

# --- Cloudflare R2 ---
# rclone copy "$BACKUP_FILE" "r2:prospectai-backups/db/"

echo "[backup] Complete."
