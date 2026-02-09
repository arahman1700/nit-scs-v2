#!/bin/sh
echo "==> Running Prisma migrations..."
npx prisma migrate deploy 2>&1 || echo "WARNING: prisma migrate deploy failed"
echo "==> Seeding database..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped"
echo "==> Starting server..."
exec node dist/index.js
