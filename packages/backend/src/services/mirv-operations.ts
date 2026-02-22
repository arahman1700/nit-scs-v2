/**
 * Shared MIRV operations — extracted from mi.service.ts and mirv.service.ts
 * to eliminate duplicated QC signature, issuance, and cancellation logic.
 *
 * All functions accept a Prisma transaction client so they compose inside transactions.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { generateDocumentNumber } from './document-number.service.js';
import { consumeReservationBatch, releaseReservation } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

interface MirvWithLines {
  id: string;
  mirvNumber: string;
  status: string;
  warehouseId: string;
  projectId: string;
  locationOfWork: string | null;
  reservationStatus: string | null;
  qcSignatureId: string | null;
  gatePassAutoCreated: boolean;
  mirvLines: Array<{
    id: string;
    itemId: string;
    qtyRequested: Prisma.Decimal;
    qtyApproved: Prisma.Decimal | null;
    qtyIssued: Prisma.Decimal | null;
  }>;
}

/** Optional per-line quantities for partial issuance */
export interface PartialIssueItem {
  lineId: string;
  qty: number;
}

/**
 * QC counter-signature for an approved MIRV (V5 requirement).
 * Must be called before materials can be issued.
 */
export async function signQcForMirv(tx: TxClient | PrismaClient, mirvId: string, qcUserId: string) {
  const mirv = await tx.mirv.findUnique({ where: { id: mirvId } });
  if (!mirv) throw new NotFoundError('MIRV', mirvId);
  if (mirv.status !== 'approved') {
    throw new BusinessRuleError('MIRV must be approved for QC signature');
  }
  return tx.mirv.update({
    where: { id: mirvId },
    data: { qcSignatureId: qcUserId },
  });
}

/**
 * Issue materials for an approved MIRV.
 * Consumes reservations, updates line costs, sets status to issued,
 * and auto-creates an outbound GatePass if not already created.
 */
/**
 * Issue materials for an approved MIRV.
 * Supports full issuance (default) and partial issuance via `partialItems`.
 * When partial items are provided, only those lines/quantities are consumed.
 * Status is set to 'partially_issued' or 'issued' depending on fulfillment.
 */
export async function issueMirv(
  tx: TxClient | PrismaClient,
  mirvId: string,
  userId: string,
  partialItems?: PartialIssueItem[],
) {
  const mirv: MirvWithLines | null = await tx.mirv.findUnique({
    where: { id: mirvId },
    include: { mirvLines: true },
  });
  if (!mirv) throw new NotFoundError('MIRV', mirvId);
  if (mirv.status !== 'approved' && mirv.status !== 'partially_issued') {
    throw new BusinessRuleError('MIRV must be approved or partially issued to issue materials');
  }

  // V5 requirement: QC counter-signature must be present before issuing
  if (!mirv.qcSignatureId) {
    throw new BusinessRuleError('QC counter-signature is required before issuing materials (V5 requirement)');
  }

  // Build per-line quantities to issue
  const partialMap = partialItems ? new Map(partialItems.map(p => [p.lineId, p.qty])) : null;

  const consumeItems = mirv.mirvLines
    .map(line => {
      const approvedQty = Number(line.qtyApproved ?? line.qtyRequested);
      const alreadyIssued = Number(line.qtyIssued ?? 0);
      const remaining = approvedQty - alreadyIssued;

      if (remaining <= 0) return null; // Already fully issued

      let qtyToIssue: number;
      if (partialMap) {
        qtyToIssue = partialMap.get(line.id) ?? 0;
        if (qtyToIssue <= 0) return null; // Not included in this partial issue
        qtyToIssue = Math.min(qtyToIssue, remaining); // Cap at remaining
      } else {
        qtyToIssue = remaining; // Full issue of remaining qty
      }

      return {
        itemId: line.itemId,
        warehouseId: mirv.warehouseId,
        qty: qtyToIssue,
        mirvLineId: line.id,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (consumeItems.length === 0) {
    throw new BusinessRuleError('No items remaining to issue');
  }

  const { totalCost, lineCosts } = await consumeReservationBatch(consumeItems);

  // Update line costs and qtyIssued from batch result
  await Promise.all(
    consumeItems.map(item => {
      const line = mirv.mirvLines.find(l => l.id === item.mirvLineId)!;
      const prevIssued = Number(line.qtyIssued ?? 0);
      const newIssued = prevIssued + item.qty;
      const cost = lineCosts.get(item.mirvLineId) ?? 0;
      return tx.mirvLine.update({
        where: { id: item.mirvLineId },
        data: {
          qtyIssued: newIssued,
          unitCost: newIssued > 0 ? cost / item.qty : 0,
        },
      });
    }),
  );

  // Determine final status: check if ALL lines are fully issued
  const allFullyIssued = mirv.mirvLines.every(line => {
    const approvedQty = Number(line.qtyApproved ?? line.qtyRequested);
    const prevIssued = Number(line.qtyIssued ?? 0);
    const issuedNow = consumeItems.find(c => c.mirvLineId === line.id)?.qty ?? 0;
    return prevIssued + issuedNow >= approvedQty;
  });

  const newStatus = allFullyIssued ? 'issued' : 'partially_issued';

  await tx.mirv.update({
    where: { id: mirv.id },
    data: {
      status: newStatus,
      issuedById: userId,
      issuedDate: new Date(),
      reservationStatus: allFullyIssued ? 'released' : mirv.reservationStatus,
    },
  });

  // Auto-create outbound GatePass (idempotent — only if not already auto-created)
  if (!mirv.gatePassAutoCreated) {
    const gatePassNumber = await generateDocumentNumber('gatepass');
    await tx.gatePass.create({
      data: {
        gatePassNumber,
        passType: 'outbound',
        mirvId: mirv.id,
        projectId: mirv.projectId,
        warehouseId: mirv.warehouseId,
        vehicleNumber: 'TBD',
        driverName: 'TBD',
        destination: mirv.locationOfWork ?? 'Project Site',
        issueDate: new Date(),
        status: 'pending',
        issuedById: userId,
        notes: `Auto-created from MI ${mirv.mirvNumber}`,
      },
    });
    await tx.mirv.update({
      where: { id: mirv.id },
      data: { gatePassAutoCreated: true },
    });
  }

  return { id: mirv.id, totalCost, warehouseId: mirv.warehouseId, status: newStatus };
}

/**
 * Cancel a MIRV, releasing any reserved stock.
 */
export async function cancelMirv(tx: TxClient | PrismaClient, mirvId: string) {
  const mirv: MirvWithLines | null = await tx.mirv.findUnique({
    where: { id: mirvId },
    include: { mirvLines: true },
  });
  if (!mirv) throw new NotFoundError('MIRV', mirvId);

  const cancellableStatuses = ['approved', 'partially_issued', 'pending_approval'];
  if (!cancellableStatuses.includes(mirv.status)) {
    throw new BusinessRuleError(`MIRV cannot be cancelled from status: ${mirv.status}`);
  }

  if (mirv.reservationStatus === 'reserved') {
    for (const line of mirv.mirvLines) {
      await releaseReservation(line.itemId, mirv.warehouseId, Number(line.qtyApproved ?? line.qtyRequested));
    }
  }

  const updated = await tx.mirv.update({
    where: { id: mirv.id },
    data: { status: 'cancelled', reservationStatus: 'released' },
  });

  return {
    updated,
    wasReserved: mirv.reservationStatus === 'reserved',
    warehouseId: mirv.warehouseId,
  };
}
