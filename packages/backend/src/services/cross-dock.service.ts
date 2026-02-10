/**
 * Cross-Docking Service — V2
 *
 * Identifies opportunities to bypass put-away by routing inbound GRN items
 * directly to outbound MI/WT destinations. Manages the full lifecycle:
 * identify -> approve -> execute -> complete (or cancel).
 */
import type { Prisma, CrossDock } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossDockOpportunity {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  sourceGrnId: string;
  sourceGrnNumber: string;
  grnQuantity: number;
  targets: Array<{
    type: 'mi' | 'wt';
    id: string;
    documentNumber: string;
    quantityNeeded: number;
  }>;
  suggestedQuantity: number;
}

export interface CrossDockFilters {
  warehouseId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CrossDockStats {
  totalIdentified: number;
  totalActive: number;
  totalCompleted: number;
  totalCancelled: number;
  totalItemsBypassed: number;
  avgCompletionHours: number;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const DETAIL_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  item: { select: { id: true, itemCode: true, itemDescription: true, category: true } },
} satisfies Prisma.CrossDockInclude;

// ---------------------------------------------------------------------------
// Identify Opportunities
// ---------------------------------------------------------------------------

export async function identifyOpportunities(warehouseId: string): Promise<CrossDockOpportunity[]> {
  // 1. Find approved GRNs (Mrrv) with pending items at this warehouse
  const grns = await prisma.mrrv.findMany({
    where: {
      warehouseId,
      status: 'approved',
    },
    select: {
      id: true,
      mrrvNumber: true,
      lines: {
        select: {
          itemId: true,
          qtyReceived: true,
          item: { select: { id: true, itemCode: true, itemDescription: true } },
        },
      },
    },
  });

  // 2. Find pending MIs (Mirv) at this warehouse
  const mis = await prisma.mirv.findMany({
    where: {
      warehouseId,
      status: { in: ['approved', 'partially_issued'] },
    },
    select: {
      id: true,
      mirvNumber: true,
      lines: {
        select: {
          itemId: true,
          qtyRequested: true,
          qtyIssued: true,
        },
      },
    },
  });

  // 3. Find pending WTs (StockTransfer) from this warehouse
  const wts = await prisma.stockTransfer.findMany({
    where: {
      fromWarehouseId: warehouseId,
      status: { in: ['approved', 'in_transit'] },
    },
    select: {
      id: true,
      transferNumber: true,
      lines: {
        select: {
          itemId: true,
          quantity: true,
        },
      },
    },
  });

  // 4. Build demand map: itemId -> list of targets needing that item
  const demandMap = new Map<
    string,
    Array<{ type: 'mi' | 'wt'; id: string; documentNumber: string; quantityNeeded: number }>
  >();

  for (const mi of mis) {
    for (const line of mi.lines) {
      const remaining = Number(line.qtyRequested) - Number(line.qtyIssued ?? 0);
      if (remaining <= 0) continue;

      if (!demandMap.has(line.itemId)) demandMap.set(line.itemId, []);
      demandMap.get(line.itemId)!.push({
        type: 'mi',
        id: mi.id,
        documentNumber: mi.mirvNumber,
        quantityNeeded: remaining,
      });
    }
  }

  for (const wt of wts) {
    for (const line of wt.lines) {
      const qty = Number(line.quantity);
      if (qty <= 0) continue;

      if (!demandMap.has(line.itemId)) demandMap.set(line.itemId, []);
      demandMap.get(line.itemId)!.push({
        type: 'wt',
        id: wt.id,
        documentNumber: wt.transferNumber,
        quantityNeeded: qty,
      });
    }
  }

  // 5. Match GRN supply to demand
  const opportunities: CrossDockOpportunity[] = [];

  for (const grn of grns) {
    for (const line of grn.lines) {
      const targets = demandMap.get(line.itemId);
      if (!targets || targets.length === 0) continue;

      const grnQty = Number(line.qtyReceived ?? 0);
      if (grnQty <= 0) continue;

      const totalDemand = targets.reduce((sum, t) => sum + t.quantityNeeded, 0);
      const suggestedQuantity = Math.min(grnQty, totalDemand);

      opportunities.push({
        itemId: line.itemId,
        itemCode: line.item.itemCode,
        itemDescription: line.item.itemDescription,
        warehouseId,
        sourceGrnId: grn.id,
        sourceGrnNumber: grn.mrrvNumber,
        grnQuantity: grnQty,
        targets,
        suggestedQuantity,
      });
    }
  }

  return opportunities;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createCrossDock(data: Prisma.CrossDockUncheckedCreateInput): Promise<CrossDock> {
  return prisma.crossDock.create({
    data,
    include: DETAIL_INCLUDE,
  }) as unknown as CrossDock;
}

export async function getCrossDockById(id: string) {
  const record = await prisma.crossDock.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('CrossDock', id);
  return record;
}

export async function getCrossDocks(filters: CrossDockFilters) {
  const where: Prisma.CrossDockWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.status) where.status = filters.status;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.crossDock.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.crossDock.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export async function approveCrossDock(id: string): Promise<CrossDock> {
  const record = await prisma.crossDock.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('CrossDock', id);
  if (record.status !== 'identified') {
    throw new Error(`Cannot approve cross-dock in status '${record.status}'. Must be 'identified'.`);
  }

  return prisma.crossDock.update({
    where: { id },
    data: { status: 'approved' },
    include: DETAIL_INCLUDE,
  }) as unknown as CrossDock;
}

export async function executeCrossDock(id: string): Promise<CrossDock> {
  const record = await prisma.crossDock.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('CrossDock', id);
  if (record.status !== 'approved') {
    throw new Error(`Cannot execute cross-dock in status '${record.status}'. Must be 'approved'.`);
  }

  return prisma.crossDock.update({
    where: { id },
    data: { status: 'in_progress' },
    include: DETAIL_INCLUDE,
  }) as unknown as CrossDock;
}

export async function completeCrossDock(id: string): Promise<CrossDock> {
  const record = await prisma.crossDock.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('CrossDock', id);
  if (record.status !== 'in_progress') {
    throw new Error(`Cannot complete cross-dock in status '${record.status}'. Must be 'in_progress'.`);
  }

  return prisma.crossDock.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date() },
    include: DETAIL_INCLUDE,
  }) as unknown as CrossDock;
}

