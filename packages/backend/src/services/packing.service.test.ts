import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  getPackingQueue,
  createSession,
  addPackingLine,
  completeSession,
  getSessionById,
  cancelSession,
} from './packing.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

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

describe('Packing Service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).packingSession = createModelMock();
    (mockPrisma as Record<string, unknown>).packingLine = createModelMock();
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // getPackingQueue
  // ────────────────────────────────────────────────────────────────────────────────
  describe('getPackingQueue', () => {
    it('should return approved MIs without completed packing sessions', async () => {
      const mockMirvs = [
        {
          id: 'mirv-1',
          mirvNumber: 'MI-2026-0001',
          status: 'approved',
          project: { id: 'proj-1', projectName: 'Project A', projectCode: 'PA' },
          mirvLines: [
            {
              id: 'line-1',
              itemId: 'item-1',
              qtyRequested: 10,
              item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Item One' },
            },
          ],
        },
        {
          id: 'mirv-2',
          mirvNumber: 'MI-2026-0002',
          status: 'approved',
          project: { id: 'proj-2', projectName: 'Project B', projectCode: 'PB' },
          mirvLines: [],
        },
      ];

      mockPrisma.mirv.findMany.mockResolvedValue(mockMirvs);

      const result = await getPackingQueue('warehouse-1');

      expect(mockPrisma.mirv.findMany).toHaveBeenCalledWith({
        where: {
          warehouseId: 'warehouse-1',
          status: 'approved',
          packingSessions: { none: { status: 'completed' } },
        },
        include: {
          project: { select: { id: true, projectName: true, projectCode: true } },
          mirvLines: {
            include: {
              item: { select: { id: true, itemCode: true, itemDescription: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockMirvs);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no MIs are ready for packing', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([]);

      const result = await getPackingQueue('warehouse-2');

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // createSession
  // ────────────────────────────────────────────────────────────────────────────────
  describe('createSession', () => {
    it('should create a new packing session with generated session number', async () => {
      const mockMirv = { id: 'mirv-1', status: 'approved', mirvNumber: 'MI-2026-0001' };
      const mockSession = {
        id: 'session-1',
        sessionNumber: 'PACK-2026-0001',
        mirvId: 'mirv-1',
        packedById: 'user-1',
        warehouseId: 'warehouse-1',
        status: 'in_progress',
        cartonCount: 0,
        palletCount: 0,
        mirv: mockMirv,
        warehouse: { id: 'warehouse-1', warehouseName: 'Main Warehouse', warehouseCode: 'MW' },
        packedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        lines: [],
      };

      mockPrisma.mirv.findUnique.mockResolvedValue(mockMirv);
      (mockPrisma as any).packingSession.findFirst.mockResolvedValue(null);
      (mockPrisma as any).packingSession.count.mockResolvedValue(0);
      (mockPrisma as any).packingSession.create.mockResolvedValue(mockSession);

      const result = await createSession('mirv-1', 'user-1', 'warehouse-1');

      expect(mockPrisma.mirv.findUnique).toHaveBeenCalledWith({ where: { id: 'mirv-1' } });
      expect((mockPrisma as any).packingSession.findFirst).toHaveBeenCalledWith({
        where: { mirvId: 'mirv-1', status: 'in_progress' },
      });
      expect((mockPrisma as any).packingSession.count).toHaveBeenCalledWith({
        where: { sessionNumber: { startsWith: 'PACK-2026-' } },
      });
      expect((mockPrisma as any).packingSession.create).toHaveBeenCalledWith({
        data: {
          sessionNumber: 'PACK-2026-0001',
          mirvId: 'mirv-1',
          packedById: 'user-1',
          warehouseId: 'warehouse-1',
          status: 'in_progress',
          cartonCount: 0,
          palletCount: 0,
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockSession);
    });

    it('should generate sequential session numbers', async () => {
      const mockMirv = { id: 'mirv-1', status: 'approved' };
      const mockSession = {
        id: 'session-2',
        sessionNumber: 'PACK-2026-0042',
        status: 'in_progress',
      };

      mockPrisma.mirv.findUnique.mockResolvedValue(mockMirv);
      (mockPrisma as any).packingSession.findFirst.mockResolvedValue(null);
      (mockPrisma as any).packingSession.count.mockResolvedValue(41);
      (mockPrisma as any).packingSession.create.mockResolvedValue(mockSession);

      await createSession('mirv-1', 'user-1', 'warehouse-1');

      expect((mockPrisma as any).packingSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionNumber: 'PACK-2026-0042' }),
        }),
      );
    });

    it('should throw NotFoundError when MI does not exist', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(createSession('invalid-id', 'user-1', 'warehouse-1')).rejects.toThrow(NotFoundError);
      await expect(createSession('invalid-id', 'user-1', 'warehouse-1')).rejects.toThrow('MI not found');
    });

    it('should throw BusinessRuleError when MI is not approved', async () => {
      const mockMirv = { id: 'mirv-1', status: 'draft' };
      mockPrisma.mirv.findUnique.mockResolvedValue(mockMirv);

      await expect(createSession('mirv-1', 'user-1', 'warehouse-1')).rejects.toThrow(BusinessRuleError);
      await expect(createSession('mirv-1', 'user-1', 'warehouse-1')).rejects.toThrow(
        'MI must be in approved status to start packing',
      );
    });

    it('should throw BusinessRuleError when active session already exists', async () => {
      const mockMirv = { id: 'mirv-1', status: 'approved' };
      const existingSession = { id: 'session-1', status: 'in_progress' };

      mockPrisma.mirv.findUnique.mockResolvedValue(mockMirv);
      (mockPrisma as any).packingSession.findFirst.mockResolvedValue(existingSession);

      await expect(createSession('mirv-1', 'user-1', 'warehouse-1')).rejects.toThrow(BusinessRuleError);
      await expect(createSession('mirv-1', 'user-1', 'warehouse-1')).rejects.toThrow(
        'An active packing session already exists for this MI',
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // addPackingLine
  // ────────────────────────────────────────────────────────────────────────────────
  describe('addPackingLine', () => {
    const mockSession = {
      id: 'session-1',
      status: 'in_progress',
      cartonCount: 2,
      palletCount: 1,
    };

    it('should add a carton line and increment carton count', async () => {
      const lineData = {
        itemId: 'item-1',
        qtyPacked: 10,
        containerType: 'carton',
        containerLabel: 'C-001',
        weight: 5.5,
        volume: 0.2,
        scannedBarcode: 'BC-12345',
      };

      const mockLine = {
        id: 'line-1',
        ...lineData,
        packingSessionId: 'session-1',
        item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Item One' },
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingLine.create.mockResolvedValue(mockLine);
      (mockPrisma as any).packingSession.update.mockResolvedValue({ ...mockSession, cartonCount: 3 });

      const result = await addPackingLine('session-1', lineData);

      expect((mockPrisma as any).packingLine.create).toHaveBeenCalledWith({
        data: {
          packingSessionId: 'session-1',
          itemId: 'item-1',
          qtyPacked: 10,
          containerType: 'carton',
          containerLabel: 'C-001',
          weight: 5.5,
          volume: 0.2,
          scannedBarcode: 'BC-12345',
        },
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true } },
        },
      });
      expect((mockPrisma as any).packingSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { cartonCount: { increment: 1 } },
      });
      expect(result).toEqual(mockLine);
    });

    it('should add a pallet line and increment pallet count', async () => {
      const lineData = {
        itemId: 'item-2',
        qtyPacked: 50,
        containerType: 'pallet',
        containerLabel: 'P-001',
        weight: 120.0,
        volume: 2.5,
      };

      const mockLine = {
        id: 'line-2',
        ...lineData,
        packingSessionId: 'session-1',
        item: { id: 'item-2', itemCode: 'ITM-002', itemDescription: 'Item Two' },
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingLine.create.mockResolvedValue(mockLine);
      (mockPrisma as any).packingSession.update.mockResolvedValue({ ...mockSession, palletCount: 2 });

      const result = await addPackingLine('session-1', lineData);

      expect((mockPrisma as any).packingSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { palletCount: { increment: 1 } },
      });
      expect(result).toEqual(mockLine);
    });

    it('should add line without incrementing counts for other container types', async () => {
      const lineData = {
        itemId: 'item-3',
        qtyPacked: 5,
        containerType: 'box',
        containerLabel: 'B-001',
      };

      const mockLine = {
        id: 'line-3',
        ...lineData,
        packingSessionId: 'session-1',
        item: { id: 'item-3', itemCode: 'ITM-003', itemDescription: 'Item Three' },
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingLine.create.mockResolvedValue(mockLine);

      const result = await addPackingLine('session-1', lineData);

      expect((mockPrisma as any).packingSession.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockLine);
    });

    it('should add line with minimal data (optional fields omitted)', async () => {
      const lineData = {
        itemId: 'item-4',
        qtyPacked: 3,
        containerType: 'carton',
      };

      const mockLine = {
        id: 'line-4',
        ...lineData,
        packingSessionId: 'session-1',
        containerLabel: undefined,
        weight: undefined,
        volume: undefined,
        scannedBarcode: undefined,
        item: { id: 'item-4', itemCode: 'ITM-004', itemDescription: 'Item Four' },
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingLine.create.mockResolvedValue(mockLine);
      (mockPrisma as any).packingSession.update.mockResolvedValue(mockSession);

      const result = await addPackingLine('session-1', lineData);

      expect(result).toEqual(mockLine);
    });

    it('should throw NotFoundError when session does not exist', async () => {
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(null);

      const lineData = { itemId: 'item-1', qtyPacked: 10, containerType: 'carton' };

      await expect(addPackingLine('invalid-id', lineData)).rejects.toThrow(NotFoundError);
      await expect(addPackingLine('invalid-id', lineData)).rejects.toThrow('Packing session not found');
    });

    it('should throw BusinessRuleError when session is not in_progress', async () => {
      const completedSession = { id: 'session-1', status: 'completed' };
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(completedSession);

      const lineData = { itemId: 'item-1', qtyPacked: 10, containerType: 'carton' };

      await expect(addPackingLine('session-1', lineData)).rejects.toThrow(BusinessRuleError);
      await expect(addPackingLine('session-1', lineData)).rejects.toThrow('Cannot add lines to a non-active session');
    });

    it('should throw BusinessRuleError when session is cancelled', async () => {
      const cancelledSession = { id: 'session-1', status: 'cancelled' };
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(cancelledSession);

      const lineData = { itemId: 'item-1', qtyPacked: 10, containerType: 'carton' };

      await expect(addPackingLine('session-1', lineData)).rejects.toThrow(BusinessRuleError);
      await expect(addPackingLine('session-1', lineData)).rejects.toThrow('Cannot add lines to a non-active session');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // completeSession
  // ────────────────────────────────────────────────────────────────────────────────
  describe('completeSession', () => {
    it('should complete session and calculate total weight and volume', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress',
        lines: [
          { id: 'line-1', weight: 5.5, volume: 0.2 },
          { id: 'line-2', weight: 10.0, volume: 0.5 },
          { id: 'line-3', weight: 3.2, volume: 0.1 },
        ],
      };

      const updatedSession = {
        ...mockSession,
        status: 'completed',
        completedAt: new Date(),
        totalWeight: 18.7,
        totalVolume: 0.8,
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingSession.update.mockResolvedValue(updatedSession);

      const result = await completeSession('session-1');

      const updateCall = (mockPrisma as any).packingSession.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'session-1' });
      expect(updateCall.data.status).toBe('completed');
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.totalWeight).toBeCloseTo(18.7, 1);
      expect(updateCall.data.totalVolume).toBeCloseTo(0.8, 1);
      expect(updateCall.include).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.totalWeight).toBe(18.7);
      expect(result.totalVolume).toBe(0.8);
    });

    it('should handle null weight and volume values in calculation', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress',
        lines: [
          { id: 'line-1', weight: 5.5, volume: null },
          { id: 'line-2', weight: null, volume: 0.5 },
          { id: 'line-3', weight: 3.2, volume: 0.1 },
        ],
      };

      const updatedSession = { ...mockSession, status: 'completed', totalWeight: 8.7, totalVolume: 0.6 };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingSession.update.mockResolvedValue(updatedSession);

      await completeSession('session-1');

      expect((mockPrisma as any).packingSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalWeight: 8.7,
            totalVolume: 0.6,
          }),
        }),
      );
    });

    it('should calculate zero totals when all weights and volumes are null', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress',
        lines: [
          { id: 'line-1', weight: null, volume: null },
          { id: 'line-2', weight: null, volume: null },
        ],
      };

      const updatedSession = { ...mockSession, status: 'completed', totalWeight: 0, totalVolume: 0 };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingSession.update.mockResolvedValue(updatedSession);

      await completeSession('session-1');

      expect((mockPrisma as any).packingSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalWeight: 0,
            totalVolume: 0,
          }),
        }),
      );
    });

    it('should throw NotFoundError when session does not exist', async () => {
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(null);

      await expect(completeSession('invalid-id')).rejects.toThrow(NotFoundError);
      await expect(completeSession('invalid-id')).rejects.toThrow('Packing session not found');
    });

    it('should throw BusinessRuleError when session is not in_progress', async () => {
      const completedSession = {
        id: 'session-1',
        status: 'completed',
        lines: [{ id: 'line-1' }],
      };
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(completedSession);

      await expect(completeSession('session-1')).rejects.toThrow(BusinessRuleError);
      await expect(completeSession('session-1')).rejects.toThrow('Only in-progress sessions can be completed');
    });

    it('should throw BusinessRuleError when session has no lines', async () => {
      const emptySession = {
        id: 'session-1',
        status: 'in_progress',
        lines: [],
      };
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(emptySession);

      await expect(completeSession('session-1')).rejects.toThrow(BusinessRuleError);
      await expect(completeSession('session-1')).rejects.toThrow('Cannot complete a session with no packed lines');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // getSessionById
  // ────────────────────────────────────────────────────────────────────────────────
  describe('getSessionById', () => {
    it('should return session with full includes', async () => {
      const mockSession = {
        id: 'session-1',
        sessionNumber: 'PACK-2026-0001',
        status: 'in_progress',
        mirv: {
          id: 'mirv-1',
          mirvNumber: 'MI-2026-0001',
          project: { id: 'proj-1', projectName: 'Project A', projectCode: 'PA' },
        },
        warehouse: { id: 'warehouse-1', warehouseName: 'Main Warehouse', warehouseCode: 'MW' },
        packedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        lines: [
          {
            id: 'line-1',
            qtyPacked: 10,
            containerType: 'carton',
            item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Item One' },
          },
        ],
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);

      const result = await getSessionById('session-1');

      expect((mockPrisma as any).packingSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: expect.objectContaining({
          mirv: expect.any(Object),
          warehouse: expect.any(Object),
          packedBy: expect.any(Object),
          lines: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockSession);
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundError when session does not exist', async () => {
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(null);

      await expect(getSessionById('invalid-id')).rejects.toThrow(NotFoundError);
      await expect(getSessionById('invalid-id')).rejects.toThrow('Packing session not found');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // cancelSession
  // ────────────────────────────────────────────────────────────────────────────────
  describe('cancelSession', () => {
    it('should cancel an in_progress session', async () => {
      const mockSession = {
        id: 'session-1',
        status: 'in_progress',
        sessionNumber: 'PACK-2026-0001',
      };

      const cancelledSession = {
        ...mockSession,
        status: 'cancelled',
      };

      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(mockSession);
      (mockPrisma as any).packingSession.update.mockResolvedValue(cancelledSession);

      const result = await cancelSession('session-1');

      expect((mockPrisma as any).packingSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { status: 'cancelled' },
        include: expect.any(Object),
      });
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundError when session does not exist', async () => {
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(null);

      await expect(cancelSession('invalid-id')).rejects.toThrow(NotFoundError);
      await expect(cancelSession('invalid-id')).rejects.toThrow('Packing session not found');
    });

    it('should throw BusinessRuleError when session is already completed', async () => {
      const completedSession = {
        id: 'session-1',
        status: 'completed',
      };
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(completedSession);

      await expect(cancelSession('session-1')).rejects.toThrow(BusinessRuleError);
      await expect(cancelSession('session-1')).rejects.toThrow('Only in-progress sessions can be cancelled');
    });

    it('should throw BusinessRuleError when session is already cancelled', async () => {
      const cancelledSession = {
        id: 'session-1',
        status: 'cancelled',
      };
      (mockPrisma as any).packingSession.findUnique.mockResolvedValue(cancelledSession);

      await expect(cancelSession('session-1')).rejects.toThrow(BusinessRuleError);
      await expect(cancelSession('session-1')).rejects.toThrow('Only in-progress sessions can be cancelled');
    });
  });
});
