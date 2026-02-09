/**
 * MI Service — V2 rename of MIRV (Material Issue/Return Voucher)
 * Prisma model: mirv (unchanged)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { submitForApproval, processApproval } from './approval.service.js';
import { reserveStockBatch, consumeReservationBatch, releaseReservation } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { Server as SocketIOServer } from 'socket.io';
import type {
  MirvCreateDto as MiCreateDto,
  MirvUpdateDto as MiUpdateDto,
  MirvLineDto as MiLineDto,
  ListParams,
} from '../types/dto.js';

const DOC_TYPE = 'mi';

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
  const mi = await prisma.mirv.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!mi) throw new NotFoundError('MI', id);
  return mi;
}

export async function create(headerData: Omit<MiCreateDto, 'lines'>, lines: MiLineDto[], userId: string) {
  const mi = await prisma.$transaction(async tx => {
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
  return mi;
}

export async function update(id: string, data: MiUpdateDto) {
  const existing = await prisma.mirv.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('MI', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft MIs can be updated');

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
  const mi = await prisma.mirv.findUnique({ where: { id } });
  if (!mi) throw new NotFoundError('MI', id);
  assertTransition(DOC_TYPE, mi.status, 'pending_approval');

  const approval = await submitForApproval({
    documentType: 'mirv',
    documentId: mi.id,
    amount: Number(mi.estimatedValue ?? 0),
    submittedById: userId,
    io,
  });
  return { id: mi.id, approverRole: approval.approverRole, slaHours: approval.slaHours };
}

export async function approve(
  id: string,
  action: 'approve' | 'reject',
  userId: string,
  comments?: string,
  io?: SocketIOServer,
) {
  const mi = await prisma.mirv.findUnique({
    where: { id },
    include: { mirvLines: true },
  });
  if (!mi) throw new NotFoundError('MI', id);
  if (mi.status !== 'pending_approval') {
    throw new BusinessRuleError('MI must be pending approval');
  }

  await processApproval({
    documentType: 'mirv',
    documentId: mi.id,
    action,
    processedById: userId,
    comments,
    io,
  });

  if (action === 'approve') {
    const reserveItems = mi.mirvLines.map(line => ({
      itemId: line.itemId,
      warehouseId: mi.warehouseId,
      qty: Number(line.qtyRequested),
    }));
    const { success: allReserved } = await reserveStockBatch(reserveItems);

    // Update all line approvals
    await Promise.all(
      mi.mirvLines.map(line =>
        prisma.mirvLine.update({
          where: { id: line.id },
          data: { qtyApproved: line.qtyRequested },
        }),
      ),
    );

    await prisma.mirv.update({
      where: { id: mi.id },
      data: { reservationStatus: allReserved ? 'reserved' : 'none' },
    });
  }

  return {
    id: mi.id,
    action,
    status: action === 'approve' ? 'approved' : 'rejected',
    warehouseId: mi.warehouseId,
  };
}

export async function issue(id: string, userId: string) {
  const mi = await prisma.mirv.findUnique({
    where: { id },
    include: { mirvLines: true },
  });
  if (!mi) throw new NotFoundError('MI', id);
  if (mi.status !== 'approved' && mi.status !== 'partially_issued') {
    throw new BusinessRuleError('MI must be approved or partially issued to issue materials');
  }

  const consumeItems = mi.mirvLines.map(line => ({
    itemId: line.itemId,
    warehouseId: mi.warehouseId,
    qty: Number(line.qtyApproved ?? line.qtyRequested),
    mirvLineId: line.id,
  }));
  const { totalCost, lineCosts } = await consumeReservationBatch(consumeItems);

  // Update line costs from batch result
  await Promise.all(
    mi.mirvLines.map(line => {
      const qtyToIssue = Number(line.qtyApproved ?? line.qtyRequested);
      const cost = lineCosts.get(line.id) ?? 0;
      return prisma.mirvLine.update({
        where: { id: line.id },
        data: {
          qtyIssued: qtyToIssue,
          unitCost: qtyToIssue > 0 ? cost / qtyToIssue : 0,
        },
      });
    }),
  );

  await prisma.mirv.update({
    where: { id: mi.id },
    data: {
      status: 'issued',
      issuedById: userId,
      issuedDate: new Date(),
      reservationStatus: 'released',
    },
  });

  // Auto-create outbound GatePass
  const gatePassNumber = await generateDocumentNumber('gatepass');
  await prisma.gatePass.create({
    data: {
      gatePassNumber,
      passType: 'outbound',
      mirvId: mi.id,
      projectId: mi.projectId,
      warehouseId: mi.warehouseId,
      vehicleNumber: 'TBD',
      driverName: 'TBD',
      destination: mi.locationOfWork ?? 'Project Site',
      issueDate: new Date(),
      status: 'pending',
      issuedById: userId,
    },
  });

  return { id: mi.id, totalCost, warehouseId: mi.warehouseId };
}

export async function cancel(id: string) {
  const mi = await prisma.mirv.findUnique({
    where: { id },
    include: { mirvLines: true },
  });
  if (!mi) throw new NotFoundError('MI', id);

  const cancellableStatuses = ['approved', 'partially_issued', 'pending_approval'];
  if (!cancellableStatuses.includes(mi.status)) {
    throw new BusinessRuleError(`MI cannot be cancelled from status: ${mi.status}`);
  }

  if (mi.reservationStatus === 'reserved') {
    for (const line of mi.mirvLines) {
      await releaseReservation(line.itemId, mi.warehouseId, Number(line.qtyApproved ?? line.qtyRequested));
    }
  }

  const updated = await prisma.mirv.update({
    where: { id: mi.id },
    data: { status: 'cancelled', reservationStatus: 'released' },
  });

  return {
    updated,
    wasReserved: mi.reservationStatus === 'reserved',
    warehouseId: mi.warehouseId,
  };
}
