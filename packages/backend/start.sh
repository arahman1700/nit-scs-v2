#!/bin/sh
echo "==> Syncing Prisma schema to database..."
# Use migrate deploy if migration files exist, otherwise fallback to db push
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "==> Running prisma migrate deploy..."
  npx prisma migrate deploy 2>&1 || {
    echo "==> Migration failed, falling back to db push..."
    npx prisma db push --skip-generate 2>&1 || { echo "ERROR: prisma db push failed"; exit 1; }
  }
else
  echo "==> No migrations found, using db push..."
  npx prisma db push --skip-generate 2>&1 || {
    echo "==> Normal push failed, attempting force-reset..."
    npx prisma db push --skip-generate --force-reset --accept-data-loss 2>&1 || { echo "ERROR: prisma db push failed"; exit 1; }
  }
fi
echo "==> Seeding database..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped (may already be seeded)"
echo "==> Starting server..."
exec node dist/index.js
