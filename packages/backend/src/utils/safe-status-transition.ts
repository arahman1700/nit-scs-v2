/**
 * Safe Status Transition Utility
 *
 * Prevents race conditions in document status transitions by using
 * Prisma's `updateMany` with a WHERE clause that includes the expected
 * current status. If another request has already changed the status,
 * `updateMany` returns { count: 0 } and we throw a conflict error.
 *
 * Usage in services:
 *   const current = await prisma.mrrv.findUnique({ where: { id } });
 *   assertTransition('grn', current.status, 'pending_qc');
 *   await safeStatusUpdate(prisma.mrrv, id, current.status, { status: 'pending_qc' });
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
 * @returns         The count of updated records (should be 1)
 */
export async function safeStatusUpdate(
  delegate: PrismaDelegate,
  id: string,
  expectedStatus: string,
  data: Record<string, unknown>,
): Promise<number> {
  const result = await delegate.updateMany({
    where: { id, status: expectedStatus },
    data,
  });

  if (result.count === 0) {
    throw new ConflictError(
      `Status transition conflict: the record has been modified by another request. ` +
        `Expected status '${expectedStatus}' but it has already changed. Please refresh and try again.`,
    );
  }

  return result.count;
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
): Promise<number> {
  return safeStatusUpdate(txDelegate, id, expectedStatus, data);
}
