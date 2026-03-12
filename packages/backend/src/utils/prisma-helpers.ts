import type { PrismaClient } from '@prisma/client';

/**
 * Default delegate shape returned when no generic is provided.
 */
type DefaultDelegate = Record<string, (...args: unknown[]) => Promise<unknown>>;

/**
 * Type-safe dynamic Prisma delegate accessor.
 * Centralizes the cast needed for dynamic model access in a single location.
 *
 * Prisma generates typed model accessors (e.g. `prisma.mrrv`, `prisma.mirv`)
 * but accessing them dynamically via string keys requires a runtime cast.
 * This helper encapsulates that cast so call sites stay clean.
 *
 * @example
 *   // Generic usage — caller specifies the delegate shape
 *   const delegate = getPrismaDelegate<{ findUnique: ... }>(prisma, 'mrrv');
 *
 *   // Default usage — returns a generic record of async functions
 *   const delegate = getPrismaDelegate(prisma, 'mrrv');
 */
export function getPrismaDelegate<T = DefaultDelegate>(prisma: PrismaClient, modelName: string): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PrismaClient lacks an index signature; dynamic access requires this cast
  return (prisma as any)[modelName] as T;
}
