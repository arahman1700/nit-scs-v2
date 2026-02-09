import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { createAuditLog } from './audit.service.js';
import { log } from '../config/logger.js';
import { invalidateCachePattern } from '../utils/cache.js';

/** Invalidate dashboard caches that depend on inventory data */
async function invalidateInventoryCache(): Promise<void> {
  await invalidateCachePattern('dashboard:*');
}

// ── Types ───────────────────────────────────────────────────────────────

export interface AddStockParams {
  itemId: string;
  warehouseId: string;
  qty: number;
  unitCost?: number;
  supplierId?: string;
  mrrvLineId?: string;
  expiryDate?: Date;
  performedById?: string;
}

export interface StockLevel {
  onHand: number;
  reserved: number;
  available: number;
}

export interface ConsumptionResult {
  totalCost: number;
}

/** Reference for non-MIRV stock consumption (e.g. stock transfers) */
export interface ConsumptionReference {
  mirvLineId?: string;
  referenceType?: string;
  referenceId?: string;
}

// ── Optimistic Locking Helper ────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Update InventoryLevel with optimistic locking using the `version` field.
 * Retries up to MAX_RETRIES times on version conflict.
 */
async function updateLevelWithVersion(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itemId: string,
  warehouseId: string,
  updateData: Record<string, unknown>,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const level = await tx.inventoryLevel.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (!level) {
      throw new Error(`InventoryLevel not found for item ${itemId}, warehouse ${warehouseId}`);
    }

    const result = await tx.inventoryLevel.updateMany({
      where: {
        itemId,
        warehouseId,
        version: level.version,
      },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
    });

    if (result.count > 0) return; // success

    if (attempt === MAX_RETRIES - 1) {
      throw new Error(
        `Optimistic lock failure after ${MAX_RETRIES} retries for item ${itemId}, warehouse ${warehouseId}`,
      );
    }

    log('warn', `[Inventory] Optimistic lock retry ${attempt + 1} for item ${itemId}`);
  }
}

// ── Low-Stock Alert Check ────────────────────────────────────────────────

/**
 * Check if inventory has dropped below minLevel or reorderPoint.
 * Sets alertSent=true to avoid repeated alerts.
 */
async function checkLowStockAlert(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itemId: string,
  warehouseId: string,
): Promise<void> {
  const level = await tx.inventoryLevel.findUnique({
    where: { itemId_warehouseId: { itemId, warehouseId } },
    include: {
      item: { select: { itemCode: true, itemDescription: true } },
      warehouse: { select: { warehouseCode: true, warehouseName: true } },
    },
  });

  if (!level || level.alertSent) return;

  const available = Number(level.qtyOnHand) - Number(level.qtyReserved);
  const minLevel = level.minLevel ? Number(level.minLevel) : null;
  const reorderPoint = level.reorderPoint ? Number(level.reorderPoint) : null;

  let alertType: 'critical' | 'warning' | null = null;

  if (minLevel !== null && available <= minLevel) {
    alertType = 'critical';
  } else if (reorderPoint !== null && available <= reorderPoint) {
    alertType = 'warning';
  }

  if (alertType) {
    await tx.inventoryLevel.update({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      data: { alertSent: true },
    });

    log(
      alertType === 'critical' ? 'warn' : 'info',
      `[Inventory] Low stock ${alertType}: ${level.item.itemCode} (${level.item.itemDescription}) ` +
        `at ${level.warehouse.warehouseCode} — available: ${available}, ` +
        `${alertType === 'critical' ? `minLevel: ${minLevel}` : `reorderPoint: ${reorderPoint}`}`,
    );
  }
}

// ── Add Stock ───────────────────────────────────────────────────────────

