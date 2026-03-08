#!/bin/sh
echo "==> Applying pending database migrations..."
npx prisma migrate deploy 2>&1 || {
  echo "ERROR: prisma migrate deploy failed"
  exit 1
}
echo "==> Seeding database..."
node dist/seed/seed.js 2>&1 || echo "INFO: Seed skipped (may already be seeded)"
echo "==> Starting server..."
exec node dist/index.js
