import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, remove } from './generator-fuel.service.js';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';

function makeFuelLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fuel-1',
    generatorId: 'gen-1',
    fuelDate: new Date('2025-06-01'),
    fuelQtyLiters: 100,
    meterReading: 5000,
    fuelSupplier: 'Supplier A',
    costPerLiter: 2.5,
    totalCost: 250,
    loggedById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const baseListParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 20 };

// ── setup ────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mockPrisma, createPrismaMock());
});

describe('generator-fuel.service', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('should return data and total', async () => {
      const rows = [makeFuelLog()];
      mockPrisma.generatorFuelLog.findMany.mockResolvedValue(rows);
      mockPrisma.generatorFuelLog.count.mockResolvedValue(1);

      const result = await list(baseListParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause on generator fields', async () => {
      mockPrisma.generatorFuelLog.findMany.mockResolvedValue([]);
      mockPrisma.generatorFuelLog.count.mockResolvedValue(0);

      await list({ ...baseListParams, search: 'GEN-001' });

      const where = mockPrisma.generatorFuelLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
      expect(where.OR[0]).toEqual({
        generator: { generatorCode: { contains: 'GEN-001', mode: 'insensitive' } },
      });
      expect(where.OR[1]).toEqual({
        generator: { generatorName: { contains: 'GEN-001', mode: 'insensitive' } },
      });
    });

    it('should apply generatorId filter', async () => {
      mockPrisma.generatorFuelLog.findMany.mockResolvedValue([]);
      mockPrisma.generatorFuelLog.count.mockResolvedValue(0);

      await list({ ...baseListParams, generatorId: 'gen-1' });

      const where = mockPrisma.generatorFuelLog.findMany.mock.calls[0][0].where;
      expect(where.generatorId).toBe('gen-1');
    });

    it('should apply date range filter with fromDate and toDate', async () => {
      mockPrisma.generatorFuelLog.findMany.mockResolvedValue([]);
      mockPrisma.generatorFuelLog.count.mockResolvedValue(0);

      await list({ ...baseListParams, fromDate: '2025-01-01', toDate: '2025-12-31' });

      const where = mockPrisma.generatorFuelLog.findMany.mock.calls[0][0].where;
      expect(where.fuelDate).toBeDefined();
      expect(where.fuelDate.gte).toEqual(new Date('2025-01-01'));
      expect(where.fuelDate.lte).toEqual(new Date('2025-12-31'));
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.generatorFuelLog.findMany.mockResolvedValue([]);
      mockPrisma.generatorFuelLog.count.mockResolvedValue(0);

      await list({ ...baseListParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.generatorFuelLog.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the fuel log when found', async () => {
      const fuelLog = makeFuelLog();
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(fuelLog);

      const result = await getById('fuel-1');

      expect(result).toEqual(fuelLog);
      expect(mockPrisma.generatorFuelLog.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fuel-1' } }),
      );
    });

    it('should throw NotFoundError when fuel log not found', async () => {
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const baseData = {
      generatorId: 'gen-1',
      fuelDate: '2025-06-01',
      fuelQtyLiters: 100,
      costPerLiter: 2.5,
    };

    it('should verify generator exists before creating', async () => {
      mockPrisma.generator.findUnique.mockResolvedValue({ id: 'gen-1' });
      mockPrisma.generatorFuelLog.create.mockResolvedValue(makeFuelLog());

      await create(baseData as any, USER_ID);

      expect(mockPrisma.generator.findUnique).toHaveBeenCalledWith({ where: { id: 'gen-1' } });
    });

    it('should calculate totalCost when both fuelQtyLiters and costPerLiter are provided', async () => {
      mockPrisma.generator.findUnique.mockResolvedValue({ id: 'gen-1' });
      mockPrisma.generatorFuelLog.create.mockResolvedValue(makeFuelLog());

      await create({ ...baseData, fuelQtyLiters: 50, costPerLiter: 3 } as any, USER_ID);

      const createArgs = mockPrisma.generatorFuelLog.create.mock.calls[0][0];
      expect(createArgs.data.totalCost).toBe(150);
      expect(createArgs.data.loggedById).toBe(USER_ID);
    });

    it('should use data.totalCost when fuelQtyLiters or costPerLiter is missing', async () => {
      mockPrisma.generator.findUnique.mockResolvedValue({ id: 'gen-1' });
      mockPrisma.generatorFuelLog.create.mockResolvedValue(makeFuelLog());

      await create(
        { generatorId: 'gen-1', fuelDate: '2025-06-01', fuelQtyLiters: 100, totalCost: 999 } as any,
        USER_ID,
      );

      const createArgs = mockPrisma.generatorFuelLog.create.mock.calls[0][0];
      expect(createArgs.data.totalCost).toBe(999);
    });

    it('should throw NotFoundError when generator does not exist', async () => {
      mockPrisma.generator.findUnique.mockResolvedValue(null);

      await expect(create(baseData as any, USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should return existing and updated when found', async () => {
      const existing = makeFuelLog();
      const updated = makeFuelLog({ fuelQtyLiters: 200 });
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(existing);
      mockPrisma.generatorFuelLog.update.mockResolvedValue(updated);

      const result = await update('fuel-1', { fuelQtyLiters: 200 });

      expect(result).toEqual({ existing, updated });
    });

    it('should coerce fuelDate to Date when provided', async () => {
      const existing = makeFuelLog();
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(existing);
      mockPrisma.generatorFuelLog.update.mockResolvedValue(existing);

      await update('fuel-1', { fuelDate: '2025-07-01' });

      const updateArgs = mockPrisma.generatorFuelLog.update.mock.calls[0][0];
      expect(updateArgs.data.fuelDate).toEqual(new Date('2025-07-01'));
    });

    it('should throw NotFoundError when fuel log not found', async () => {
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete and return existing when found', async () => {
      const existing = makeFuelLog();
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(existing);
      mockPrisma.generatorFuelLog.delete.mockResolvedValue(existing);

      const result = await remove('fuel-1');

      expect(result).toEqual(existing);
      expect(mockPrisma.generatorFuelLog.delete).toHaveBeenCalledWith({ where: { id: 'fuel-1' } });
    });

    it('should throw NotFoundError when fuel log not found', async () => {
      mockPrisma.generatorFuelLog.findUnique.mockResolvedValue(null);

      await expect(remove('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