export async function addStock(params: AddStockParams): Promise<void> {
  const { itemId, warehouseId, qty, unitCost, supplierId, mrrvLineId, expiryDate, performedById } = params;

  await prisma.$transaction(async tx => {
    // 1. Upsert InventoryLevel - increment qtyOnHand with version bump
    const existing = await tx.inventoryLevel.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (existing) {
      await updateLevelWithVersion(tx, itemId, warehouseId, {
        qtyOnHand: { increment: qty },
        lastMovementDate: new Date(),
        alertSent: false, // Reset alert on new stock
      });
    } else {
      await tx.inventoryLevel.create({
        data: {
          itemId,
          warehouseId,
          qtyOnHand: qty,
          qtyReserved: 0,
          lastMovementDate: new Date(),
          version: 0,
        },
      });
    }

    // 2. Create InventoryLot
    const lotNumber = await generateDocumentNumber('lot');
    await tx.inventoryLot.create({
      data: {
        lotNumber,
        itemId,
        warehouseId,
        mrrvLineId: mrrvLineId ?? null,
        receiptDate: new Date(),
        expiryDate: expiryDate ?? null,
        initialQty: qty,
        availableQty: qty,
        reservedQty: 0,
        unitCost: unitCost ?? null,
        supplierId: supplierId ?? null,
        status: 'active',
      },
    });

    // 3. Audit log
    if (performedById) {
      await createAuditLog({
        tableName: 'inventory_levels',
        recordId: `${itemId}:${warehouseId}`,
        action: 'update',
        newValues: {
          action: 'add_stock',
          qty,
          unitCost,
          lotNumber,
          mrrvLineId,
        },
        performedById,
      });
    }
  });

  log('info', `[Inventory] Added ${qty} units of item ${itemId} to warehouse ${warehouseId}`);

  // Invalidate cached dashboard data that depends on inventory
  await invalidateInventoryCache();
}

// ── Reserve Stock (FIFO) ────────────────────────────────────────────────

export async function reserveStock(itemId: string, warehouseId: string, qty: number): Promise<boolean> {
  return prisma.$transaction(async tx => {
    // 1. Check availability with optimistic lock read
    const level = await tx.inventoryLevel.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (!level) return false;

    const available = Number(level.qtyOnHand) - Number(level.qtyReserved);
    if (available < qty) return false;

    // 2. Increment qtyReserved with optimistic locking
    await updateLevelWithVersion(tx, itemId, warehouseId, {
      qtyReserved: { increment: qty },
    });

    // 3. Reserve from oldest lots first (FIFO by receiptDate)
    const lots = await tx.inventoryLot.findMany({
      where: {
        itemId,
        warehouseId,
        status: 'active',
        availableQty: { gt: 0 },
      },
      orderBy: { receiptDate: 'asc' },
    });

    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;

      const lotAvailable = Number(lot.availableQty) - Number(lot.reservedQty ?? 0);
      if (lotAvailable <= 0) continue;

      const toReserve = Math.min(remaining, lotAvailable);

      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          reservedQty: { increment: toReserve },
        },
      });

      remaining -= toReserve;
    }

    if (remaining > 0) {
      throw new Error('Insufficient lot availability for reservation');
    }

    return true;
  });
}

// ── Release Reservation ─────────────────────────────────────────────────

export async function releaseReservation(itemId: string, warehouseId: string, qty: number): Promise<void> {
  await prisma.$transaction(async tx => {
    // 1. Decrement qtyReserved with optimistic locking
    await updateLevelWithVersion(tx, itemId, warehouseId, {
      qtyReserved: { decrement: qty },
    });

    // 2. Release from oldest lots first (FIFO)
    const lots = await tx.inventoryLot.findMany({
      where: {
        itemId,
        warehouseId,
        status: 'active',
        reservedQty: { gt: 0 },
      },
      orderBy: { receiptDate: 'asc' },
    });

    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;

      const lotReserved = Number(lot.reservedQty ?? 0);
      if (lotReserved <= 0) continue;

      const toRelease = Math.min(remaining, lotReserved);

      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          reservedQty: { decrement: toRelease },
        },
      });

      remaining -= toRelease;
    }
  });

  log('info', `[Inventory] Released reservation of ${qty} units of item ${itemId} in warehouse ${warehouseId}`);
}

// ── Consume Reservation (FIFO) ─────────────────────────────────────────

