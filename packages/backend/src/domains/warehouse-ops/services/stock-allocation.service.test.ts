import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  allocate,
  release,
  confirmPick,
  cancel,
  getByDemand,
  getAvailable,
  getAllocations,
  bulkAllocate,
  getStats,
} from './stock-allocation.service.js';

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WH_ID = 'wh-001';

function makeAllocationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alloc-001',
    warehouseId: WH_ID,
    itemId: 'item-001',
    lotId: 'lot-001',
    binId: null,
    lpnId: null,
    qtyAllocated: 50,
    allocType: 'hard',
    demandDocType: 'mi',
    demandDocId: 'mi-001',
    status: 'active',
    allocatedById: 'user-001',
    allocatedAt: new Date('2026-02-01T10:00:00Z'),
    releasedAt: null,
    warehouse: { id: WH_ID, warehouseName: 'Main WH', warehouseCode: 'WH-01' },
    item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
    lot: { id: 'lot-001', lotNumber: 'LOT-001' },
    bin: null,
    allocatedBy: { id: 'user-001', employeeCode: 'EMP-001', firstName: 'John', lastName: 'Doe' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('stock-allocation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).stockAllocation = createModelMock();
  });

  const stockAllocation = () => (mockPrisma as unknown as { stockAllocation: PrismaModelMock }).stockAllocation;

  // ########################################################################
  // allocate
  // ########################################################################

  describe('allocate', () => {
    it('should create an allocation record', async () => {
      const input = {
        warehouseId: WH_ID,
        itemId: 'item-001',
        lotId: 'lot-001',
        qtyAllocated: 50,
        allocType: 'hard',
        demandDocType: 'mi',
        demandDocId: 'mi-001',
        allocatedById: 'user-001',
      };
      const created = makeAllocationRecord();
      stockAllocation().create.mockResolvedValue(created);

      const result = await allocate(input);

      expect(stockAllocation().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          warehouseId: WH_ID,
          itemId: 'item-001',
          qtyAllocated: 50,
        }),
        include: expect.objectContaining({
          warehouse: expect.any(Object),
          item: expect.any(Object),
        }),
      });
      expect(result).toEqual(created);
    });
  });

  // ########################################################################
  // release
  // ########################################################################

  describe('release', () => {
    it('should release an active allocation', async () => {
      stockAllocation().findUnique.mockResolvedValue(makeAllocationRecord({ status: 'active' }));
      stockAllocation().update.mockResolvedValue(makeAllocationRecord({ status: 'released', releasedAt: new Date() }));

      const result = await release('alloc-001');

      expect(stockAllocation().update).toHaveBeenCalledWith({
        where: { id: 'alloc-001' },
        data: { status: 'released', releasedAt: expect.any(Date) },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('released');
    });

    it('should throw NotFoundError when not found', async () => {
      stockAllocation().findUnique.mockResolvedValue(null);
      await expect(release('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not active', async () => {
      stockAllocation().findUnique.mockResolvedValue(makeAllocationRecord({ status: 'picked' }));
      await expect(release('alloc-001')).rejects.toThrow(
        "Cannot release allocation in status 'picked'. Must be 'active'.",
      );
    });
  });

  // ########################################################################
  // confirmPick
  // ########################################################################

  describe('confirmPick', () => {
    it('should confirm pick on an active allocation', async () => {
      stockAllocation().findUnique.mockResolvedValue(makeAllocationRecord({ status: 'active' }));
      stockAllocation().update.mockResolvedValue(makeAllocationRecord({ status: 'picked' }));

      const result = await confirmPick('alloc-001');

      expect(stockAllocation().update).toHaveBeenCalledWith({
        where: { id: 'alloc-001' },
        data: { status: 'picked' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('picked');
    });

    it('should throw error when status is not active', async () => {
      stockAllocation().findUnique.mockResolvedValue(makeAllocationRecord({ status: 'released' }));
      await expect(confirmPick('alloc-001')).rejects.toThrow(
        "Cannot confirm pick for allocation in status 'released'. Must be 'active'.",
      );
    });
  });

  // ########################################################################
  // cancel
  // ########################################################################

  describe('cancel', () => {
    it('should cancel an active allocation', async () => {
      stockAllocation().findUnique.mockResolvedValue(makeAllocationRecord({ status: 'active' }));
      stockAllocation().update.mockResolvedValue(makeAllocationRecord({ status: 'cancelled', releasedAt: new Date() }));

      const result = await cancel('alloc-001');

      expect(stockAllocation().update).toHaveBeenCalledWith({
        where: { id: 'alloc-001' },
        data: { status: 'cancelled', releasedAt: expect.any(Date) },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('cancelled');
    });

    it('should throw error when status is not active', async () => {
      stockAllocation().findUnique.mockResolvedValue(makeAllocationRecord({ status: 'cancelled' }));
      await expect(cancel('alloc-001')).rejects.toThrow(
        "Cannot cancel allocation in status 'cancelled'. Must be 'active'.",
      );
    });

    it('should throw NotFoundError when not found', async () => {
      stockAllocation().findUnique.mockResolvedValue(null);
      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getByDemand
  // ########################################################################

  describe('getByDemand', () => {
    it('should return allocations for the given demand document', async () => {
      const records = [makeAllocationRecord()];
      stockAllocation().findMany.mockResolvedValue(records);

      const result = await getByDemand('mi', 'mi-001');

      expect(stockAllocation().findMany).toHaveBeenCalledWith({
        where: { demandDocType: 'mi', demandDocId: 'mi-001' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
        orderBy: { allocatedAt: 'desc' },
      });
      expect(result).toEqual(records);
    });

    it('should return empty array when no allocations exist', async () => {
      stockAllocation().findMany.mockResolvedValue([]);

      const result = await getByDemand('wt', 'wt-999');
      expect(result).toEqual([]);
    });
  });

  // ########################################################################
  // getAvailable
  // ########################################################################

  describe('getAvailable', () => {
    it('should return total allocated quantity for the item', async () => {
      stockAllocation().aggregate.mockResolvedValue({ _sum: { qtyAllocated: 150 } });

      const result = await getAvailable(WH_ID, 'item-001');

      expect(stockAllocation().aggregate).toHaveBeenCalledWith({
        where: { warehouseId: WH_ID, itemId: 'item-001', status: 'active' },
        _sum: { qtyAllocated: true },
      });
      expect(result).toEqual({
        warehouseId: WH_ID,
        itemId: 'item-001',
        totalAllocated: 150,
      });
    });

    it('should return zero when no active allocations exist', async () => {
      stockAllocation().aggregate.mockResolvedValue({ _sum: { qtyAllocated: null } });

      const result = await getAvailable(WH_ID, 'item-001');
      expect(result.totalAllocated).toBe(0);
    });
  });

  // ########################################################################
  // getAllocations
  // ########################################################################

  describe('getAllocations', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeAllocationRecord()];
      stockAllocation().findMany.mockResolvedValue(records);
      stockAllocation().count.mockResolvedValue(1);

      const result = await getAllocations({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
    });

    it('should apply filters', async () => {
      stockAllocation().findMany.mockResolvedValue([]);
      stockAllocation().count.mockResolvedValue(0);

      await getAllocations({ warehouseId: WH_ID, status: 'active', demandDocType: 'mi' });

      expect(stockAllocation().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: WH_ID,
            status: 'active',
            demandDocType: 'mi',
          }),
        }),
      );
    });
  });

  // ########################################################################
  // bulkAllocate
  // ########################################################################

  describe('bulkAllocate', () => {
    it('should allocate from lots in FIFO order', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([
        { id: 'lot-001', warehouseId: WH_ID, quantityOnHand: 30, createdAt: new Date('2026-01-01') },
        { id: 'lot-002', warehouseId: WH_ID, quantityOnHand: 50, createdAt: new Date('2026-01-15') },
      ]);
      stockAllocation()
        .create.mockResolvedValueOnce(makeAllocationRecord({ lotId: 'lot-001', qtyAllocated: 30 }))
        .mockResolvedValueOnce(makeAllocationRecord({ lotId: 'lot-002', qtyAllocated: 20 }));

      const result = await bulkAllocate('mi', 'mi-001', [{ itemId: 'item-001', qty: 50 }], WH_ID);

      expect(result).toHaveLength(2);
      expect(stockAllocation().create).toHaveBeenCalledTimes(2);
    });

    it('should allocate only up to available quantity', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([
        { id: 'lot-001', warehouseId: WH_ID, quantityOnHand: 20, createdAt: new Date('2026-01-01') },
      ]);
      stockAllocation().create.mockResolvedValue(makeAllocationRecord({ qtyAllocated: 20 }));

      const result = await bulkAllocate('mi', 'mi-001', [{ itemId: 'item-001', qty: 50 }], WH_ID);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no lots available', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      const result = await bulkAllocate('mi', 'mi-001', [{ itemId: 'item-001', qty: 50 }]);

      expect(result).toEqual([]);
    });
  });

  // ########################################################################
  // getStats
  // ########################################################################

  describe('getStats', () => {
    it('should return active count and total allocated qty', async () => {
      stockAllocation().count.mockResolvedValue(5);
      stockAllocation().aggregate.mockResolvedValue({ _sum: { qtyAllocated: 250 } });

      const stats = await getStats();

      expect(stats).toEqual({
        totalAllocatedQty: 250,
        activeCount: 5,
      });
    });

    it('should return zeros when no active allocations exist', async () => {
      stockAllocation().count.mockResolvedValue(0);
      stockAllocation().aggregate.mockResolvedValue({ _sum: { qtyAllocated: null } });

      const stats = await getStats();

      expect(stats).toEqual({ totalAllocatedQty: 0, activeCount: 0 });
    });

    it('should filter by warehouseId when provided', async () => {
      stockAllocation().count.mockResolvedValue(0);
      stockAllocation().aggregate.mockResolvedValue({ _sum: { qtyAllocated: null } });

      await getStats(WH_ID);

      expect(stockAllocation().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID, status: 'active' }),
        }),
      );
    });
  });
});
