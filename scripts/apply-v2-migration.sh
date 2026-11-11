#!/usr/bin/env bash
# Applies ONLY the Client Acquisition migrations 4 and 5 to 14 (new tables and columns, additive). Skips any already applied.
# Safe to run twice. Usage: ./scripts/apply-v2-migration.sh [--yes]
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/apply-v2-migration.js "$@"
