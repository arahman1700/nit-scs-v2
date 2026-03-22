#!/bin/sh
echo "==> Renaming legacy migrations in _prisma_migrations table (if needed)..."
npx prisma db execute --stdin <<'SQL' 2>/dev/null || true
UPDATE "_prisma_migrations"
SET migration_name = '20260101000000_baseline'
WHERE migration_name = '0000_baseline';
UPDATE "_prisma_migrations"
SET migration_name = '20260101000001_add_check_constraints'
WHERE migration_name = '0001_add_check_constraints';
SQL

echo "==> Applying pending database migrations..."
npx prisma migrate deploy 2>&1 || {
  echo "ERROR: prisma migrate deploy failed"
  exit 1
}
echo "==> Seeding database..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped (may already be seeded)"
echo "==> Starting server..."
exec node dist/index.js
