import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
const { mockLog } = vi.hoisted(() => ({ mockLog: vi.fn() }));
const { mockOptimizePickPath } = vi.hoisted(() => ({
  mockOptimizePickPath: vi.fn().mockResolvedValue({
    stops: [],
    totalDistance: 0,
    estimatedMinutes: 0,
  }),
}));

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: mockLog }));
vi.mock('./pick-optimizer.service.js', () => ({
  optimizePickPath: mockOptimizePickPath,
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { createWave, getWave, getWavePickList, getWaves, startPicking, completeWave } from './wave-picking.service.js';
import type { Wave } from './wave-picking.service.js';

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

describe('wave-picking.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).mirvLine = createModelMock();
  });

  // ─── createWave ─────────────────────────────────────────────────────────

  describe('createWave', () => {
    it('throws error when miIds is empty', async () => {
      await expect(createWave('wh-1', [])).rejects.toThrow('At least one MI is required to create a wave');
    });

    it('throws error when no approved MIs found', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([]);

      await expect(createWave('wh-1', ['mi-1'])).rejects.toThrow('No approved MIs found for the specified warehouse');
    });

    it('logs warning when some MI IDs are not found', async () => {
      const miIds = ['mi-1', 'mi-2', 'mi-invalid'];
      mockPrisma.mirv.findMany.mockResolvedValue([
        { id: 'mi-1', mirvNumber: 'MI-001' },
        { id: 'mi-2', mirvNumber: 'MI-002' },
      ]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      await createWave('wh-1', miIds);

      expect(mockLog).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Some MI IDs not found or not eligible: mi-invalid'),
      );
    });

    it('throws error when no outstanding items to pick', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 100 }]),
      };

      await expect(createWave('wh-1', ['mi-1'])).rejects.toThrow('No outstanding items to pick from the selected MIs');
    });

    it('creates wave successfully with single MI', async () => {
      const warehouseId = 'wh-create-1';
      const miIds = ['mi-1'];

      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([
          { itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 },
          { itemId: 'item-2', qtyRequested: 50, qtyIssued: 10 },
        ]),
      };
      mockOptimizePickPath.mockResolvedValue({
        stops: [{ itemId: 'item-1', quantity: 100, stopOrder: 1 }],
        totalDistance: 150,
        estimatedMinutes: 15,
      });

      const wave = await createWave(warehouseId, miIds);

      expect(wave.warehouseId).toBe(warehouseId);
      expect(wave.miIds).toEqual(['mi-1']);
      expect(wave.status).toBe('created');
      expect(wave.itemCount).toBe(2);
      expect(wave.totalQuantity).toBe(140); // 100 + (50-10)
      expect(wave.pickPath).toBeDefined();
      expect(wave.createdAt).toBeInstanceOf(Date);
      expect(wave.completedAt).toBeUndefined();
      expect(mockOptimizePickPath).toHaveBeenCalledWith(
        warehouseId,
        expect.arrayContaining([
          { itemId: 'item-1', quantity: 100 },
          { itemId: 'item-2', quantity: 40 },
        ]),
      );
      expect(mockLog).toHaveBeenCalledWith('info', expect.stringContaining('Created wave'));
    });

    it('creates wave with multiple MIs and aggregates items', async () => {
      const warehouseId = 'wh-create-2';
      const miIds = ['mi-1', 'mi-2'];

      mockPrisma.mirv.findMany.mockResolvedValue([
        { id: 'mi-1', mirvNumber: 'MI-001' },
        { id: 'mi-2', mirvNumber: 'MI-002' },
      ]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([
          { itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 },
          { itemId: 'item-2', qtyRequested: 50, qtyIssued: 0 },
          { itemId: 'item-1', qtyRequested: 75, qtyIssued: 25 }, // Same item from different MI
        ]),
      };

      const wave = await createWave(warehouseId, miIds);

      expect(wave.miIds).toEqual(['mi-1', 'mi-2']);
      expect(wave.itemCount).toBe(2); // item-1 and item-2 aggregated
      expect(wave.totalQuantity).toBe(200); // 100 + 50 + (75-25)
    });

    it('only queries MIs with approved or partially_issued status', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      await createWave('wh-1', ['mi-1']);

      expect(mockPrisma.mirv.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['mi-1'] },
          warehouseId: 'wh-1',
          status: { in: ['approved', 'partially_issued'] },
        },
        select: { id: true, mirvNumber: true },
      });
    });

    it('skips line items with no remaining quantity', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([
          { itemId: 'item-1', qtyRequested: 100, qtyIssued: 100 }, // Fully issued
          { itemId: 'item-2', qtyRequested: 50, qtyIssued: 0 }, // Outstanding
        ]),
      };

      const wave = await createWave('wh-1', ['mi-1']);

      expect(wave.itemCount).toBe(1); // Only item-2
      expect(wave.totalQuantity).toBe(50);
    });
  });

  // ─── getWave ────────────────────────────────────────────────────────────

  describe('getWave', () => {
    it('returns wave when it exists', async () => {
      // First create a wave
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const created = await createWave('wh-get-1', ['mi-1']);
      const retrieved = getWave(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.warehouseId).toBe('wh-get-1');
    });

    it('returns undefined when wave does not exist', () => {
      const result = getWave('non-existent-wave-id');
      expect(result).toBeUndefined();
    });
  });

  // ─── getWavePickList ────────────────────────────────────────────────────

  describe('getWavePickList', () => {
    it('throws error when wave not found', async () => {
      await expect(getWavePickList('non-existent')).rejects.toThrow('Wave non-existent not found');
    });

    it('returns existing pickPath when available', async () => {
      const mockPickPath = {
        stops: [{ itemId: 'item-1', quantity: 100, stopOrder: 1 }],
        totalDistance: 150,
        estimatedMinutes: 15,
      };

      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };
      mockOptimizePickPath.mockResolvedValue(mockPickPath);

      const wave = await createWave('wh-picklist-1', ['mi-1']);
      const pickList = await getWavePickList(wave.id);

      expect(pickList).toEqual(mockPickPath);
      // Should not call optimizePickPath again since pickPath already exists
      expect(mockOptimizePickPath).toHaveBeenCalledTimes(1);
    });

    it('regenerates pickPath when missing', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }])
          .mockResolvedValueOnce([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-picklist-2', ['mi-1']);

      // Manually clear pickPath to simulate missing path
      const retrievedWave = getWave(wave.id);
      if (retrievedWave) {
        delete retrievedWave.pickPath;
      }

      const regeneratedPickPath = {
        stops: [{ itemId: 'item-1', quantity: 100, stopOrder: 1 }],
        totalDistance: 200,
        estimatedMinutes: 20,
      };
      mockOptimizePickPath.mockResolvedValueOnce(regeneratedPickPath);

      const pickList = await getWavePickList(wave.id);

      expect(pickList).toEqual(regeneratedPickPath);
      expect(mockOptimizePickPath).toHaveBeenCalledTimes(2); // Once for create, once for regenerate
    });

    it('aggregates items correctly when regenerating', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }])
          .mockResolvedValueOnce([
            { itemId: 'item-1', qtyRequested: 100, qtyIssued: 20 },
            { itemId: 'item-2', qtyRequested: 50, qtyIssued: 0 },
          ]),
      };

      const wave = await createWave('wh-picklist-3', ['mi-1']);

      // Clear pickPath
      const retrievedWave = getWave(wave.id);
      if (retrievedWave) {
        delete retrievedWave.pickPath;
      }

      await getWavePickList(wave.id);

      expect(mockOptimizePickPath).toHaveBeenLastCalledWith(
        'wh-picklist-3',
        expect.arrayContaining([
          { itemId: 'item-1', quantity: 80 },
          { itemId: 'item-2', quantity: 50 },
        ]),
      );
    });
  });

  // ─── getWaves ───────────────────────────────────────────────────────────

  describe('getWaves', () => {
    beforeEach(async () => {
      // Create test waves
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };
    });

    it('returns all waves when no filters provided', async () => {
      const wave1 = await createWave('wh-list-1', ['mi-1']);
      const wave2 = await createWave('wh-list-2', ['mi-1']);

      const allWaves = getWaves();

      expect(allWaves.length).toBeGreaterThanOrEqual(2);
      expect(allWaves.some(w => w.id === wave1.id)).toBe(true);
      expect(allWaves.some(w => w.id === wave2.id)).toBe(true);
    });

    it('filters waves by warehouseId', async () => {
      const wave1 = await createWave('wh-filter-1', ['mi-1']);
      await createWave('wh-filter-2', ['mi-1']);

      const filtered = getWaves('wh-filter-1');

      expect(filtered.every(w => w.warehouseId === 'wh-filter-1')).toBe(true);
      expect(filtered.some(w => w.id === wave1.id)).toBe(true);
    });

    it('filters waves by status', async () => {
      const wave1 = await createWave('wh-status-1', ['mi-1']);
      const wave2 = await createWave('wh-status-2', ['mi-1']);
      startPicking(wave1.id);

      const createdWaves = getWaves(undefined, 'created');
      const pickingWaves = getWaves(undefined, 'picking');

      expect(createdWaves.some(w => w.id === wave2.id)).toBe(true);
      expect(createdWaves.some(w => w.id === wave1.id)).toBe(false);
      expect(pickingWaves.some(w => w.id === wave1.id)).toBe(true);
    });

    it('filters waves by both warehouseId and status', async () => {
      const wave1 = await createWave('wh-both-1', ['mi-1']);
      const wave2 = await createWave('wh-both-1', ['mi-1']);
      await createWave('wh-both-2', ['mi-1']);
      startPicking(wave2.id);

      const filtered = getWaves('wh-both-1', 'created');

      expect(filtered.every(w => w.warehouseId === 'wh-both-1')).toBe(true);
      expect(filtered.every(w => w.status === 'created')).toBe(true);
      expect(filtered.some(w => w.id === wave1.id)).toBe(true);
      expect(filtered.some(w => w.id === wave2.id)).toBe(false);
    });

    it('returns waves sorted by createdAt descending (newest first)', async () => {
      const wave1 = await createWave('wh-sort-1', ['mi-1']);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const wave2 = await createWave('wh-sort-1', ['mi-1']);

      const waves = getWaves('wh-sort-1');

      const wave1Index = waves.findIndex(w => w.id === wave1.id);
      const wave2Index = waves.findIndex(w => w.id === wave2.id);

      if (wave1Index !== -1 && wave2Index !== -1) {
        expect(wave2Index).toBeLessThan(wave1Index); // Newer wave should come first
      }
    });

    it('returns empty array when no waves match filters', () => {
      const filtered = getWaves('non-existent-warehouse');
      expect(filtered).toEqual([]);
    });
  });

  // ─── startPicking ───────────────────────────────────────────────────────

  describe('startPicking', () => {
    it('throws error when wave not found', () => {
      expect(() => startPicking('non-existent')).toThrow('Wave non-existent not found');
    });

    it('throws error when wave is not in created status', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-start-1', ['mi-1']);
      startPicking(wave.id);

      expect(() => startPicking(wave.id)).toThrow('Can only start picking on a created wave');
    });

    it('transitions wave from created to picking', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-start-2', ['mi-1']);
      const updated = startPicking(wave.id);

      expect(updated.status).toBe('picking');
      expect(updated.id).toBe(wave.id);
      expect(mockLog).toHaveBeenCalledWith('info', expect.stringContaining('started picking'));
    });
  });

  // ─── completeWave ───────────────────────────────────────────────────────

  describe('completeWave', () => {
    it('throws error when wave not found', () => {
      expect(() => completeWave('non-existent')).toThrow('Wave non-existent not found');
    });

    it('throws error when wave already completed', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-complete-1', ['mi-1']);
      completeWave(wave.id);

      expect(() => completeWave(wave.id)).toThrow('Wave already completed');
    });

    it('completes wave from created status', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-complete-2', ['mi-1']);
      const completed = completeWave(wave.id);

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(mockLog).toHaveBeenCalledWith('info', expect.stringContaining('completed'));
    });

    it('completes wave from picking status', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-complete-3', ['mi-1']);
      startPicking(wave.id);
      const completed = completeWave(wave.id);

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('sets completedAt timestamp', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([{ id: 'mi-1', mirvNumber: 'MI-001' }]);
      (mockPrisma as Record<string, unknown>).mirvLine = {
        findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', qtyRequested: 100, qtyIssued: 0 }]),
      };

      const wave = await createWave('wh-complete-4', ['mi-1']);
      const beforeComplete = new Date();
      const completed = completeWave(wave.id);
      const afterComplete = new Date();

      expect(completed.completedAt).toBeDefined();
      expect(completed.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
      expect(completed.completedAt!.getTime()).toBeLessThanOrEqual(afterComplete.getTime());
    });
  });
});
