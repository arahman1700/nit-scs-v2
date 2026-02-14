#!/bin/sh
echo "==> Syncing Prisma schema to database..."
# Try normal push first; if it fails (e.g. first deploy), force-reset
npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
  echo "==> Normal push failed, attempting force-reset..."
  npx prisma db push --skip-generate --force-reset --accept-data-loss 2>&1 || { echo "ERROR: prisma db push failed"; exit 1; }
}
echo "==> Seeding database..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped (may already be seeded)"
echo "==> Starting server..."
exec node dist/index.js
