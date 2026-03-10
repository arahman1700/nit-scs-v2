#!/bin/bash
# ── NIT Supply Chain V2 — Database Backup Script ──────────────────────────────
# Usage:
#   ./scripts/backup.sh                     # Backup using DATABASE_URL from .env
#   DATABASE_URL=postgres://... ./scripts/backup.sh  # Explicit URL
#
# Backups are stored in ./backups/ with timestamp-based naming.
# Retention: keeps the last 30 daily backups by default.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/nit_scs_v2_${TIMESTAMP}.dump"

# Load .env if no DATABASE_URL provided
if [ -z "${DATABASE_URL:-}" ]; then
  ENV_FILE="$SCRIPT_DIR/../../../.env"
  if [ -f "$ENV_FILE" ]; then
    export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Provide it via environment or .env file."
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "==> Starting database backup..."
echo "    Target: $BACKUP_FILE"

# Run pg_dump with compression
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --compress=9 \
  > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "==> Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Post-backup integrity verification
echo "==> Verifying backup integrity..."
if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
  echo "    Integrity check passed"
else
  echo ""
  echo "ERROR: Backup integrity verification failed!"
  echo "ERROR: File may be corrupt: $BACKUP_FILE"
  echo "ERROR: Investigate immediately — automated backups may be broken."
  exit 1
fi

# Cleanup old backups
echo "==> Pruning backups older than $RETENTION_DAYS days..."
PRUNED=$(find "$BACKUP_DIR" -name "nit_scs_v2_*.dump" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
echo "    Removed $PRUNED old backup(s)"

# List current backups
TOTAL=$(find "$BACKUP_DIR" -name "nit_scs_v2_*.dump" | wc -l)
echo "==> $TOTAL backup(s) retained"