export async function consumeReservation(
  itemId: string,
  warehouseId: string,
  qty: number,
  mirvLineId: string,
): Promise<ConsumptionResult> {
  return prisma.$transaction(async tx => {
    // 1. Decrement both qtyOnHand AND qtyReserved with optimistic locking
    await updateLevelWithVersion(tx, itemId, warehouseId, {
      qtyOnHand: { decrement: qty },
      qtyReserved: { decrement: qty },
      lastMovementDate: new Date(),
    });

    // 2. Consume from oldest lots (FIFO)
    const lots = await tx.inventoryLot.findMany({
      where: {
        itemId,
        warehouseId,
        status: 'active',
        availableQty: { gt: 0 },
      },
      orderBy: { receiptDate: 'asc' },
    });

    let remaining = qty;
    let totalCost = 0;

    for (const lot of lots) {
      if (remaining <= 0) break;

      const lotAvailable = Number(lot.availableQty);
      if (lotAvailable <= 0) continue;

      const toConsume = Math.min(remaining, lotAvailable);
      const unitCost = Number(lot.unitCost ?? 0);
      totalCost += toConsume * unitCost;

      const newAvailable = lotAvailable - toConsume;
      const newReserved = Math.max(0, Number(lot.reservedQty ?? 0) - toConsume);

      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          availableQty: newAvailable,
          reservedQty: newReserved,
          status: newAvailable <= 0 ? 'depleted' : 'active',
        },
      });

      // 3. Create LotConsumption record
      await tx.lotConsumption.create({
        data: {
          lotId: lot.id,
          mirvLineId,
          quantity: toConsume,
          unitCost: unitCost > 0 ? unitCost : null,
          consumptionDate: new Date(),
        },
      });

      remaining -= toConsume;
    }

    // 4. Check low-stock alerts
    await checkLowStockAlert(tx, itemId, warehouseId);

    return { totalCost };
  });
}

// ── Deduct Stock (without reservation) ──────────────────────────────────

/**
 * Deduct stock directly (no prior reservation).
 * Supports both MIRV-linked and generic reference consumptions (e.g. stock transfers).
 */
export async function deductStock(
  itemId: string,
  warehouseId: string,
  qty: number,
  ref: ConsumptionReference,
): Promise<ConsumptionResult> {
  return prisma.$transaction(async tx => {
    // 1. Check availability
    const level = await tx.inventoryLevel.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (!level || Number(level.qtyOnHand) < qty) {
      throw new Error(`Insufficient stock for item ${itemId} in warehouse ${warehouseId}`);
    }

    // 2. Decrement qtyOnHand with optimistic locking
    await updateLevelWithVersion(tx, itemId, warehouseId, {
      qtyOnHand: { decrement: qty },
      lastMovementDate: new Date(),
    });

    // 3. Consume from oldest lots (FIFO)
    const lots = await tx.inventoryLot.findMany({
      where: {
        itemId,
        warehouseId,
        status: 'active',
        availableQty: { gt: 0 },
      },
      orderBy: { receiptDate: 'asc' },
    });

    let remaining = qty;
    let totalCost = 0;

    for (const lot of lots) {
      if (remaining <= 0) break;

      const lotAvailable = Number(lot.availableQty);
      if (lotAvailable <= 0) continue;

      const toConsume = Math.min(remaining, lotAvailable);
      const unitCost = Number(lot.unitCost ?? 0);
      totalCost += toConsume * unitCost;

      const newAvailable = lotAvailable - toConsume;

      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          availableQty: newAvailable,
          status: newAvailable <= 0 ? 'depleted' : 'active',
        },
      });

      // Create LotConsumption record with proper reference
      await tx.lotConsumption.create({
        data: {
          lotId: lot.id,
          mirvLineId: ref.mirvLineId ?? null,
          referenceType: ref.referenceType ?? null,
          referenceId: ref.referenceId ?? null,
          quantity: toConsume,
          unitCost: unitCost > 0 ? unitCost : null,
          consumptionDate: new Date(),
        },
      });

      remaining -= toConsume;
    }

    // 4. Check low-stock alerts
    await checkLowStockAlert(tx, itemId, warehouseId);

    // 5. Invalidate cached dashboard data
    // Note: done inside tx callback but invalidation is best-effort
    await invalidateInventoryCache();

    return { totalCost };
  });
}

// ############################################################################
// BATCH OPERATIONS — single transaction for multiple items
// ############################################################################

/**
 * Add stock for multiple items in a single transaction.
 * Used by MRRV (stored) and MRV (completed) to process all lines at once.
 */
