/**
 * Asset Register Service — M10
 * Prisma model: Asset (table: assets)
 * Lifecycle: active → maintenance → retired/disposed/lost
 *
 * Provides CRUD, transfer, retire, dispose, depreciation calculation,
 * and summary dashboard stats.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';
import type { ListParams } from '../../../types/dto.js';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const LIST_INCLUDE = {
  locationWarehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  assignedTo: { select: { id: true, fullName: true } },
} satisfies Prisma.AssetInclude;

const DETAIL_INCLUDE = {
  locationWarehouse: true,
  assignedTo: { select: { id: true, fullName: true, email: true, department: true } },
  transfers: {
    orderBy: { transferDate: 'desc' as const },
    take: 20,
    include: {
      fromWarehouse: { select: { id: true, warehouseName: true } },
      toWarehouse: { select: { id: true, warehouseName: true } },
      fromEmployee: { select: { id: true, fullName: true } },
      toEmployee: { select: { id: true, fullName: true } },
      transferredBy: { select: { id: true, fullName: true } },
    },
  },
  depreciationRecords: {
    orderBy: { calculatedAt: 'desc' as const },
    take: 12,
  },
} satisfies Prisma.AssetInclude;

// ── List ────────────────────────────────────────────────────────────────────

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { assetCode: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { serialNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.category) where.category = params.category;
  if (params.locationWarehouseId) where.locationWarehouseId = params.locationWarehouseId;
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  if (params.condition) where.condition = params.condition;

  const [data, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.asset.count({ where }),
  ]);
  return { data, total };
}

// ── Get by ID ───────────────────────────────────────────────────────────────

export async function getById(id: string) {
  const asset = await prisma.asset.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!asset) throw new NotFoundError('Asset', id);
  return asset;
}

// ── Create ──────────────────────────────────────────────────────────────────

export interface AssetCreateDto {
  description: string;
  category: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currentValue?: number;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  salvageValue?: number;
  status?: string;
  locationWarehouseId?: string;
  assignedToId?: string;
  condition?: string;
  notes?: string;
}

export async function create(data: AssetCreateDto, _userId: string) {
  const assetCode = await generateDocumentNumber('asset');

  return prisma.asset.create({
    data: {
      assetCode,
      description: data.description,
      category: data.category,
      serialNumber: data.serialNumber ?? null,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchaseCost: data.purchaseCost ?? null,
      currentValue: data.currentValue ?? data.purchaseCost ?? null,
      depreciationMethod: data.depreciationMethod ?? null,
      usefulLifeYears: data.usefulLifeYears ?? null,
      salvageValue: data.salvageValue ?? null,
      status: data.status ?? 'active',
      locationWarehouseId: data.locationWarehouseId ?? null,
      assignedToId: data.assignedToId ?? null,
      condition: data.condition ?? null,
      notes: data.notes ?? null,
    },
    include: LIST_INCLUDE,
  });
}

// ── Update ──────────────────────────────────────────────────────────────────

export interface AssetUpdateDto {
  description?: string;
  category?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currentValue?: number;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  salvageValue?: number;
  locationWarehouseId?: string;
  assignedToId?: string;
  condition?: string;
  lastAuditDate?: string;
  notes?: string;
}

export async function update(id: string, data: AssetUpdateDto) {
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Asset', id);

  if (['retired', 'disposed'].includes(existing.status)) {
    throw new BusinessRuleError('Cannot update an asset that is retired or disposed');
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.purchaseDate) updateData.purchaseDate = new Date(data.purchaseDate);
  if (data.lastAuditDate) updateData.lastAuditDate = new Date(data.lastAuditDate);

  const updated = await prisma.asset.update({ where: { id }, data: updateData, include: LIST_INCLUDE });
  return { existing, updated };
}

// ── Transfer ────────────────────────────────────────────────────────────────

export async function transfer(
  id: string,
  toWarehouseId: string | undefined,
  toEmployeeId: string | undefined,
  reason: string | undefined,
  userId: string,
) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError('Asset', id);

  if (['retired', 'disposed', 'lost'].includes(asset.status)) {
    throw new BusinessRuleError(`Cannot transfer an asset with status "${asset.status}"`);
  }

  if (!toWarehouseId && !toEmployeeId) {
    throw new BusinessRuleError('Transfer requires either a destination warehouse or an assignee');
  }

  const result = await prisma.$transaction(async (tx: TransactionClient) => {
    // Create transfer record
    await tx.assetTransfer.create({
      data: {
        assetId: id,
        fromWarehouseId: asset.locationWarehouseId,
        toWarehouseId: toWarehouseId ?? null,
        fromEmployeeId: asset.assignedToId,
        toEmployeeId: toEmployeeId ?? null,
        transferDate: new Date(),
        reason: reason ?? null,
        transferredById: userId,
      },
    });

    // Update asset location and/or assignee
    const assetUpdate: Record<string, unknown> = {};
    if (toWarehouseId) assetUpdate.locationWarehouseId = toWarehouseId;
    if (toEmployeeId) assetUpdate.assignedToId = toEmployeeId;

    return tx.asset.update({
      where: { id },
      data: assetUpdate,
      include: DETAIL_INCLUDE,
    });
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'asset',
    entityId: id,
    action: 'update',
    payload: {
      action: 'transfer',
      fromWarehouseId: asset.locationWarehouseId,
      toWarehouseId,
      fromEmployeeId: asset.assignedToId,
      toEmployeeId,
    },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return result;
}

// ── Retire ──────────────────────────────────────────────────────────────────

export async function retire(id: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError('Asset', id);

  if (asset.status === 'retired') {
    throw new BusinessRuleError('Asset is already retired');
  }
  if (asset.status === 'disposed') {
    throw new BusinessRuleError('Cannot retire an asset that has been disposed');
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: { status: 'retired' },
    include: LIST_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'asset',
    entityId: id,
    action: 'status_change',
    payload: { from: asset.status, to: 'retired' },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Dispose ─────────────────────────────────────────────────────────────────

export async function dispose(id: string, userId: string, disposalValue?: number) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError('Asset', id);

  if (asset.status === 'disposed') {
    throw new BusinessRuleError('Asset is already disposed');
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: {
      status: 'disposed',
      currentValue: disposalValue ?? 0,
    },
    include: LIST_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'asset',
    entityId: id,
    action: 'status_change',
    payload: { from: asset.status, to: 'disposed', disposalValue },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Calculate Depreciation ──────────────────────────────────────────────────

/**
 * Calculate quarterly depreciation for all active assets with depreciationMethod != 'none'.
 * Skips if already calculated for the current quarter.
 */
