/**
 * Safe Status Transition Utility
 *
 * Prevents race conditions in document status transitions by using
 * Prisma's `updateMany` with a WHERE clause that includes the expected
 * current status. If another request has already changed the status,
 * `updateMany` returns { count: 0 } and we throw a conflict error.
 *
 * Supports optional optimistic locking via a `version` column.
 * When `expectedVersion` is provided, the WHERE clause also checks the
 * version and the data payload increments it atomically.
 *
 * Usage in services:
 *   const current = await prisma.mrrv.findUnique({ where: { id } });
 *   assertTransition('grn', current.status, 'pending_qc');
 *   await safeStatusUpdate(prisma.mrrv, id, current.status, { status: 'pending_qc' });
 *
 * With optimistic locking:
 *   const current = await prisma.mrrv.findUnique({ where: { id } });
 *   assertTransition('grn', current.status, 'pending_qc');
 *   const { newVersion } = await safeStatusUpdate(
 *     prisma.mrrv, id, current.status,
 *     { status: 'pending_qc' }, current.version
 *   );
 */
import { ConflictError } from '@nit-scs-v2/shared';

type PrismaDelegate = {
  updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
};

/**
 * Atomically update a record's status, ensuring the current status matches
 * what we expect. If the status has already changed (concurrent modification),
 * throws a ConflictError (409).
 *
 * @param delegate  Prisma model delegate (e.g., prisma.mrrv)
 * @param id        Record ID
 * @param expectedStatus  The status we expect the record to currently have
 * @param data      The data to update (should include the new status)
 * @param expectedVersion  Optional version for optimistic locking
 * @returns         Object with count of updated records and optional newVersion
 */
export async function safeStatusUpdate(
  delegate: PrismaDelegate,
  id: string,
  expectedStatus: string,
  data: Record<string, unknown>,
  expectedVersion?: number,
): Promise<{ count: number; newVersion?: number }> {
  const where: Record<string, unknown> = { id, status: expectedStatus };
  if (expectedVersion !== undefined) {
    where.version = expectedVersion;
    data.version = expectedVersion + 1;
  }

  const result = await delegate.updateMany({ where, data });

  if (result.count === 0) {
    throw new ConflictError(
      expectedVersion !== undefined
        ? 'Document was modified by another user. Please refresh and try again.'
        : `Status transition conflict: the record has been modified by another request. ` +
          `Expected status '${expectedStatus}' but it has already changed. Please refresh and try again.`,
    );
  }

  return { count: result.count, newVersion: expectedVersion !== undefined ? expectedVersion + 1 : undefined };
}

/**
 * Variant for use inside Prisma interactive transactions.
 * Accepts a transaction client's delegate instead of the global one.
 */
export async function safeStatusUpdateTx(
  txDelegate: PrismaDelegate,
  id: string,
  expectedStatus: string,
  data: Record<string, unknown>,
  expectedVersion?: number,
): Promise<{ count: number; newVersion?: number }> {
  return safeStatusUpdate(txDelegate, id, expectedStatus, data, expectedVersion);
}
