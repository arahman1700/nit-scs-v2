/**
 * Shared MIRV operations — extracted from mi.service.ts and mirv.service.ts
 * to eliminate duplicated QC signature, issuance, and cancellation logic.
 *
 * All functions accept a Prisma transaction client so they compose inside transactions.
 */
import type { PrismaClient } from '@prisma/client';
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
  qcSignatureId?: string | null;
  gatePassAutoCreated?: boolean | null;
  mirvLines: Array<{
    id: string;
    itemId: string;
    qtyRequested: number | any;
    qtyApproved: number | null | any;
  }>;
}

/**
 * QC counter-signature for an approved MIRV (V5 requirement).
 * Must be called before materials can be issued.
 */
export async function signQcForMirv(tx: TxClient | PrismaClient, mirvId: string, qcUserId: string) {
  const mirv = await (tx as any).mirv.findUnique({ where: { id: mirvId } });
  if (!mirv) throw new NotFoundError('MIRV', mirvId);
  if (mirv.status !== 'approved') {
    throw new BusinessRuleError('MIRV must be approved for QC signature');
  }
  return (tx as any).mirv.update({
    where: { id: mirvId },
    data: { qcSignatureId: qcUserId } as any,
  });
}

/**
 * Issue materials for an approved MIRV.
 * Consumes reservations, updates line costs, sets status to issued,
 * and auto-creates an outbound GatePass if not already created.
 */
export async function issueMirv(tx: TxClient | PrismaClient, mirvId: string, userId: string) {
  const mirv: MirvWithLines | null = await (tx as any).mirv.findUnique({
    where: { id: mirvId },
    include: { mirvLines: true },
  });
  if (!mirv) throw new NotFoundError('MIRV', mirvId);
  if (mirv.status !== 'approved' && mirv.status !== 'partially_issued') {
    throw new BusinessRuleError('MIRV must be approved or partially issued to issue materials');
  }

  // V5 requirement: QC counter-signature must be present before issuing
  if (!(mirv as any).qcSignatureId) {
    throw new BusinessRuleError('QC counter-signature is required before issuing materials (V5 requirement)');
  }

  const consumeItems = mirv.mirvLines.map(line => ({
    itemId: line.itemId,
    warehouseId: mirv.warehouseId,
    qty: Number(line.qtyApproved ?? line.qtyRequested),
    mirvLineId: line.id,
  }));
  const { totalCost, lineCosts } = await consumeReservationBatch(consumeItems);

  // Update line costs from batch result
  await Promise.all(
    mirv.mirvLines.map(line => {
      const qtyToIssue = Number(line.qtyApproved ?? line.qtyRequested);
      const cost = lineCosts.get(line.id) ?? 0;
      return (tx as any).mirvLine.update({
        where: { id: line.id },
        data: {
          qtyIssued: qtyToIssue,
          unitCost: qtyToIssue > 0 ? cost / qtyToIssue : 0,
        },
      });
    }),
  );

  await (tx as any).mirv.update({
    where: { id: mirv.id },
    data: {
      status: 'issued',
      issuedById: userId,
      issuedDate: new Date(),
      reservationStatus: 'released',
    },
  });

  // Auto-create outbound GatePass (idempotent — only if not already auto-created)
  if (!(mirv as any).gatePassAutoCreated) {
    const gatePassNumber = await generateDocumentNumber('gatepass');
    await (tx as any).gatePass.create({
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
    await (tx as any).mirv.update({
      where: { id: mirv.id },
      data: { gatePassAutoCreated: true } as any,
    });
  }

  return { id: mirv.id, totalCost, warehouseId: mirv.warehouseId };
}

/**
 * Cancel a MIRV, releasing any reserved stock.
 */
export async function cancelMirv(tx: TxClient | PrismaClient, mirvId: string) {
  const mirv: MirvWithLines | null = await (tx as any).mirv.findUnique({
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

  const updated = await (tx as any).mirv.update({
    where: { id: mirv.id },
    data: { status: 'cancelled', reservationStatus: 'released' },
  });

  return {
    updated,
    wasReserved: mirv.reservationStatus === 'reserved',
    warehouseId: mirv.warehouseId,
  };
}
