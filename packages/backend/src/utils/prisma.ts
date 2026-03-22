import { Prisma, PrismaClient } from '@prisma/client';
import { prismaTransactionDuration } from '../infrastructure/metrics/prometheus.js';

// ---------------------------------------------------------------------------
// Prisma Client Singleton
// ---------------------------------------------------------------------------
// Uses the global-singleton pattern to avoid multiple clients during
// hot-reloading in development.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- standard global singleton pattern
const globalForPrisma = globalThis as any as {
  prisma: PrismaClient | undefined;
  prismaReadBase: PrismaClient | undefined;
};

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

function buildExtendedClient(base: PrismaClient): PrismaClient {
  const withSoftDelete = base.$extends({
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
        async findUnique({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
        async aggregate({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
        async groupBy({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
      },
    },
  });

  // Chain a second extension for query timing — only observe slow queries (>100ms)
  // to avoid flooding the histogram with trivial operations
  const withMetrics = withSoftDelete.$extends({
    query: {
      $allOperations({ operation, model, args, query }) {
        const start = performance.now();
        const result = query(args);
        if (result instanceof Promise) {
          return result.finally(() => {
            const durationSec = (performance.now() - start) / 1000;
            if (durationSec > 0.1) {
              prismaTransactionDuration.observe({ operation: `${model}.${operation}` }, durationSec);
            }
          });
        }
        return result;
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma $extends returns incompatible branded type
  return withMetrics as any as PrismaClient;
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : process.env.PRISMA_DEBUG === 'true'
          ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
          : ['error'],
  });

export const prisma = buildExtendedClient(basePrisma);

// ---------------------------------------------------------------------------
// Read Replica Client
// ---------------------------------------------------------------------------
// When DATABASE_READ_URL is set, a second PrismaClient instance is created
// pointing to the read replica. All read-heavy reporting queries should use
// `prismaRead` to offload traffic from the primary.
// Falls back to the primary `prisma` instance when no replica URL is configured.
// ---------------------------------------------------------------------------

const baseReadPrisma: PrismaClient = (() => {
  const readUrl = process.env.DATABASE_READ_URL;
  if (!readUrl) {
    // No replica configured — fall back to primary base client
    return basePrisma;
  }
  return (
    globalForPrisma.prismaReadBase ??
    new PrismaClient({
      datasources: { db: { url: readUrl } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  );
})();

export const prismaRead = buildExtendedClient(baseReadPrisma);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
  if (process.env.DATABASE_READ_URL) {
    globalForPrisma.prismaReadBase = baseReadPrisma;
  }
}