export async function addStockBatch(items: AddStockParams[]): Promise<void> {
  if (items.length === 0) return;

  await prisma.$transaction(async tx => {
    for (const params of items) {
      const { itemId, warehouseId, qty, unitCost, supplierId, mrrvLineId, expiryDate, performedById } = params;

      // Upsert InventoryLevel
      const existing = await tx.inventoryLevel.findUnique({
        where: { itemId_warehouseId: { itemId, warehouseId } },
      });

      if (existing) {
        await updateLevelWithVersion(tx, itemId, warehouseId, {
          qtyOnHand: { increment: qty },
          lastMovementDate: new Date(),
          alertSent: false,
        });
      } else {
        await tx.inventoryLevel.create({
          data: { itemId, warehouseId, qtyOnHand: qty, qtyReserved: 0, lastMovementDate: new Date(), version: 0 },
        });
      }

      // Create InventoryLot
      const lotNumber = await generateDocumentNumber('lot');
      await tx.inventoryLot.create({
        data: {
          lotNumber,
          itemId,
          warehouseId,
          mrrvLineId: mrrvLineId ?? null,
          receiptDate: new Date(),
          expiryDate: expiryDate ?? null,
          initialQty: qty,
          availableQty: qty,
          reservedQty: 0,
          unitCost: unitCost ?? null,
          supplierId: supplierId ?? null,
          status: 'active',
        },
      });

      // Audit log
      if (performedById) {
        await createAuditLog({
          tableName: 'inventory_levels',
          recordId: `${itemId}:${warehouseId}`,
          action: 'update',
          newValues: { action: 'add_stock_batch', qty, unitCost, lotNumber, mrrvLineId },
          performedById,
        });
      }
    }

    // Single low-stock check pass for all affected items
    const uniquePairs = [...new Set(items.map(i => `${i.itemId}:${i.warehouseId}`))];
    for (const pair of uniquePairs) {
      const [itemId, warehouseId] = pair.split(':');
      await checkLowStockAlert(tx, itemId, warehouseId);
    }
  });

  log('info', `[Inventory] Batch added stock for ${items.length} items`);
  await invalidateInventoryCache();
}

/**
 * Reserve stock for multiple items in a single transaction.
 * Used by MIRV approval to reserve all requested items at once.
 */
export async function reserveStockBatch(
  items: { itemId: string; warehouseId: string; qty: number }[],
): Promise<{ success: boolean; failedItems: string[] }> {
  if (items.length === 0) return { success: true, failedItems: [] };

  return prisma.$transaction(async tx => {
    const failedItems: string[] = [];

    for (const { itemId, warehouseId, qty } of items) {
      const level = await tx.inventoryLevel.findUnique({
        where: { itemId_warehouseId: { itemId, warehouseId } },
      });

      if (!level) {
        failedItems.push(itemId);
        continue;
      }

      const available = Number(level.qtyOnHand) - Number(level.qtyReserved);
      if (available < qty) {
        failedItems.push(itemId);
        continue;
      }

      // Reserve at the level
      await updateLevelWithVersion(tx, itemId, warehouseId, {
        qtyReserved: { increment: qty },
      });

      // Reserve from oldest lots (FIFO)
      const lots = await tx.inventoryLot.findMany({
        where: { itemId, warehouseId, status: 'active', availableQty: { gt: 0 } },
        orderBy: { receiptDate: 'asc' },
      });

      let remaining = qty;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const lotAvailable = Number(lot.availableQty) - Number(lot.reservedQty ?? 0);
        if (lotAvailable <= 0) continue;
        const toReserve = Math.min(remaining, lotAvailable);
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: { reservedQty: { increment: toReserve } },
        });
        remaining -= toReserve;
      }

      if (remaining > 0) {
        failedItems.push(itemId);
      }
    }

    return { success: failedItems.length === 0, failedItems };
  });
}

/**
 * Consume reservations for multiple items in a single transaction.
 * Used by MIRV issuance to consume all reserved items at once.
 * Returns per-item costs for line-level cost recording.
 */
