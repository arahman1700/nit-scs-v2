/**
 * QCI Service — V2 rename of RFIM (Request for Inspection of Materials)
 * Prisma model: rfim (unchanged)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { NotFoundError, BusinessRuleError, ConflictError } from '@nit-scs-v2/shared';
import { assertTransition, canTransition } from '@nit-scs-v2/shared';
import { safeStatusUpdate, safeStatusUpdateTx } from '../../../utils/safe-status-transition.js';
import { eventBus } from '../../../events/event-bus.js';
import type { RfimUpdateDto as QciUpdateDto, ListParams } from '../../../types/dto.js';

const DOC_TYPE = 'qci';

const LIST_INCLUDE = {
  mrrv: { select: { id: true, mrrvNumber: true, status: true } },
  inspector: { select: { id: true, fullName: true } },
} satisfies Prisma.RfimInclude;

const DETAIL_INCLUDE = {
  mrrv: {
    include: {
      mrrvLines: {
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true } },
          uom: { select: { id: true, uomCode: true, uomName: true } },
        },
      },
      supplier: { select: { id: true, supplierName: true } },
      warehouse: { select: { id: true, warehouseName: true } },
    },
  },
  inspector: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RfimInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ rfimNumber: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  // Row-level security: QCI scoping is via parent MRRV's warehouse/project
  if (params.warehouseId)
    where.mrrv = { ...((where.mrrv as Record<string, unknown>) ?? {}), warehouseId: params.warehouseId };
  if (params.projectId)
    where.mrrv = { ...((where.mrrv as Record<string, unknown>) ?? {}), projectId: params.projectId };
  if (params.inspectorId) where.inspectorId = params.inspectorId;

  const [data, total] = await Promise.all([
    prisma.rfim.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.rfim.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const qci = await prisma.rfim.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!qci) throw new NotFoundError('QCI', id);
  return qci;
}

export async function update(id: string, data: QciUpdateDto) {
  const existing = await prisma.rfim.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('QCI', id);

  const { version, ...rest } = data;
  const updateData = { ...rest, version: (existing.version ?? 0) + 1 };

  if (version !== undefined) {
    const result = await prisma.rfim.updateMany({ where: { id, version }, data: updateData });
    if (result.count === 0) {
      throw new ConflictError('Document was modified by another user. Please refresh and try again.');
    }
  } else {
    await prisma.rfim.update({ where: { id }, data: updateData });
  }

  const updated = await prisma.rfim.findUnique({ where: { id } });
  return { existing, updated };
}

export async function start(id: string, userId: string) {
  const qci = await prisma.rfim.findUnique({ where: { id } });
  if (!qci) throw new NotFoundError('QCI', id);
  assertTransition(DOC_TYPE, qci.status, 'in_progress');

  await safeStatusUpdate(prisma.rfim, qci.id, qci.status, {
    status: 'in_progress',
    inspectionDate: new Date(),
    inspectorId: userId,
  });
  return prisma.rfim.findUnique({ where: { id: qci.id } });
}

export async function complete(id: string, result: string, comments?: string) {
  const qci = await prisma.rfim.findUnique({ where: { id } });
  if (!qci) throw new NotFoundError('QCI', id);

  if (!result || !['pass', 'fail', 'conditional'].includes(result)) {
    throw new BusinessRuleError('Inspection result is required (pass, fail, or conditional)');
  }

  // If result is 'conditional', route through completeConditional instead
  if (result === 'conditional') {
    return completeConditional(id, comments);
  }

  assertTransition(DOC_TYPE, qci.status, 'completed');

  const updated = await prisma.$transaction(async tx => {
    await safeStatusUpdateTx(tx.rfim, qci.id, qci.status, {
      status: 'completed',
      result,
      comments: comments ?? qci.comments,
    });
    const completedQci = await tx.rfim.findUnique({ where: { id: qci.id } });

    // Chain: QCI pass → update parent GRN to qc_approved
    if (result === 'pass' && qci.mrrvId) {
      const parentGrn = await tx.mrrv.findUnique({ where: { id: qci.mrrvId } });
      if (parentGrn && canTransition('grn', parentGrn.status, 'qc_approved')) {
        await safeStatusUpdateTx(tx.mrrv, parentGrn.id, parentGrn.status, {
          status: 'qc_approved',
          qcApprovedDate: new Date(),
        });
      }
    }

    // Chain: QCI fail → auto-create DR if none exists for this GRN
    if (result === 'fail' && qci.mrrvId) {
      const existingDr = await tx.osdReport.findFirst({
        where: { mrrvId: qci.mrrvId },
      });
      if (!existingDr) {
        const drNumber = await generateDocumentNumber('dr');
        await tx.osdReport.create({
          data: {
            osdNumber: drNumber,
            mrrvId: qci.mrrvId,
            reportDate: new Date(),
            reportTypes: ['quality_failure'],
            status: 'draft',
          },
        });
      }
    }

    return completedQci;
  });

  // Publish events
  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'rfim',
    entityId: qci.id,
    action: 'status_change',
    payload: { from: qci.status, to: 'completed', result, mrrvId: qci.mrrvId },
    timestamp: new Date().toISOString(),
  });

  if (result === 'pass' && qci.mrrvId) {
    eventBus.publish({
      type: 'document:status_changed',
      entityType: 'mrrv',
      entityId: qci.mrrvId,
      action: 'status_change',
      payload: { from: 'pending_qc', to: 'qc_approved', triggeredByQci: qci.id },
      timestamp: new Date().toISOString(),
    });
  }

  return { updated, mrrvId: qci.mrrvId };
}

/**
 * Complete a QCI with a conditional acceptance result.
 * Sets status to 'completed_conditional' which requires PM approval to become fully completed.
 * The pmApprovalRequired flag is implicitly true for conditional completions.
 */
