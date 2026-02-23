import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  identifyOpportunities,
  createCrossDock,
  getCrossDockById,
  getCrossDocks,
  approveCrossDock,
  executeCrossDock,
  completeCrossDock,
  cancelCrossDock,
  getStats,
} from './cross-dock.service.js';

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

function makeCrossDockRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cd-001',
    warehouseId: WH_ID,
    itemId: 'item-001',
    sourceGrnId: 'grn-001',
    targetDocumentId: 'mi-001',
    targetDocumentType: 'mi',
    quantity: 50,
    status: 'identified',
    createdAt: new Date('2026-02-01T10:00:00Z'),
    completedAt: null,
    warehouse: { id: WH_ID, warehouseName: 'Main WH', warehouseCode: 'WH-01' },
    item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes', category: 'Materials' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('cross-dock.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).crossDock = createModelMock();
  });

  const crossDock = () => (mockPrisma as unknown as { crossDock: PrismaModelMock }).crossDock;

  // ########################################################################
  // identifyOpportunities
  // ########################################################################

  describe('identifyOpportunities', () => {
    it('should return empty array when no GRNs exist', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);
      expect(result).toEqual([]);
    });

    it('should return empty array when GRNs exist but no matching demand', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 100,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);
      expect(result).toEqual([]);
    });

    it('should match GRN supply to MI demand', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 100,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 40, qtyIssued: 0 }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('item-001');
      expect(result[0].sourceGrnId).toBe('grn-001');
      expect(result[0].grnQuantity).toBe(100);
      expect(result[0].targets).toHaveLength(1);
      expect(result[0].targets[0]).toEqual({
        type: 'mi',
        id: 'mi-001',
        documentNumber: 'MI-001',
        quantityNeeded: 40,
      });
      expect(result[0].suggestedQuantity).toBe(40); // min(100 supply, 40 demand)
    });

    it('should match GRN supply to WT demand', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-002',
              qtyReceived: 75,
              item: { id: 'item-002', itemCode: 'ITM-002', itemDescription: 'Cables' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([
        {
          id: 'wt-001',
          transferNumber: 'WT-001',
          stockTransferLines: [{ itemId: 'item-002', quantity: 50 }],
        },
      ]);

      const result = await identifyOpportunities(WH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].targets[0]).toEqual({
        type: 'wt',
        id: 'wt-001',
        documentNumber: 'WT-001',
        quantityNeeded: 50,
      });
      expect(result[0].suggestedQuantity).toBe(50);
    });

    it('should combine MI and WT demand for the same item', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 200,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 80, qtyIssued: 10 }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([
        {
          id: 'wt-001',
          transferNumber: 'WT-001',
          stockTransferLines: [{ itemId: 'item-001', quantity: 60 }],
        },
      ]);

      const result = await identifyOpportunities(WH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].targets).toHaveLength(2);
      // MI demand: 80-10=70, WT demand: 60, total=130
      expect(result[0].suggestedQuantity).toBe(130); // min(200, 130)
    });

    it('should cap suggestedQuantity at GRN quantity when demand exceeds supply', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 30,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 100, qtyIssued: 0 }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);

      expect(result[0].suggestedQuantity).toBe(30); // capped at supply
    });

    it('should skip MI lines that are fully issued', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 50,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 40, qtyIssued: 40 }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);
      expect(result).toEqual([]);
    });

    it('should skip GRN lines with zero qtyReceived', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 0,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 40, qtyIssued: 0 }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);
      expect(result).toEqual([]);
    });

    it('should skip WT lines with zero quantity', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-002',
              qtyReceived: 50,
              item: { id: 'item-002', itemCode: 'ITM-002', itemDescription: 'Cables' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([
        {
          id: 'wt-001',
          transferNumber: 'WT-001',
          stockTransferLines: [{ itemId: 'item-002', quantity: 0 }],
        },
      ]);

      const result = await identifyOpportunities(WH_ID);
      expect(result).toEqual([]);
    });

    it('should handle multiple GRN lines for different items', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 100,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
            {
              itemId: 'item-002',
              qtyReceived: 50,
              item: { id: 'item-002', itemCode: 'ITM-002', itemDescription: 'Cables' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [
            { itemId: 'item-001', qtyRequested: 30, qtyIssued: 0 },
            { itemId: 'item-002', qtyRequested: 20, qtyIssued: 0 },
          ],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);

      expect(result).toHaveLength(2);
      expect(result[0].itemId).toBe('item-001');
      expect(result[1].itemId).toBe('item-002');
    });

    it('should handle null qtyIssued as zero', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: 60,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 25, qtyIssued: null }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].targets[0].quantityNeeded).toBe(25);
    });

    it('should handle null qtyReceived as zero and skip it', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-001',
          mrrvNumber: 'GRN-001',
          mrrvLines: [
            {
              itemId: 'item-001',
              qtyReceived: null,
              item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
            },
          ],
        },
      ]);
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: 'mi-001',
          mirvNumber: 'MI-001',
          mirvLines: [{ itemId: 'item-001', qtyRequested: 10, qtyIssued: 0 }],
        },
      ]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      const result = await identifyOpportunities(WH_ID);
      expect(result).toEqual([]);
    });

    it('should query GRNs with approved status at the given warehouse', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.stockTransfer.findMany.mockResolvedValue([]);

      await identifyOpportunities(WH_ID);

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: WH_ID, status: 'approved' },
        }),
      );
    });
  });

  // ########################################################################
  // createCrossDock
  // ########################################################################

  describe('createCrossDock', () => {
    it('should create a cross-dock record with given data', async () => {
      const input = {
        warehouseId: WH_ID,
        itemId: 'item-001',
        sourceGrnId: 'grn-001',
        targetDocumentId: 'mi-001',
        targetDocumentType: 'mi',
        quantity: 50,
        status: 'identified',
      };
      const created = makeCrossDockRecord();
      crossDock().create.mockResolvedValue(created);

      const result = await createCrossDock(input as never);

      expect(crossDock().create).toHaveBeenCalledWith({
        data: input,
        include: expect.objectContaining({
          warehouse: expect.any(Object),
          item: expect.any(Object),
        }),
      });
      expect(result).toEqual(created);
    });
  });

  // ########################################################################
  // getCrossDockById
  // ########################################################################

  describe('getCrossDockById', () => {
    it('should return the record when found', async () => {
      const record = makeCrossDockRecord();
      crossDock().findUnique.mockResolvedValue(record);

      const result = await getCrossDockById('cd-001');

      expect(crossDock().findUnique).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result).toEqual(record);
    });

    it('should throw NotFoundError when record does not exist', async () => {
      crossDock().findUnique.mockResolvedValue(null);

      await expect(getCrossDockById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getCrossDocks
  // ########################################################################

  describe('getCrossDocks', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeCrossDockRecord()];
      crossDock().findMany.mockResolvedValue(records);
      crossDock().count.mockResolvedValue(1);

      const result = await getCrossDocks({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
      expect(crossDock().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should apply warehouseId filter', async () => {
      crossDock().findMany.mockResolvedValue([]);
      crossDock().count.mockResolvedValue(0);

      await getCrossDocks({ warehouseId: WH_ID });

      expect(crossDock().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID }),
        }),
      );
    });

    it('should apply status filter', async () => {
      crossDock().findMany.mockResolvedValue([]);
      crossDock().count.mockResolvedValue(0);

      await getCrossDocks({ status: 'approved' });

      expect(crossDock().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });

    it('should handle custom page and pageSize', async () => {
      crossDock().findMany.mockResolvedValue([]);
      crossDock().count.mockResolvedValue(50);

      const result = await getCrossDocks({ page: 3, pageSize: 10 });

      expect(crossDock().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });
  });

  // ########################################################################
  // approveCrossDock
  // ########################################################################

  describe('approveCrossDock', () => {
    it('should approve an identified cross-dock', async () => {
      const record = makeCrossDockRecord({ status: 'identified' });
      const approved = makeCrossDockRecord({ status: 'approved' });
      crossDock().findUnique.mockResolvedValue(record);
      crossDock().update.mockResolvedValue(approved);

      const result = await approveCrossDock('cd-001');

      expect(crossDock().update).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
        data: { status: 'approved' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundError when record does not exist', async () => {
      crossDock().findUnique.mockResolvedValue(null);
      await expect(approveCrossDock('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not identified', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'approved' }));
      await expect(approveCrossDock('cd-001')).rejects.toThrow(
        "Cannot approve cross-dock in status 'approved'. Must be 'identified'.",
      );
    });

    it('should throw error when trying to approve a completed cross-dock', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'completed' }));
      await expect(approveCrossDock('cd-001')).rejects.toThrow(
        "Cannot approve cross-dock in status 'completed'. Must be 'identified'.",
      );
    });
  });

  // ########################################################################
  // executeCrossDock
  // ########################################################################

  describe('executeCrossDock', () => {
    it('should execute an approved cross-dock', async () => {
      const record = makeCrossDockRecord({ status: 'approved' });
      const executed = makeCrossDockRecord({ status: 'in_progress' });
      crossDock().findUnique.mockResolvedValue(record);
      crossDock().update.mockResolvedValue(executed);

      const result = await executeCrossDock('cd-001');

      expect(crossDock().update).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
        data: { status: 'in_progress' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('in_progress');
    });

    it('should throw NotFoundError when record does not exist', async () => {
      crossDock().findUnique.mockResolvedValue(null);
      await expect(executeCrossDock('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not approved', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'identified' }));
      await expect(executeCrossDock('cd-001')).rejects.toThrow(
        "Cannot execute cross-dock in status 'identified'. Must be 'approved'.",
      );
    });

    it('should throw error when trying to execute an in_progress cross-dock', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'in_progress' }));
      await expect(executeCrossDock('cd-001')).rejects.toThrow(
        "Cannot execute cross-dock in status 'in_progress'. Must be 'approved'.",
      );
    });
  });

  // ########################################################################
  // completeCrossDock
  // ########################################################################

  describe('completeCrossDock', () => {
    it('should complete an in_progress cross-dock', async () => {
      const record = makeCrossDockRecord({ status: 'in_progress' });
      const completed = makeCrossDockRecord({ status: 'completed', completedAt: new Date() });
      crossDock().findUnique.mockResolvedValue(record);
      crossDock().update.mockResolvedValue(completed);

      const result = await completeCrossDock('cd-001');

      expect(crossDock().update).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
        data: { status: 'completed', completedAt: expect.any(Date) },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('completed');
    });

    it('should throw NotFoundError when record does not exist', async () => {
      crossDock().findUnique.mockResolvedValue(null);
      await expect(completeCrossDock('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not in_progress', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'approved' }));
      await expect(completeCrossDock('cd-001')).rejects.toThrow(
        "Cannot complete cross-dock in status 'approved'. Must be 'in_progress'.",
      );
    });

    it('should throw error when trying to complete an already completed cross-dock', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'completed' }));
      await expect(completeCrossDock('cd-001')).rejects.toThrow(
        "Cannot complete cross-dock in status 'completed'. Must be 'in_progress'.",
      );
    });
  });

  // ########################################################################
  // cancelCrossDock
  // ########################################################################

  describe('cancelCrossDock', () => {
    it('should cancel an identified cross-dock', async () => {
      const record = makeCrossDockRecord({ status: 'identified' });
      const cancelled = makeCrossDockRecord({ status: 'cancelled' });
      crossDock().findUnique.mockResolvedValue(record);
      crossDock().update.mockResolvedValue(cancelled);

      const result = await cancelCrossDock('cd-001');
      expect(result.status).toBe('cancelled');
    });

    it('should cancel an approved cross-dock', async () => {
      const record = makeCrossDockRecord({ status: 'approved' });
      const cancelled = makeCrossDockRecord({ status: 'cancelled' });
      crossDock().findUnique.mockResolvedValue(record);
      crossDock().update.mockResolvedValue(cancelled);

      const result = await cancelCrossDock('cd-001');
      expect(result.status).toBe('cancelled');
    });

    it('should cancel an in_progress cross-dock', async () => {
      const record = makeCrossDockRecord({ status: 'in_progress' });
      const cancelled = makeCrossDockRecord({ status: 'cancelled' });
      crossDock().findUnique.mockResolvedValue(record);
      crossDock().update.mockResolvedValue(cancelled);

      const result = await cancelCrossDock('cd-001');

      expect(crossDock().update).toHaveBeenCalledWith({
        where: { id: 'cd-001' },
        data: { status: 'cancelled' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundError when record does not exist', async () => {
      crossDock().findUnique.mockResolvedValue(null);
      await expect(cancelCrossDock('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is completed', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'completed' }));
      await expect(cancelCrossDock('cd-001')).rejects.toThrow("Cannot cancel cross-dock in status 'completed'.");
    });

    it('should throw error when status is already cancelled', async () => {
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'cancelled' }));
      await expect(cancelCrossDock('cd-001')).rejects.toThrow("Cannot cancel cross-dock in status 'cancelled'.");
    });
  });

  // ########################################################################
  // getStats
  // ########################################################################

  describe('getStats', () => {
    it('should return all zero stats when no records exist', async () => {
      crossDock().count.mockResolvedValue(0);
      crossDock().findMany.mockResolvedValue([]);

      const stats = await getStats();

      expect(stats).toEqual({
        totalIdentified: 0,
        totalActive: 0,
        totalCompleted: 0,
        totalCancelled: 0,
        totalItemsBypassed: 0,
        avgCompletionHours: 0,
      });
    });

    it('should compute correct counts by status', async () => {
      crossDock()
        .count.mockResolvedValueOnce(5) // identified
        .mockResolvedValueOnce(3) // active (approved + in_progress)
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(2); // cancelled
      crossDock().findMany.mockResolvedValue([]);

      const stats = await getStats();

      expect(stats.totalIdentified).toBe(5);
      expect(stats.totalActive).toBe(3);
      expect(stats.totalCompleted).toBe(10);
      expect(stats.totalCancelled).toBe(2);
    });

    it('should calculate avgCompletionHours from completed records', async () => {
      crossDock().count.mockResolvedValue(1);
      crossDock().findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-02-01T10:00:00Z'),
          completedAt: new Date('2026-02-01T16:00:00Z'), // 6 hours
          quantity: 50,
        },
        {
          createdAt: new Date('2026-02-02T08:00:00Z'),
          completedAt: new Date('2026-02-02T20:00:00Z'), // 12 hours
          quantity: 30,
        },
      ]);

      const stats = await getStats();

      // avg = (6 + 12) / 2 = 9.0
      expect(stats.avgCompletionHours).toBe(9);
      expect(stats.totalItemsBypassed).toBe(80); // 50 + 30
    });

    it('should round avgCompletionHours to one decimal place', async () => {
      crossDock().count.mockResolvedValue(1);
      crossDock().findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-02-01T10:00:00Z'),
          completedAt: new Date('2026-02-01T13:20:00Z'), // 3.333... hours
          quantity: 10,
        },
      ]);

      const stats = await getStats();

      // Math.round(3.333... * 10) / 10 = 3.3
      expect(stats.avgCompletionHours).toBe(3.3);
    });

    it('should filter by warehouseId when provided', async () => {
      crossDock().count.mockResolvedValue(0);
      crossDock().findMany.mockResolvedValue([]);

      await getStats(WH_ID);

      // Each count call should include warehouseId in the where clause
      expect(crossDock().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID }),
        }),
      );
    });

    it('should not include warehouseId filter when not provided', async () => {
      crossDock().count.mockResolvedValue(0);
      crossDock().findMany.mockResolvedValue([]);

      await getStats();

      // The first count call (identified) should not have warehouseId
      expect(crossDock().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'identified' }),
        }),
      );
    });

    it('should handle completed records with null completedAt gracefully', async () => {
      crossDock().count.mockResolvedValue(1);
      crossDock().findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-02-01T10:00:00Z'),
          completedAt: null,
          quantity: 20,
        },
        {
          createdAt: new Date('2026-02-01T10:00:00Z'),
          completedAt: new Date('2026-02-01T14:00:00Z'), // 4 hours
          quantity: 30,
        },
      ]);

      const stats = await getStats();

      // Only the record with completedAt contributes to hours: 4/2 = 2
      expect(stats.avgCompletionHours).toBe(2);
      expect(stats.totalItemsBypassed).toBe(50); // both counted
    });
  });

  // ########################################################################
  // Full lifecycle: identified -> approved -> in_progress -> completed
  // ########################################################################

  describe('full lifecycle', () => {
    it('should transition through all happy-path states', async () => {
      // identified -> approved
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'identified' }));
      crossDock().update.mockResolvedValue(makeCrossDockRecord({ status: 'approved' }));
      const r1 = await approveCrossDock('cd-001');
      expect(r1.status).toBe('approved');

      // approved -> in_progress
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'approved' }));
      crossDock().update.mockResolvedValue(makeCrossDockRecord({ status: 'in_progress' }));
      const r2 = await executeCrossDock('cd-001');
      expect(r2.status).toBe('in_progress');

      // in_progress -> completed
      crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status: 'in_progress' }));
      crossDock().update.mockResolvedValue(makeCrossDockRecord({ status: 'completed', completedAt: new Date() }));
      const r3 = await completeCrossDock('cd-001');
      expect(r3.status).toBe('completed');
    });

    it('should allow cancellation at any non-terminal state', async () => {
      for (const status of ['identified', 'approved', 'in_progress']) {
        crossDock().findUnique.mockResolvedValue(makeCrossDockRecord({ status }));
        crossDock().update.mockResolvedValue(makeCrossDockRecord({ status: 'cancelled' }));

        const result = await cancelCrossDock('cd-001');
        expect(result.status).toBe('cancelled');
      }
    });
  });
});
