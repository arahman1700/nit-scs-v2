#!/bin/sh
echo "==> Pushing Prisma schema to database..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || { echo "ERROR: prisma db push failed"; exit 1; }
echo "==> Seeding database..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped (may already be seeded)"
echo "==> Starting server..."
exec node dist/index.js