export async function calculateDepreciation(): Promise<void> {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const period = `${now.getFullYear()}-Q${quarter}`;

  // Get all active assets that need depreciation
  const assets = await prisma.asset.findMany({
    where: {
      status: 'active',
      depreciationMethod: { notIn: ['none'], not: null },
      purchaseCost: { not: null },
      usefulLifeYears: { not: null, gt: 0 },
    },
  });

  for (const asset of assets) {
    // Skip if already calculated for this period
    const existing = await prisma.assetDepreciation.findUnique({
      where: { assetId_period: { assetId: asset.id, period } },
    });
    if (existing) continue;

    const purchaseCost = Number(asset.purchaseCost);
    const salvageValue = Number(asset.salvageValue ?? 0);
    const usefulLifeYears = asset.usefulLifeYears!;
    const currentValue = Number(asset.currentValue ?? purchaseCost);

    if (currentValue <= salvageValue) continue; // Fully depreciated

    let depreciationAmount: number;

    if (asset.depreciationMethod === 'straight_line') {
      // Annual depreciation / 4 quarters
      const annualDepreciation = (purchaseCost - salvageValue) / usefulLifeYears;
      depreciationAmount = annualDepreciation / 4;
    } else if (asset.depreciationMethod === 'declining_balance') {
      // Double-declining balance rate per quarter
      const annualRate = 2 / usefulLifeYears;
      depreciationAmount = (currentValue * annualRate) / 4;
    } else {
      continue; // Unknown method, skip
    }

    // Ensure we don't depreciate below salvage value
    const maxDepreciation = currentValue - salvageValue;
    depreciationAmount = Math.min(depreciationAmount, maxDepreciation);
    depreciationAmount = Math.max(depreciationAmount, 0);

    const closingValue = currentValue - depreciationAmount;

    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.assetDepreciation.create({
        data: {
          assetId: asset.id,
          period,
          openingValue: currentValue,
          depreciationAmount,
          closingValue,
        },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: { currentValue: closingValue },
      });
    });
  }
}

// ── Asset Summary ───────────────────────────────────────────────────────────

export async function getAssetSummary() {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const period = `${now.getFullYear()}-Q${quarter}`;

  const [totalCount, byCategory, byStatus, totalValueResult, depreciationThisPeriod] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
    prisma.asset.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.asset.aggregate({
      _sum: { currentValue: true },
      where: { status: { in: ['active', 'maintenance'] } },
    }),
    prisma.assetDepreciation.aggregate({
      _sum: { depreciationAmount: true },
      where: { period },
    }),
  ]);

  return {
    totalCount,
    byCategory: byCategory.map(r => ({ category: r.category, count: r._count.id })),
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count.id })),
    totalValue: totalValueResult._sum.currentValue ?? 0,
    depreciationThisPeriod: depreciationThisPeriod._sum.depreciationAmount ?? 0,
    currentPeriod: period,
  };
}
