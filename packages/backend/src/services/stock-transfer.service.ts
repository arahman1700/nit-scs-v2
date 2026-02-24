import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch, deductStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type { StockTransferCreateDto, StockTransferUpdateDto, StockTransferLineDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'stock_transfer';
/** V2 key for DOC_PREFIXES — used only for document-number generation */
const DOC_NUMBER_KEY = 'wt';

const LIST_INCLUDE = {
  fromWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  toWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  fromProject: { select: { id: true, projectName: true, projectCode: true } },
  toProject: { select: { id: true, projectName: true, projectCode: true } },
  requestedBy: { select: { id: true, fullName: true } },
  _count: { select: { stockTransferLines: true } },
} satisfies Prisma.StockTransferInclude;

const DETAIL_INCLUDE = {
  stockTransferLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  fromWarehouse: true,
  toWarehouse: true,
  fromProject: true,
  toProject: true,
  requestedBy: { select: { id: true, fullName: true, email: true } },
  sourceMrv: { select: { id: true, mrvNumber: true, status: true } },
  destinationMirv: { select: { id: true, mirvNumber: true, status: true } },
  transportJo: { select: { id: true, joNumber: true, status: true } },
  gatePass: { select: { id: true, gatePassNumber: true, status: true } },
} satisfies Prisma.StockTransferInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  const andClauses: Record<string, unknown>[] = [];
  if (params.search) {
    andClauses.push({ OR: [{ transferNumber: { contains: params.search, mode: 'insensitive' } }] });
  }
  if (params.status) where.status = params.status;
  if (params.transferType) where.transferType = params.transferType;
  // Row-level security: warehouse users see transfers involving their warehouse (source OR destination)
  if (params.fromWarehouseId) {
    andClauses.push({
      OR: [{ fromWarehouseId: params.fromWarehouseId }, { toWarehouseId: params.fromWarehouseId }],
    });
  }
  if (params.requestedById) where.requestedById = params.requestedById;
  if (andClauses.length > 0) where.AND = andClauses;

  const [data, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.stockTransfer.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const st = await prisma.stockTransfer.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!st) throw new NotFoundError('Stock Transfer', id);
  return st;
}

export async function create(
  headerData: Omit<StockTransferCreateDto, 'lines'>,
  lines: StockTransferLineDto[],
  userId: string,
) {
  return prisma.$transaction(async tx => {
    const transferNumber = await generateDocumentNumber(DOC_NUMBER_KEY);
    return tx.stockTransfer.create({
      data: {
        transferNumber,
        transferType: headerData.transferType,
        fromWarehouseId: headerData.fromWarehouseId,
        toWarehouseId: headerData.toWarehouseId,
        fromProjectId: headerData.fromProjectId ?? null,
        toProjectId: headerData.toProjectId ?? null,
        requestedById: userId,
        transferDate: new Date(headerData.transferDate),
        status: 'draft',
        notes: headerData.notes ?? null,
        stockTransferLines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            quantity: line.quantity,
            uomId: line.uomId,
            condition: line.condition ?? 'good',
          })),
        },
      },
      include: {
        stockTransferLines: true,
        fromWarehouse: { select: { id: true, warehouseName: true } },
        toWarehouse: { select: { id: true, warehouseName: true } },
      },
    });
  });
}

export async function update(id: string, data: StockTransferUpdateDto) {
  const existing = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Stock Transfer', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft Stock Transfers can be updated');

  const updated = await prisma.stockTransfer.update({
    where: { id },
    data: {
      ...data,
      ...(data.transferDate ? { transferDate: new Date(data.transferDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string) {
  const st = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!st) throw new NotFoundError('Stock Transfer', id);
  assertTransition(DOC_TYPE, st.status, 'pending');
  const updated = await prisma.stockTransfer.update({ where: { id: st.id }, data: { status: 'pending' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'stock_transfer',
    entityId: st.id,
    action: 'status_change',
    payload: { from: st.status, to: 'pending', transferType: st.transferType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function approve(id: string) {
  const st = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!st) throw new NotFoundError('Stock Transfer', id);
  assertTransition(DOC_TYPE, st.status, 'approved');
  const updated = await prisma.stockTransfer.update({ where: { id: st.id }, data: { status: 'approved' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'stock_transfer',
    entityId: st.id,
    action: 'status_change',
    payload: { from: st.status, to: 'approved', transferType: st.transferType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function ship(id: string) {
  const st = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { stockTransferLines: true },
  });
  if (!st) throw new NotFoundError('Stock Transfer', id);
  assertTransition(DOC_TYPE, st.status, 'shipped');

  const deductItems = st.stockTransferLines.map(line => ({
    itemId: line.itemId,
    warehouseId: st.fromWarehouseId,
    qty: Number(line.quantity),
    ref: { referenceType: 'stock_transfer_line', referenceId: line.id },
  }));
  await deductStockBatch(deductItems);

  const updated = await prisma.stockTransfer.update({
    where: { id: st.id },
    data: { status: 'shipped', shippedDate: new Date() },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'stock_transfer',
    entityId: st.id,
    action: 'status_change',
    payload: { from: st.status, to: 'shipped', fromWarehouseId: st.fromWarehouseId, toWarehouseId: st.toWarehouseId },
    timestamp: new Date().toISOString(),
  });

  return { updated, fromWarehouseId: st.fromWarehouseId };
}

export async function receive(id: string, userId: string) {
  const st = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { stockTransferLines: true },
  });
  if (!st) throw new NotFoundError('Stock Transfer', id);
  assertTransition(DOC_TYPE, st.status, 'received');

  const stockItems = st.stockTransferLines.map(line => ({
    itemId: line.itemId,
    warehouseId: st.toWarehouseId,
    qty: Number(line.quantity),
    performedById: userId,
  }));
  await addStockBatch(stockItems);

  const updated = await prisma.stockTransfer.update({
    where: { id: st.id },
    data: { status: 'received', receivedDate: new Date() },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'stock_transfer',
    entityId: st.id,
    action: 'status_change',
    payload: { from: st.status, to: 'received', fromWarehouseId: st.fromWarehouseId, toWarehouseId: st.toWarehouseId },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return { updated, toWarehouseId: st.toWarehouseId };
}

export async function complete(id: string) {
  const st = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!st) throw new NotFoundError('Stock Transfer', id);
  assertTransition(DOC_TYPE, st.status, 'completed');
  const updated = await prisma.stockTransfer.update({ where: { id: st.id }, data: { status: 'completed' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'stock_transfer',
    entityId: st.id,
    action: 'status_change',
    payload: { from: st.status, to: 'completed' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function cancel(id: string) {
  const st = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!st) throw new NotFoundError('Stock Transfer', id);

  const nonCancellable = ['shipped', 'received', 'completed', 'cancelled'];
  if (nonCancellable.includes(st.status)) {
    throw new BusinessRuleError(`Stock Transfer cannot be cancelled from status: ${st.status}`);
  }

  const updated = await prisma.stockTransfer.update({ where: { id: st.id }, data: { status: 'cancelled' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'stock_transfer',
    entityId: st.id,
    action: 'status_change',
    payload: { from: st.status, to: 'cancelled' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}