export async function cancelCrossDock(id: string): Promise<CrossDock> {
  const record = await prisma.crossDock.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('CrossDock', id);
  if (record.status === 'completed' || record.status === 'cancelled') {
    throw new Error(`Cannot cancel cross-dock in status '${record.status}'.`);
  }

  return prisma.crossDock.update({
    where: { id },
    data: { status: 'cancelled' },
    include: DETAIL_INCLUDE,
  }) as unknown as CrossDock;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export async function getStats(warehouseId?: string): Promise<CrossDockStats> {
  const where: Prisma.CrossDockWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const [identified, active, completed, cancelled, completedRecords] = await Promise.all([
    prisma.crossDock.count({ where: { ...where, status: 'identified' } }),
    prisma.crossDock.count({ where: { ...where, status: { in: ['approved', 'in_progress'] } } }),
    prisma.crossDock.count({ where: { ...where, status: 'completed' } }),
    prisma.crossDock.count({ where: { ...where, status: 'cancelled' } }),
    prisma.crossDock.findMany({
      where: { ...where, status: 'completed', completedAt: { not: null } },
      select: { createdAt: true, completedAt: true, quantity: true },
    }),
  ]);

  // Calculate average completion time in hours
  let avgCompletionHours = 0;
  let totalItemsBypassed = 0;

  if (completedRecords.length > 0) {
    let totalHours = 0;
    for (const rec of completedRecords) {
      if (rec.completedAt) {
        const diffMs = rec.completedAt.getTime() - rec.createdAt.getTime();
        totalHours += diffMs / (1000 * 60 * 60);
      }
      totalItemsBypassed += Number(rec.quantity);
    }
    avgCompletionHours = Math.round((totalHours / completedRecords.length) * 10) / 10;
  }

  return {
    totalIdentified: identified,
    totalActive: active,
    totalCompleted: completed,
    totalCancelled: cancelled,
    totalItemsBypassed,
    avgCompletionHours,
  };
}
