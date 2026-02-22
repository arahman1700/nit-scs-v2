/**
 * MRN Service — V2 rename of MRV (Material Return Voucher)
 * Prisma model: mrv (unchanged)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type {
  MrvCreateDto as MrnCreateDto,
  MrvUpdateDto as MrnUpdateDto,
  MrvLineDto as MrnLineDto,
  ListParams,
} from '../types/dto.js';

const DOC_TYPE = 'mrn';

const LIST_INCLUDE = {
  project: { select: { id: true, projectName: true, projectCode: true } },
  toWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  fromWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  returnedBy: { select: { id: true, fullName: true } },
  _count: { select: { mrvLines: true } },
} satisfies Prisma.MrvInclude;

const DETAIL_INCLUDE = {
  mrvLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  project: true,
  toWarehouse: true,
  fromWarehouse: true,
  returnedBy: { select: { id: true, fullName: true, email: true } },
  receivedBy: { select: { id: true, fullName: true, email: true } },
  originalMirv: { select: { id: true, mirvNumber: true } },
} satisfies Prisma.MrvInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ mrvNumber: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  // Row-level security scope filters (MRN has toWarehouseId, not warehouseId)
  if (params.toWarehouseId) where.toWarehouseId = params.toWarehouseId;
  if (params.projectId) where.projectId = params.projectId;
  if (params.returnedById) where.returnedById = params.returnedById;

  const [data, total] = await Promise.all([
    prisma.mrv.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.mrv.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const mrn = await prisma.mrv.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!mrn) throw new NotFoundError('MRN', id);
  return mrn;
}

export async function create(headerData: Omit<MrnCreateDto, 'lines'>, lines: MrnLineDto[], userId: string) {
  return prisma.$transaction(async tx => {
    const mrvNumber = await generateDocumentNumber('mrv');
    return tx.mrv.create({
      data: {
        mrvNumber,
        returnType: headerData.returnType,
        projectId: headerData.projectId,
        fromWarehouseId: headerData.fromWarehouseId ?? null,
        toWarehouseId: headerData.toWarehouseId,
        returnedById: userId,
        returnDate: new Date(headerData.returnDate),
        reason: headerData.reason ?? null,
        originalMirvId: headerData.originalMiId ?? null,
        status: 'draft',
        notes: headerData.notes ?? null,
        mrvLines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            qtyReturned: line.qtyReturned,
            uomId: line.uomId,
            condition: line.condition,
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        mrvLines: true,
        project: { select: { id: true, projectName: true } },
        toWarehouse: { select: { id: true, warehouseName: true } },
      },
    });
  });
}

export async function update(id: string, data: MrnUpdateDto) {
  const existing = await prisma.mrv.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('MRN', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft MRNs can be updated');

  const updated = await prisma.mrv.update({
    where: { id },
    data: {
      ...data,
      ...(data.returnDate ? { returnDate: new Date(data.returnDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string) {
  const mrn = await prisma.mrv.findUnique({ where: { id } });
  if (!mrn) throw new NotFoundError('MRN', id);
  assertTransition(DOC_TYPE, mrn.status, 'pending');

  return prisma.mrv.update({ where: { id: mrn.id }, data: { status: 'pending' } });
}

export async function receive(id: string, userId: string) {
  const mrn = await prisma.mrv.findUnique({ where: { id } });
  if (!mrn) throw new NotFoundError('MRN', id);
  assertTransition(DOC_TYPE, mrn.status, 'received');

  return prisma.mrv.update({
    where: { id: mrn.id },
    data: { status: 'received', receivedById: userId, receivedDate: new Date() },
  });
}

export async function complete(id: string, userId: string) {
  const mrn = await prisma.mrv.findUnique({
    where: { id },
    include: { mrvLines: true },
  });
  if (!mrn) throw new NotFoundError('MRN', id);
  assertTransition(DOC_TYPE, mrn.status, 'completed');

  await prisma.mrv.update({ where: { id: mrn.id }, data: { status: 'completed' } });

  // Restock good-condition items as active lots
  const goodLines = mrn.mrvLines.filter(l => l.condition === 'good');
  const goodStockItems = goodLines.map(line => ({
    itemId: line.itemId,
    warehouseId: mrn.toWarehouseId,
    qty: Number(line.qtyReturned),
    performedById: userId,
  }));

  // Restock damaged/used items as blocked lots (need inspection before use)
  const damagedLines = mrn.mrvLines.filter(l => l.condition === 'damaged' || l.condition === 'used');
  const blockedStockItems = damagedLines.map(line => ({
    itemId: line.itemId,
    warehouseId: mrn.toWarehouseId,
    qty: Number(line.qtyReturned),
    performedById: userId,
    lotStatus: 'blocked' as const,
  }));

  await addStockBatch([...goodStockItems, ...blockedStockItems]);

  // Publish event for downstream listeners
  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'mrv',
    entityId: mrn.id,
    action: 'status_change',
    payload: {
      from: mrn.status,
      to: 'completed',
      goodLinesRestocked: goodLines.length,
      blockedLinesRestocked: damagedLines.length,
    },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  // If damaged items were returned, notify QC team for inspection of blocked lots
  if (damagedLines.length > 0) {
    eventBus.publish({
      type: 'inventory:blocked_lots_created',
      entityType: 'mrv',
      entityId: mrn.id,
      action: 'damaged_return_inspection_needed',
      payload: {
        mrvNumber: mrn.mrvNumber,
        toWarehouseId: mrn.toWarehouseId,
        damagedLineCount: damagedLines.length,
        items: damagedLines.map(l => ({
          itemId: l.itemId,
          qty: Number(l.qtyReturned),
          condition: l.condition,
        })),
      },
      performedById: userId,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    id: mrn.id,
    toWarehouseId: mrn.toWarehouseId,
    goodLinesRestocked: goodLines.length,
    blockedLinesRestocked: damagedLines.length,
    totalLines: mrn.mrvLines.length,
  };
}
