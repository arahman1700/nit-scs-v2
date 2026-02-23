import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { parseBinLocation, manhattanDistance, optimizePickPath } from './pick-optimizer.service.js';

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

describe('pick-optimizer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).binCard = createModelMock();
  });

  // ─── parseBinLocation ─────────────────────────────────────────────

  describe('parseBinLocation', () => {
    it('parses "A-03-12" correctly', () => {
      expect(parseBinLocation('A-03-12')).toEqual({ zone: 'A', aisle: 3, shelf: 12 });
    });

    it('parses "B-01-01" correctly', () => {
      expect(parseBinLocation('B-01-01')).toEqual({ zone: 'B', aisle: 1, shelf: 1 });
    });

    it('handles short bin numbers gracefully', () => {
      const result = parseBinLocation('A');
      expect(result.zone).toBe('A');
      expect(result.aisle).toBe(0);
      expect(result.shelf).toBe(0);
    });

    it('handles non-numeric parts', () => {
      const result = parseBinLocation('C-XX-YY');
      expect(result.zone).toBe('C');
      expect(result.aisle).toBe(0); // parseInt('XX') = NaN → 0
      expect(result.shelf).toBe(0);
    });
  });

  // ─── manhattanDistance ─────────────────────────────────────────────

  describe('manhattanDistance', () => {
    it('returns 0 for same location', () => {
      const loc = { zone: 'A', aisle: 1, shelf: 1 };
      expect(manhattanDistance(loc, loc)).toBe(0);
    });

    it('calculates distance within same zone', () => {
      const a = { zone: 'A', aisle: 1, shelf: 1 };
      const b = { zone: 'A', aisle: 3, shelf: 5 };
      expect(manhattanDistance(a, b)).toBe(6); // |1-3| + |1-5| = 6
    });

    it('includes zone distance (10 units per zone letter)', () => {
      const a = { zone: 'A', aisle: 0, shelf: 0 };
      const b = { zone: 'C', aisle: 0, shelf: 0 };
      expect(manhattanDistance(a, b)).toBe(20); // |0-20| = 20
    });

    it('combines zone + aisle + shelf distances', () => {
      const a = { zone: 'A', aisle: 1, shelf: 2 };
      const b = { zone: 'B', aisle: 3, shelf: 5 };
      // zone: |0-10|=10, aisle: |1-3|=2, shelf: |2-5|=3 → 15
      expect(manhattanDistance(a, b)).toBe(15);
    });
  });

  // ─── optimizePickPath ─────────────────────────────────────────────

  describe('optimizePickPath', () => {
    const binCardMock = () => (mockPrisma as Record<string, PrismaModelMock>).binCard;

    it('returns empty path for empty items', async () => {
      const result = await optimizePickPath('wh-1', []);
      expect(result.stops).toEqual([]);
      expect(result.totalDistance).toBe(0);
      expect(result.estimatedMinutes).toBe(0);
    });

    it('produces a single-stop path for one item', async () => {
      binCardMock().findMany.mockResolvedValue([
        {
          itemId: 'i1',
          binNumber: 'A-01-02',
          currentQty: 100,
          warehouseId: 'wh-1',
          item: { id: 'i1', itemCode: 'IT-001', itemDescription: 'Steel Rod' },
        },
      ]);

      const result = await optimizePickPath('wh-1', [{ itemId: 'i1', quantity: 5 }]);

      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].itemCode).toBe('IT-001');
      expect(result.stops[0].binNumber).toBe('A-01-02');
      expect(result.stops[0].quantity).toBe(5);
      expect(result.stops[0].stopOrder).toBe(1);
    });

    it('optimizes order using nearest-neighbor', async () => {
      // Item in zone C (far) and item in zone A (near) — should pick A first
      binCardMock().findMany.mockResolvedValue([
        {
          itemId: 'i1',
          binNumber: 'C-05-05',
          currentQty: 50,
          warehouseId: 'wh-1',
          item: { id: 'i1', itemCode: 'FAR', itemDescription: 'Far Item' },
        },
        {
          itemId: 'i2',
          binNumber: 'A-01-01',
          currentQty: 50,
          warehouseId: 'wh-1',
          item: { id: 'i2', itemCode: 'NEAR', itemDescription: 'Near Item' },
        },
      ]);

      const result = await optimizePickPath('wh-1', [
        { itemId: 'i1', quantity: 3 },
        { itemId: 'i2', quantity: 7 },
      ]);

      expect(result.stops[0].itemCode).toBe('NEAR');
      expect(result.stops[1].itemCode).toBe('FAR');
    });

    it('picks the bin with highest quantity for an item', async () => {
      binCardMock().findMany.mockResolvedValue([
        {
          itemId: 'i1',
          binNumber: 'A-01-01',
          currentQty: 5,
          warehouseId: 'wh-1',
          item: { id: 'i1', itemCode: 'IT-001', itemDescription: 'Test' },
        },
        {
          itemId: 'i1',
          binNumber: 'B-02-03',
          currentQty: 100,
          warehouseId: 'wh-1',
          item: { id: 'i1', itemCode: 'IT-001', itemDescription: 'Test' },
        },
      ]);

      const result = await optimizePickPath('wh-1', [{ itemId: 'i1', quantity: 10 }]);
      expect(result.stops[0].binNumber).toBe('B-02-03');
    });

    it('handles items with no bin card (unknown location)', async () => {
      binCardMock().findMany.mockResolvedValue([]);

      const result = await optimizePickPath('wh-1', [{ itemId: 'i1', quantity: 5 }]);

      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].itemCode).toBe('UNKNOWN');
      expect(result.stops[0].binNumber).toBe('N/A');
    });

    it('calculates totalDistance and estimatedMinutes', async () => {
      binCardMock().findMany.mockResolvedValue([
        {
          itemId: 'i1',
          binNumber: 'A-02-03',
          currentQty: 50,
          warehouseId: 'wh-1',
          item: { id: 'i1', itemCode: 'X', itemDescription: 'X' },
        },
      ]);

      const result = await optimizePickPath('wh-1', [{ itemId: 'i1', quantity: 1 }]);

      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.estimatedMinutes).toBeGreaterThan(0);
      // estimatedMinutes = round(totalDistance * 0.5 + stops * 1.5)
      expect(result.estimatedMinutes).toBe(Math.round(result.totalDistance * 0.5 + 1 * 1.5));
    });

    it('assigns sequential stopOrder', async () => {
      binCardMock().findMany.mockResolvedValue([
        {
          itemId: 'i1',
          binNumber: 'A-01-01',
          currentQty: 50,
          warehouseId: 'wh-1',
          item: { id: 'i1', itemCode: 'A', itemDescription: 'A' },
        },
        {
          itemId: 'i2',
          binNumber: 'A-02-02',
          currentQty: 50,
          warehouseId: 'wh-1',
          item: { id: 'i2', itemCode: 'B', itemDescription: 'B' },
        },
        {
          itemId: 'i3',
          binNumber: 'A-03-03',
          currentQty: 50,
          warehouseId: 'wh-1',
          item: { id: 'i3', itemCode: 'C', itemDescription: 'C' },
        },
      ]);

      const result = await optimizePickPath('wh-1', [
        { itemId: 'i1', quantity: 1 },
        { itemId: 'i2', quantity: 1 },
        { itemId: 'i3', quantity: 1 },
      ]);

      expect(result.stops.map(s => s.stopOrder)).toEqual([1, 2, 3]);
    });
  });
});
