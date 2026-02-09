import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma Client Singleton
// ---------------------------------------------------------------------------
// Uses the global-singleton pattern to avoid multiple clients during
// hot-reloading in development.
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// Soft-Delete Note
// ---------------------------------------------------------------------------
// Soft-delete is implemented at the application layer in two ways:
//
// 1. **crud-factory.ts** — DELETE routes set `deletedAt` instead of removing
//    the row (for models where `softDelete: true`, which is the default).
//
// 2. **service-factory.ts** (future) — Service `list()` and `getById()`
//    methods automatically filter `deletedAt: null`.
//
// We intentionally do NOT use Prisma middleware or `$extends` for soft-delete
// because not every model has the `deletedAt` column and the generic typing
// makes it fragile.  Instead, each factory/service adds the filter explicitly.
// ---------------------------------------------------------------------------
