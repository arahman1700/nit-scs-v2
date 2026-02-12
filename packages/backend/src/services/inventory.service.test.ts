import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./audit.service.js', () => ({ createAuditLog: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../utils/cache.js', () => ({ invalidateCachePattern: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { generateDocumentNumber } from './document-number.service.js';
import { createAuditLog } from './audit.service.js';
import {
  addStock,
  reserveStock,
  releaseReservation,
  consumeReservation,
  deductStock,
  getStockLevel,
} from './inventory.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAuditLog = createAuditLog as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeLevelRow(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 100,
    qtyReserved: 0,
    version: 1,
    minLevel: null,
    reorderPoint: null,
    alertSent: false,
    lastMovementDate: new Date(),
    ...overrides,
  };
}

function makeLotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    itemId: 'item-1',
    warehouseId: 'wh-1',
    availableQty: 50,
    reservedQty: 0,
    unitCost: 10,
    status: 'active',
    version: 0,
    receiptDate: new Date('2025-01-01'),
    ...overrides,
  };
}

/** Stub the optimistic-lock findUnique → updateMany(count:1) cycle. */
function stubOptimisticLockSuccess(level?: Record<string, unknown>) {
  const row = makeLevelRow(level);
  mockPrisma.inventoryLevel.findUnique.mockResolvedValue(row);
  mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
}

// ═════════════════════════════════════════════════════════════════════════

