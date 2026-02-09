/**
 * WT Service — V2 rename of Stock Transfer
 * Prisma model: stockTransfer (unchanged)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch, deductStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type {
  StockTransferCreateDto as WtCreateDto,
  StockTransferUpdateDto as WtUpdateDto,
  StockTransferLineDto as WtLineDto,
  ListParams,
} from '../types/dto.js';

const DOC_TYPE = 'wt';

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
  const wt = await prisma.stockTransfer.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!wt) throw new NotFoundError('WT', id);
  return wt;
}

export async function create(headerData: Omit<WtCreateDto, 'lines'>, lines: WtLineDto[], userId: string) {
  return prisma.$transaction(async tx => {
    const transferNumber = await generateDocumentNumber('stock_transfer');
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

export async function update(id: string, data: WtUpdateDto) {
  const existing = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('WT', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft WTs can be updated');

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
  const wt = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!wt) throw new NotFoundError('WT', id);
  assertTransition(DOC_TYPE, wt.status, 'pending');
  return prisma.stockTransfer.update({ where: { id: wt.id }, data: { status: 'pending' } });
}

export async function approve(id: string) {
  const wt = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!wt) throw new NotFoundError('WT', id);
  assertTransition(DOC_TYPE, wt.status, 'approved');
  return prisma.stockTransfer.update({ where: { id: wt.id }, data: { status: 'approved' } });
}

export async function ship(id: string) {
  const wt = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { stockTransferLines: true },
  });
  if (!wt) throw new NotFoundError('WT', id);
  assertTransition(DOC_TYPE, wt.status, 'shipped');

  const deductItems = wt.stockTransferLines.map(line => ({
    itemId: line.itemId,
    warehouseId: wt.fromWarehouseId,
    qty: Number(line.quantity),
    ref: { referenceType: 'stock_transfer_line', referenceId: line.id },
  }));
  await deductStockBatch(deductItems);

  const updated = await prisma.stockTransfer.update({
    where: { id: wt.id },
    data: { status: 'shipped', shippedDate: new Date() },
  });

  return { updated, fromWarehouseId: wt.fromWarehouseId };
}

export async function receive(id: string, userId: string) {
  const wt = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { stockTransferLines: true },
  });
  if (!wt) throw new NotFoundError('WT', id);
  assertTransition(DOC_TYPE, wt.status, 'received');

  const stockItems = wt.stockTransferLines.map(line => ({
    itemId: line.itemId,
    warehouseId: wt.toWarehouseId,
    qty: Number(line.quantity),
    performedById: userId,
  }));
  await addStockBatch(stockItems);

  const updated = await prisma.stockTransfer.update({
    where: { id: wt.id },
    data: { status: 'received', receivedDate: new Date() },
  });

  return { updated, toWarehouseId: wt.toWarehouseId };
}

export async function complete(id: string) {
  const wt = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!wt) throw new NotFoundError('WT', id);
  assertTransition(DOC_TYPE, wt.status, 'completed');
  return prisma.stockTransfer.update({ where: { id: wt.id }, data: { status: 'completed' } });
}

export async function cancel(id: string) {
  const wt = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!wt) throw new NotFoundError('WT', id);

  const nonCancellable = ['shipped', 'received', 'completed', 'cancelled'];
  if (nonCancellable.includes(wt.status)) {
    throw new BusinessRuleError(`WT cannot be cancelled from status: ${wt.status}`);
  }

  return prisma.stockTransfer.update({ where: { id: wt.id }, data: { status: 'cancelled' } });
}
