#!/bin/sh
echo "==> Running Prisma migrations..."
npx prisma migrate deploy 2>&1 || echo "WARNING: prisma migrate deploy failed"
echo "==> Seeding reference data..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped"
echo "==> Seeding operational/demo data..."
node dist/seed/seed-data.js 2>&1 || echo "INFO: Seed-data skipped"
echo "==> Starting server..."
exec node dist/index.js