export async function completeConditional(id: string, comments?: string) {
  const qci = await prisma.rfim.findUnique({ where: { id } });
  if (!qci) throw new NotFoundError('QCI', id);
  assertTransition(DOC_TYPE, qci.status, 'completed_conditional');

  await safeStatusUpdate(prisma.rfim, qci.id, qci.status, {
    status: 'completed_conditional',
    result: 'conditional',
    comments: comments ?? qci.comments,
    pmApprovalRequired: true,
  });
  const updated = await prisma.rfim.findUnique({ where: { id: qci.id } });
  return { updated, mrrvId: qci.mrrvId, pmApprovalRequired: true };
}

/**
 * PM approves a conditional QCI, upgrading it to fully completed.
 * Only QCIs in 'completed_conditional' status can be PM-approved.
 */
export async function pmApprove(id: string, pmUserId: string, comments?: string) {
  const qci = await prisma.rfim.findUnique({ where: { id } });
  if (!qci) throw new NotFoundError('QCI', id);

  if (qci.status !== 'completed_conditional') {
    throw new BusinessRuleError('Only conditionally completed QCIs can receive PM approval');
  }
  assertTransition(DOC_TYPE, qci.status, 'completed');

  await safeStatusUpdate(prisma.rfim, qci.id, qci.status, {
    status: 'completed',
    comments: comments ? `${qci.comments ?? ''}\n[PM Approval] ${comments}`.trim() : qci.comments,
    pmApprovalById: pmUserId,
    pmApprovalDate: new Date(),
  });
  const updated = await prisma.rfim.findUnique({ where: { id: qci.id } });

  // Auto-advance parent GRN to qc_approved (mirrors the pass path in complete())
  let grnAdvanced = false;
  if (qci.mrrvId) {
    const parentGrn = await prisma.mrrv.findUnique({ where: { id: qci.mrrvId } });
    if (parentGrn && canTransition('grn', parentGrn.status, 'qc_approved')) {
      await safeStatusUpdate(prisma.mrrv, parentGrn.id, parentGrn.status, { status: 'qc_approved' });
      grnAdvanced = true;

      eventBus.publish({
        type: 'document:status_changed',
        entityType: 'mrrv',
        entityId: parentGrn.id,
        action: 'status_change',
        payload: { from: parentGrn.status, to: 'qc_approved', triggeredBy: 'qci_pm_approval' },
        performedById: pmUserId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'rfim',
    entityId: qci.id,
    action: 'status_change',
    payload: { from: 'completed_conditional', to: 'completed', pmApprovedBy: pmUserId, grnAdvanced },
    performedById: pmUserId,
    timestamp: new Date().toISOString(),
  });

  return { updated, mrrvId: qci.mrrvId, pmApprovedBy: pmUserId, grnAdvanced };
}
