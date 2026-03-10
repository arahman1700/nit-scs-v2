#!/bin/bash
# ── NIT Supply Chain V2 — Database Restore Script ─────────────────────────────
# Usage:
#   ./scripts/restore.sh backups/nit_scs_v2_20260310_120000.dump
#
# WARNING: This will DROP and recreate the target database.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  ls -lh "$SCRIPT_DIR/../backups/"nit_scs_v2_*.dump 2>/dev/null || echo "  (none found)"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load .env if no DATABASE_URL provided
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${DATABASE_URL:-}" ]; then
  ENV_FILE="$SCRIPT_DIR/../../../.env"
  if [ -f "$ENV_FILE" ]; then
    export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set."
  exit 1
fi

# Parse DATABASE_URL to extract host and database name (avoid leaking credentials)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  WARNING: This will OVERWRITE the target database!         ║"
echo "║  Host:     $DB_HOST"
echo "║  Database: $DB_NAME"
echo "║  Backup:   $BACKUP_FILE"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 0
fi

echo "==> Restoring from: $BACKUP_FILE"
pg_restore "$BACKUP_FILE" \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction

echo "==> Restore complete. Run migrations to apply any pending changes:"
echo "    cd packages/backend && npx prisma migrate deploy"