describe('inventory.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── addStock ────────────────────────────────────────────────────────

  describe('addStock', () => {
    const baseParams = {
      itemId: 'item-1',
      warehouseId: 'wh-1',
      qty: 20,
      unitCost: 10,
      supplierId: 'sup-1',
      mrrvLineId: 'mrrv-line-1',
    };

    it('creates a new InventoryLevel when none exists', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryLevel.create.mockResolvedValue({});
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-001');

      await addStock(baseParams);

      expect(mockPrisma.inventoryLevel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: 'item-1',
            warehouseId: 'wh-1',
            qtyOnHand: 20,
            qtyReserved: 0,
            version: 0,
          }),
        }),
      );
    });

    it('updates existing level via optimistic locking when level exists', async () => {
      const existing = makeLevelRow();
      // First findUnique: the "existing" check inside addStock
      // Second findUnique: the optimistic lock read inside updateLevelWithVersion
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(existing) // exists check
        .mockResolvedValueOnce(existing); // optimistic lock read
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-002');

      await addStock(baseParams);

      expect(mockPrisma.inventoryLevel.create).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId: 'item-1',
            warehouseId: 'wh-1',
            version: existing.version,
          }),
          data: expect.objectContaining({
            qtyOnHand: { increment: 20 },
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('creates an InventoryLot with correct data', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryLevel.create.mockResolvedValue({});
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-100');

      await addStock({ ...baseParams, expiryDate: new Date('2026-12-31') });

      expect(mockPrisma.inventoryLot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lotNumber: 'LOT-100',
            itemId: 'item-1',
            warehouseId: 'wh-1',
            mrrvLineId: 'mrrv-line-1',
            initialQty: 20,
            availableQty: 20,
            reservedQty: 0,
            unitCost: 10,
            supplierId: 'sup-1',
            status: 'active',
            expiryDate: new Date('2026-12-31'),
          }),
        }),
      );
    });

    it('creates audit log when performedById is provided', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryLevel.create.mockResolvedValue({});
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-003');
      mockedAuditLog.mockResolvedValue({});

      await addStock({ ...baseParams, performedById: 'user-1' });

      expect(mockedAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'inventory_levels',
          recordId: 'item-1:wh-1',
          action: 'update',
          performedById: 'user-1',
          newValues: expect.objectContaining({ action: 'add_stock', qty: 20 }),
        }),
      );
    });

    it('skips audit log when performedById is not provided', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryLevel.create.mockResolvedValue({});
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-004');

      await addStock({ itemId: 'item-1', warehouseId: 'wh-1', qty: 5 });

      expect(mockedAuditLog).not.toHaveBeenCalled();
    });

    it('sets null for optional fields when not provided', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryLevel.create.mockResolvedValue({});
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-005');

      await addStock({ itemId: 'item-1', warehouseId: 'wh-1', qty: 5 });

      expect(mockPrisma.inventoryLot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitCost: null,
            supplierId: null,
            mrrvLineId: null,
            expiryDate: null,
          }),
        }),
      );
    });
  });

  // ─── reserveStock ────────────────────────────────────────────────────

  describe('reserveStock', () => {
    it('returns true on successful reservation', async () => {
      const level = makeLevelRow({ qtyOnHand: 100, qtyReserved: 0, version: 2 });
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(level) // availability check
        .mockResolvedValueOnce(level); // optimistic lock read
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([makeLotRow({ availableQty: 100, reservedQty: 0 })]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });

      const result = await reserveStock('item-1', 'wh-1', 10);

      expect(result).toBe(true);
    });

    it('returns false when no inventory level exists', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      const result = await reserveStock('item-1', 'wh-1', 10);

      expect(result).toBe(false);
    });

    it('returns false when insufficient available stock', async () => {
      const level = makeLevelRow({ qtyOnHand: 10, qtyReserved: 5 });
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(level);

      const result = await reserveStock('item-1', 'wh-1', 10);

      expect(result).toBe(false);
    });

    it('increments qtyReserved via optimistic locking', async () => {
      const level = makeLevelRow({ qtyOnHand: 100, qtyReserved: 0, version: 3 });
      mockPrisma.inventoryLevel.findUnique.mockResolvedValueOnce(level).mockResolvedValueOnce(level);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([makeLotRow({ availableQty: 100, reservedQty: 0 })]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });

      await reserveStock('item-1', 'wh-1', 25);

      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ version: 3 }),
          data: expect.objectContaining({
            qtyReserved: { increment: 25 },
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('reserves from lots in FIFO order', async () => {
      const level = makeLevelRow({ qtyOnHand: 100, qtyReserved: 0, version: 1 });
      mockPrisma.inventoryLevel.findUnique.mockResolvedValueOnce(level).mockResolvedValueOnce(level);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

      const lots = [
        makeLotRow({ id: 'lot-old', availableQty: 15, reservedQty: 0, receiptDate: new Date('2025-01-01') }),
        makeLotRow({ id: 'lot-new', availableQty: 30, reservedQty: 0, receiptDate: new Date('2025-06-01') }),
      ];
      mockPrisma.inventoryLot.findMany.mockResolvedValue(lots);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });

      await reserveStock('item-1', 'wh-1', 20);

      // First lot: reserve all 15, second lot: reserve remaining 5
      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lot-old', version: 0 },
          data: expect.objectContaining({ reservedQty: { increment: 15 }, version: { increment: 1 } }),
        }),
      );
      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lot-new', version: 0 },
          data: expect.objectContaining({ reservedQty: { increment: 5 }, version: { increment: 1 } }),
        }),
      );
    });
  });

  // ─── releaseReservation ──────────────────────────────────────────────

  describe('releaseReservation', () => {
    it('decrements qtyReserved on the inventory level', async () => {
      stubOptimisticLockSuccess({ qtyReserved: 30, version: 5 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      await releaseReservation('item-1', 'wh-1', 10);

      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyReserved: { decrement: 10 },
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('releases reserved qty from lots in FIFO order', async () => {
      stubOptimisticLockSuccess({ version: 1 });
      const lots = [
        makeLotRow({ id: 'lot-a', reservedQty: 8, receiptDate: new Date('2025-01-01') }),
        makeLotRow({ id: 'lot-b', reservedQty: 12, receiptDate: new Date('2025-03-01') }),
      ];
      mockPrisma.inventoryLot.findMany.mockResolvedValue(lots);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });

      await releaseReservation('item-1', 'wh-1', 15);

      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lot-a', version: 0 },
          data: expect.objectContaining({ reservedQty: { decrement: 8 }, version: { increment: 1 } }),
        }),
      );
      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lot-b', version: 0 },
          data: expect.objectContaining({ reservedQty: { decrement: 7 }, version: { increment: 1 } }),
        }),
      );
    });
  });

  // ─── consumeReservation ──────────────────────────────────────────────

  describe('consumeReservation', () => {
    it('decrements both qtyOnHand and qtyReserved', async () => {
      stubOptimisticLockSuccess({ qtyOnHand: 100, qtyReserved: 50, version: 2 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);
      // stub the low-stock alert findUnique (second call after optimistic lock)
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(makeLevelRow({ version: 2 })) // optimistic lock
        .mockResolvedValueOnce(null); // low-stock check (no level → skip)

      await consumeReservation('item-1', 'wh-1', 10, 'mirv-line-1');

      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyOnHand: { decrement: 10 },
            qtyReserved: { decrement: 10 },
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('creates LotConsumption records for consumed lots', async () => {
      stubOptimisticLockSuccess({ version: 1 });
      const lot = makeLotRow({ id: 'lot-c', availableQty: 30, unitCost: 5 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([lot]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lotConsumption.create.mockResolvedValue({});
      // low-stock alert check
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(makeLevelRow({ version: 1 })) // optimistic lock
        .mockResolvedValueOnce(null); // low-stock check

      await consumeReservation('item-1', 'wh-1', 10, 'mirv-line-1');

      expect(mockPrisma.lotConsumption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lotId: 'lot-c',
            mirvLineId: 'mirv-line-1',
            quantity: 10,
            unitCost: 5,
          }),
        }),
      );
    });

    it('returns totalCost based on lot unit costs', async () => {
      stubOptimisticLockSuccess({ version: 1 });
      const lots = [
        makeLotRow({ id: 'lot-1', availableQty: 5, unitCost: 10 }),
        makeLotRow({ id: 'lot-2', availableQty: 20, unitCost: 15 }),
      ];
      mockPrisma.inventoryLot.findMany.mockResolvedValue(lots);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lotConsumption.create.mockResolvedValue({});
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(makeLevelRow({ version: 1 }))
        .mockResolvedValueOnce(null);

      const result = await consumeReservation('item-1', 'wh-1', 8, 'mirv-line-1');

      // lot-1: 5 * 10 = 50, lot-2: 3 * 15 = 45 → total 95
      expect(result).toEqual({ totalCost: 95 });
    });

    it('marks lots as depleted when fully consumed', async () => {
      stubOptimisticLockSuccess({ version: 1 });
      const lot = makeLotRow({ id: 'lot-x', availableQty: 10, reservedQty: 5, unitCost: 2 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([lot]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lotConsumption.create.mockResolvedValue({});
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(makeLevelRow({ version: 1 }))
        .mockResolvedValueOnce(null);

      await consumeReservation('item-1', 'wh-1', 10, 'mirv-line-1');

      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lot-x', version: 0 },
          data: expect.objectContaining({
            availableQty: 0,
            status: 'depleted',
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('checks low-stock alerts after consumption', async () => {
      stubOptimisticLockSuccess({ version: 1 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      const levelWithAlert = {
        ...makeLevelRow({ qtyOnHand: 5, qtyReserved: 0, minLevel: 10, alertSent: false }),
        item: { itemCode: 'ITEM-1', itemDescription: 'Test Item' },
        warehouse: { warehouseCode: 'WH-1', warehouseName: 'Main' },
      };
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(makeLevelRow({ version: 1 })) // optimistic lock
        .mockResolvedValueOnce(levelWithAlert); // low-stock check
      mockPrisma.inventoryLevel.update.mockResolvedValue({});

      await consumeReservation('item-1', 'wh-1', 2, 'mirv-line-1');

      // Should set alertSent to true
      expect(mockPrisma.inventoryLevel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { alertSent: true },
        }),
      );
    });
  });

  // ─── deductStock ─────────────────────────────────────────────────────

  describe('deductStock', () => {
    const ref = { referenceType: 'stock_transfer', referenceId: 'st-1' };

    it('throws when no inventory level exists', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      await expect(deductStock('item-1', 'wh-1', 10, ref)).rejects.toThrow('Insufficient stock');
    });

    it('throws when stock is insufficient', async () => {
      const level = makeLevelRow({ qtyOnHand: 5 });
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(level);

      await expect(deductStock('item-1', 'wh-1', 10, ref)).rejects.toThrow('Insufficient stock');
    });

    it('decrements qtyOnHand via optimistic locking', async () => {
      const level = makeLevelRow({ qtyOnHand: 100, version: 4 });
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(level) // availability check
        .mockResolvedValueOnce(level) // optimistic lock
        .mockResolvedValueOnce(null); // low-stock check
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      await deductStock('item-1', 'wh-1', 20, ref);

      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyOnHand: { decrement: 20 },
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('creates LotConsumption with reference fields', async () => {
      const level = makeLevelRow({ qtyOnHand: 50, version: 1 });
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(level)
        .mockResolvedValueOnce(level)
        .mockResolvedValueOnce(null);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
      const lot = makeLotRow({ id: 'lot-d', availableQty: 50, unitCost: 8 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([lot]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lotConsumption.create.mockResolvedValue({});

      await deductStock('item-1', 'wh-1', 10, {
        referenceType: 'stock_transfer',
        referenceId: 'st-99',
      });

      expect(mockPrisma.lotConsumption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lotId: 'lot-d',
            mirvLineId: null,
            referenceType: 'stock_transfer',
            referenceId: 'st-99',
            quantity: 10,
            unitCost: 8,
          }),
        }),
      );
    });

    it('returns totalCost from consumed lots', async () => {
      const level = makeLevelRow({ qtyOnHand: 100, version: 1 });
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(level)
        .mockResolvedValueOnce(level)
        .mockResolvedValueOnce(null);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });
      const lots = [
        makeLotRow({ id: 'lot-e', availableQty: 10, unitCost: 20 }),
        makeLotRow({ id: 'lot-f', availableQty: 10, unitCost: 30 }),
      ];
      mockPrisma.inventoryLot.findMany.mockResolvedValue(lots);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lotConsumption.create.mockResolvedValue({});

      const result = await deductStock('item-1', 'wh-1', 15, ref);

      // lot-e: 10 * 20 = 200, lot-f: 5 * 30 = 150 → total 350
      expect(result).toEqual({ totalCost: 350 });
    });
  });

  // ─── getStockLevel ───────────────────────────────────────────────────

  describe('getStockLevel', () => {
    it('returns onHand, reserved, and available from existing level', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(makeLevelRow({ qtyOnHand: 80, qtyReserved: 20 }));

      const result = await getStockLevel('item-1', 'wh-1');

      expect(result).toEqual({ onHand: 80, reserved: 20, available: 60 });
    });

    it('returns zeros when no inventory level exists', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      const result = await getStockLevel('item-1', 'wh-1');

      expect(result).toEqual({ onHand: 0, reserved: 0, available: 0 });
    });

    it('queries with correct composite key', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      await getStockLevel('item-99', 'wh-42');

      expect(mockPrisma.inventoryLevel.findUnique).toHaveBeenCalledWith({
        where: { itemId_warehouseId: { itemId: 'item-99', warehouseId: 'wh-42' } },
      });
    });
  });

  // ─── Optimistic Locking Edge Cases ───────────────────────────────────

  describe('optimistic locking', () => {
    it('retries on version mismatch and succeeds on second attempt', async () => {
      const level = makeLevelRow({ version: 5 });
      // addStock will: findUnique(existing check) → findUnique(lock) → updateMany(fail) → findUnique(retry) → updateMany(success)
      mockPrisma.inventoryLevel.findUnique
        .mockResolvedValueOnce(level) // existing check
        .mockResolvedValueOnce(level) // first lock attempt
        .mockResolvedValueOnce(level); // retry lock
      mockPrisma.inventoryLevel.updateMany
        .mockResolvedValueOnce({ count: 0 }) // version mismatch
        .mockResolvedValueOnce({ count: 1 }); // success on retry
      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-RETRY');

      await addStock({ itemId: 'item-1', warehouseId: 'wh-1', qty: 5 });

      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledTimes(2);
    });

    it('throws after MAX_RETRIES (3) version mismatches', async () => {
      const level = makeLevelRow({ version: 5 });
      // existing check + 3 retry findUniques
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(level);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 0 }); // always fails

      mockPrisma.inventoryLot.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('LOT-FAIL');

      await expect(addStock({ itemId: 'item-1', warehouseId: 'wh-1', qty: 5 })).rejects.toThrow(
        /Optimistic lock failure/,
      );

      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledTimes(3);
    });
  });
});
