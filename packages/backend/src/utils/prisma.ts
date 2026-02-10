import { Prisma, PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma Client Singleton
// ---------------------------------------------------------------------------
// Uses the global-singleton pattern to avoid multiple clients during
// hot-reloading in development.
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// ---------------------------------------------------------------------------
// Soft-Delete Middleware (via $extends)
// ---------------------------------------------------------------------------
// Auto-filter `deletedAt` for read queries. The delete→update conversion is
// intentionally left to the application layer (crud-factory.ts) because not
// every model has a `deletedAt` column.
// ---------------------------------------------------------------------------

// Models that have a `deletedAt` column — keep in sync with the Prisma schema
const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set(
  Object.values(Prisma.ModelName).filter(name => {
    // Check if the model's fields include 'deletedAt'
    const fields = Prisma.dmmf.datamodel.models.find(m => m.name === name)?.fields;
    return fields?.some(f => f.name === 'deletedAt');
  }),
);

function applySoftDeleteFilter(model: string | undefined, args: Record<string, unknown>) {
  if (!model || !SOFT_DELETE_MODELS.has(model)) return;
  const where = (args.where ?? {}) as Record<string, unknown>;
  if (where.deletedAt === undefined) {
    where.deletedAt = null;
  }
  args.where = where;
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        applySoftDeleteFilter(model, args);
        return query(args);
      },
      async findFirst({ model, args, query }) {
        applySoftDeleteFilter(model, args);
        return query(args);
      },
      async count({ model, args, query }) {
        applySoftDeleteFilter(model, args);
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}
