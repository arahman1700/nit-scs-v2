/**
 * Stock Allocation Service — V2
 *
 * Real-time reservation engine: manages hard/soft reservations of specific
 * lots/bins against demand documents (MI, WT, MR). Supports FIFO bulk
 * allocation and available-to-allocate queries.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllocateInput {
  warehouseId: string;
  itemId: string;
  lotId?: string;
  binId?: string;
  lpnId?: string;
  qtyAllocated: number;
  allocType: string;
  demandDocType: string;
  demandDocId: string;
  allocatedById?: string;
}

export interface BulkAllocateLine {
  itemId: string;
  qty: number;
}

export interface AllocationFilters {
  warehouseId?: string;
  status?: string;
  demandDocType?: string;
  demandDocId?: string;
  page?: number;
  pageSize?: number;
}

export interface AllocationStats {
  totalAllocatedQty: number;
  activeCount: number;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const DETAIL_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  item: { select: { id: true, itemCode: true, itemDescription: true } },
  lot: { select: { id: true, lotNumber: true } },
  bin: { select: { id: true, locationCode: true } },
  allocatedBy: { select: { id: true, employeeIdNumber: true, fullName: true } },
} satisfies Prisma.StockAllocationInclude;

// ---------------------------------------------------------------------------
// Allocate
// ---------------------------------------------------------------------------

/** Creates a new stock allocation (hard or soft reservation) against a demand document. */
export async function allocate(input: AllocateInput) {
  if (input.qtyAllocated <= 0) {
    throw new Error('Allocated quantity must be greater than zero.');
  }

  return prisma.stockAllocation.create({
    data: {
      warehouseId: input.warehouseId,
      itemId: input.itemId,
      lotId: input.lotId,
      binId: input.binId,
      lpnId: input.lpnId,
      qtyAllocated: input.qtyAllocated,
      allocType: input.allocType,
      demandDocType: input.demandDocType,
      demandDocId: input.demandDocId,
      allocatedById: input.allocatedById,
    },
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/** Releases an active allocation, freeing reserved stock. */
export async function release(allocationId: string) {
  const record = await prisma.stockAllocation.findUnique({ where: { id: allocationId } });
  if (!record) throw new NotFoundError('StockAllocation', allocationId);
  if (record.status !== 'active') {
    throw new Error(`Cannot release allocation in status '${record.status}'. Must be 'active'.`);
  }

  return prisma.stockAllocation.update({
    where: { id: allocationId },
    data: { status: 'released', releasedAt: new Date() },
    include: DETAIL_INCLUDE,
  });
}

/** Confirms pick fulfillment for an active allocation. */
export async function confirmPick(allocationId: string) {
  const record = await prisma.stockAllocation.findUnique({ where: { id: allocationId } });
  if (!record) throw new NotFoundError('StockAllocation', allocationId);
  if (record.status !== 'active') {
    throw new Error(`Cannot confirm pick for allocation in status '${record.status}'. Must be 'active'.`);
  }

  return prisma.stockAllocation.update({
    where: { id: allocationId },
    data: { status: 'picked' },
    include: DETAIL_INCLUDE,
  });
}

/** Cancels an active allocation and records the release timestamp. */
export async function cancel(allocationId: string) {
  const record = await prisma.stockAllocation.findUnique({ where: { id: allocationId } });
  if (!record) throw new NotFoundError('StockAllocation', allocationId);
  if (record.status !== 'active') {
    throw new Error(`Cannot cancel allocation in status '${record.status}'. Must be 'active'.`);
  }

  return prisma.stockAllocation.update({
    where: { id: allocationId },
    data: { status: 'cancelled', releasedAt: new Date() },
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Retrieves all allocations for a specific demand document (MI, WT, MR). */
export async function getByDemand(demandDocType: string, demandDocId: string) {
  return prisma.stockAllocation.findMany({
    where: { demandDocType, demandDocId },
    include: DETAIL_INCLUDE,
    orderBy: { allocatedAt: 'desc' },
  });
}

/** Returns the total actively allocated quantity for an item in a warehouse. */
export async function getAvailable(warehouseId: string, itemId: string) {
  const result = await prisma.stockAllocation.aggregate({
    where: { warehouseId, itemId, status: 'active' },
    _sum: { qtyAllocated: true },
  });

  return {
    warehouseId,
    itemId,
    totalAllocated: Number(result._sum.qtyAllocated ?? 0),
  };
}

/** Lists allocations with optional warehouse/status/demand filters and pagination. */
export async function getAllocations(filters: AllocationFilters) {
  const where: Prisma.StockAllocationWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.status) where.status = filters.status;
  if (filters.demandDocType) where.demandDocType = filters.demandDocType;
  if (filters.demandDocId) where.demandDocId = filters.demandDocId;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.stockAllocation.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { allocatedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.stockAllocation.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Bulk FIFO allocation
// ---------------------------------------------------------------------------

/** FIFO bulk allocation: reserves inventory lots in creation-date order for multiple demand lines. */
export async function bulkAllocate(
  demandDocType: string,
  demandDocId: string,
  lines: BulkAllocateLine[],
  warehouseId?: string,
) {
  const allocations = [];

  for (const line of lines) {
    // Find available lots ordered by creation date (FIFO)
    const lotsWhere: Prisma.InventoryLotWhereInput = {
      itemId: line.itemId,
      availableQty: { gt: 0 },
    };
    if (warehouseId) lotsWhere.warehouseId = warehouseId;

    const lots = await prisma.inventoryLot.findMany({
      where: lotsWhere,
      orderBy: { createdAt: 'asc' },
    });

    let remaining = line.qty;

    for (const lot of lots) {
      if (remaining <= 0) break;

      const available = Number(lot.availableQty);
      const allocQty = Math.min(remaining, available);

      const allocation = await prisma.stockAllocation.create({
        data: {
          warehouseId: lot.warehouseId,
          itemId: line.itemId,
          lotId: lot.id,
          qtyAllocated: allocQty,
          allocType: 'hard',
          demandDocType,
          demandDocId,
        },
        include: DETAIL_INCLUDE,
      });

      allocations.push(allocation);
      remaining -= allocQty;
    }
  }

  return allocations;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Returns active allocation count and total allocated quantity, optionally filtered by warehouse. */
export async function getStats(warehouseId?: string): Promise<AllocationStats> {
  const where: Prisma.StockAllocationWhereInput = { status: 'active' };
  if (warehouseId) where.warehouseId = warehouseId;

  const [activeCount, aggregate] = await Promise.all([
    prisma.stockAllocation.count({ where }),
    prisma.stockAllocation.aggregate({
      where,
      _sum: { qtyAllocated: true },
    }),
  ]);

  return {
    totalAllocatedQty: Number(aggregate._sum.qtyAllocated ?? 0),
    activeCount,
  };
}