export async function consumeReservationBatch(
  items: { itemId: string; warehouseId: string; qty: number; mirvLineId: string }[],
): Promise<{ totalCost: number; lineCosts: Map<string, number> }> {
  if (items.length === 0) return { totalCost: 0, lineCosts: new Map() };

  return prisma.$transaction(async tx => {
    let totalCost = 0;
    const lineCosts = new Map<string, number>();

    for (const { itemId, warehouseId, qty, mirvLineId } of items) {
      // Decrement both qtyOnHand AND qtyReserved
      await updateLevelWithVersion(tx, itemId, warehouseId, {
        qtyOnHand: { decrement: qty },
        qtyReserved: { decrement: qty },
        lastMovementDate: new Date(),
      });

      // Consume from oldest lots (FIFO)
      const lots = await tx.inventoryLot.findMany({
        where: { itemId, warehouseId, status: 'active', availableQty: { gt: 0 } },
        orderBy: { receiptDate: 'asc' },
      });

      let remaining = qty;
      let lineCost = 0;

      for (const lot of lots) {
        if (remaining <= 0) break;
        const lotAvailable = Number(lot.availableQty);
        if (lotAvailable <= 0) continue;

        const toConsume = Math.min(remaining, lotAvailable);
        const unitCost = Number(lot.unitCost ?? 0);
        lineCost += toConsume * unitCost;

        const newAvailable = lotAvailable - toConsume;
        const newReserved = Math.max(0, Number(lot.reservedQty ?? 0) - toConsume);

        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: {
            availableQty: newAvailable,
            reservedQty: newReserved,
            status: newAvailable <= 0 ? 'depleted' : 'active',
          },
        });

        await tx.lotConsumption.create({
          data: {
            lotId: lot.id,
            mirvLineId,
            quantity: toConsume,
            unitCost: unitCost > 0 ? unitCost : null,
            consumptionDate: new Date(),
          },
        });

        remaining -= toConsume;
      }

      totalCost += lineCost;
      lineCosts.set(mirvLineId, lineCost);

      await checkLowStockAlert(tx, itemId, warehouseId);
    }

    return { totalCost, lineCosts };
  });
}

/**
 * Deduct stock for multiple items without prior reservation.
 * Used by stock transfer (ship) to deduct from source warehouse.
 */
export async function deductStockBatch(
  items: { itemId: string; warehouseId: string; qty: number; ref: ConsumptionReference }[],
): Promise<{ totalCost: number }> {
  if (items.length === 0) return { totalCost: 0 };

  return prisma.$transaction(async tx => {
    let totalCost = 0;

    for (const { itemId, warehouseId, qty, ref } of items) {
      const level = await tx.inventoryLevel.findUnique({
        where: { itemId_warehouseId: { itemId, warehouseId } },
      });

      if (!level || Number(level.qtyOnHand) < qty) {
        throw new Error(`Insufficient stock for item ${itemId} in warehouse ${warehouseId}`);
      }

      await updateLevelWithVersion(tx, itemId, warehouseId, {
        qtyOnHand: { decrement: qty },
        lastMovementDate: new Date(),
      });

      const lots = await tx.inventoryLot.findMany({
        where: { itemId, warehouseId, status: 'active', availableQty: { gt: 0 } },
        orderBy: { receiptDate: 'asc' },
      });

      let remaining = qty;

      for (const lot of lots) {
        if (remaining <= 0) break;
        const lotAvailable = Number(lot.availableQty);
        if (lotAvailable <= 0) continue;

        const toConsume = Math.min(remaining, lotAvailable);
        const unitCost = Number(lot.unitCost ?? 0);
        totalCost += toConsume * unitCost;

        const newAvailable = lotAvailable - toConsume;
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: {
            availableQty: newAvailable,
            status: newAvailable <= 0 ? 'depleted' : 'active',
          },
        });

        await tx.lotConsumption.create({
          data: {
            lotId: lot.id,
            mirvLineId: ref.mirvLineId ?? null,
            referenceType: ref.referenceType ?? null,
            referenceId: ref.referenceId ?? null,
            quantity: toConsume,
            unitCost: unitCost > 0 ? unitCost : null,
            consumptionDate: new Date(),
          },
        });

        remaining -= toConsume;
      }

      await checkLowStockAlert(tx, itemId, warehouseId);
    }

    await invalidateInventoryCache();
    return { totalCost };
  });
}

// ── Get Stock Level ─────────────────────────────────────────────────────

export async function getStockLevel(itemId: string, warehouseId: string): Promise<StockLevel> {
  const level = await prisma.inventoryLevel.findUnique({
    where: { itemId_warehouseId: { itemId, warehouseId } },
  });

  if (!level) {
    return { onHand: 0, reserved: 0, available: 0 };
  }

  const onHand = Number(level.qtyOnHand);
  const reserved = Number(level.qtyReserved);

  return {
    onHand,
    reserved,
    available: onHand - reserved,
  };
}
