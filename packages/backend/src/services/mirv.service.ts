import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { submitForApproval, processApproval } from './approval.service.js';
import { reserveStockBatch } from './inventory.service.js';
import { signQcForMirv, issueMirv, cancelMirv } from './mirv-operations.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { Server as SocketIOServer } from 'socket.io';
import type { MirvCreateDto, MirvUpdateDto, MirvLineDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'mirv';

const LIST_INCLUDE = {
  project: { select: { id: true, projectName: true, projectCode: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  requestedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  _count: { select: { mirvLines: true } },
} satisfies Prisma.MirvInclude;

const DETAIL_INCLUDE = {
  mirvLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true, standardCost: true } },
    },
  },
  project: true,
  warehouse: true,
  requestedBy: { select: { id: true, fullName: true, email: true } },
  approvedBy: { select: { id: true, fullName: true, email: true } },
  issuedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.MirvInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { mirvNumber: { contains: params.search, mode: 'insensitive' } },
      { project: { projectName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  // Row-level security scope filters
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.projectId) where.projectId = params.projectId;
  if (params.requestedById) where.requestedById = params.requestedById;

  const [data, total] = await Promise.all([
    prisma.mirv.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.mirv.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const mirv = await prisma.mirv.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!mirv) throw new NotFoundError('MIRV', id);
  return mirv;
}

export async function create(headerData: Omit<MirvCreateDto, 'lines'>, lines: MirvLineDto[], userId: string) {
  const mirv = await prisma.$transaction(async tx => {
    const mirvNumber = await generateDocumentNumber('mirv');

    // Batch-fetch item costs to avoid N+1 queries
    const itemIds = lines.map(l => l.itemId);
    const items = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, standardCost: true },
    });
    const costMap = new Map(items.map(i => [i.id, Number(i.standardCost ?? 0)]));

    let estimatedValue = 0;
    for (const line of lines) {
      const cost = costMap.get(line.itemId) ?? 0;
      if (cost > 0) {
        estimatedValue += cost * line.qtyRequested;
      }
    }

    return tx.mirv.create({
      data: {
        mirvNumber,
        projectId: headerData.projectId,
        warehouseId: headerData.warehouseId,
        locationOfWork: headerData.locationOfWork ?? null,
        requestedById: userId,
        requestDate: new Date(headerData.requestDate),
        requiredDate: headerData.requiredDate ? new Date(headerData.requiredDate) : null,
        priority: headerData.priority ?? 'normal',
        estimatedValue,
        status: 'draft',
        notes: headerData.notes ?? null,
        mirvLines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            qtyRequested: line.qtyRequested,
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        mirvLines: true,
        project: { select: { id: true, projectName: true } },
        warehouse: { select: { id: true, warehouseName: true } },
      },
    });
  });
  return mirv;
}

export async function update(id: string, data: MirvUpdateDto) {
  const existing = await prisma.mirv.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('MIRV', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft MIRVs can be updated');

  const updated = await prisma.mirv.update({
    where: { id },
    data: {
      ...data,
      ...(data.requestDate ? { requestDate: new Date(data.requestDate) } : {}),
      ...(data.requiredDate ? { requiredDate: new Date(data.requiredDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string, userId: string, io?: SocketIOServer) {
  const mirv = await prisma.mirv.findUnique({ where: { id } });
  if (!mirv) throw new NotFoundError('MIRV', id);
  assertTransition(DOC_TYPE, mirv.status, 'pending_approval');

  const approval = await submitForApproval({
    documentType: 'mirv',
    documentId: mirv.id,
    amount: Number(mirv.estimatedValue ?? 0),
    submittedById: userId,
    io,
  });
  return { id: mirv.id, approverRole: approval.approverRole, slaHours: approval.slaHours };
}

export async function approve(
  id: string,
  action: 'approve' | 'reject',
  userId: string,
  comments?: string,
  io?: SocketIOServer,
) {
  const mirv = await prisma.mirv.findUnique({
    where: { id },
    include: { mirvLines: true },
  });
  if (!mirv) throw new NotFoundError('MIRV', id);
  if (mirv.status !== 'pending_approval') {
    throw new BusinessRuleError('MIRV must be pending approval');
  }

  await processApproval({
    documentType: 'mirv',
    documentId: mirv.id,
    action,
    processedById: userId,
    comments,
    io,
  });

  if (action === 'approve') {
    const reserveItems = mirv.mirvLines.map(line => ({
      itemId: line.itemId,
      warehouseId: mirv.warehouseId,
      qty: Number(line.qtyRequested),
    }));
    const { success: allReserved } = await reserveStockBatch(reserveItems);

    // Update all line approvals
    await Promise.all(
      mirv.mirvLines.map(line =>
        prisma.mirvLine.update({
          where: { id: line.id },
          data: { qtyApproved: line.qtyRequested },
        }),
      ),
    );

    await prisma.mirv.update({
      where: { id: mirv.id },
      data: { reservationStatus: allReserved ? 'reserved' : 'none' },
    });
  }

  return {
    id: mirv.id,
    action,
    status: action === 'approve' ? 'approved' : 'rejected',
    warehouseId: mirv.warehouseId,
  };
}

/**
 * QC counter-signature for an approved MIRV (V5 requirement).
 * Delegates to shared mirv-operations.
 */
export async function signQc(id: string, qcUserId: string) {
  return signQcForMirv(prisma, id, qcUserId);
}

/**
 * Issue materials for an approved MIRV.
 * Delegates to shared mirv-operations.
 */
export async function issue(id: string, userId: string) {
  return issueMirv(prisma, id, userId);
}

/**
 * Cancel a MIRV, releasing any reserved stock.
 * Delegates to shared mirv-operations.
 */
export async function cancel(id: string) {
  return cancelMirv(prisma, id);
}
