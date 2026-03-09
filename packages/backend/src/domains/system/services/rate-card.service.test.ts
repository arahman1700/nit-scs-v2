import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock & { supplierEquipmentRate: any },
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('@nit-scs-v2/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string, id?: string) {
      super(`${entity}${id ? ` ${id}` : ''} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { list, getById, create, update, getActiveRateForEquipment } from './rate-card.service.js';

function createModelMock() {
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

describe('rate-card.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as any).supplierEquipmentRate = createModelMock();
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    const baseParams = {
      skip: 0,
      pageSize: 10,
      sortBy: 'createdAt',
      sortDir: 'desc' as const,
      search: undefined,
      status: undefined,
      supplierId: undefined,
      equipmentTypeId: undefined,
    };

    it('should return data and total from parallel queries', async () => {
      const rateCards = [{ id: 'rc-1' }];
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue(rateCards);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rateCards, total: 1 });
    });

    it('should apply search across supplier name, equipment type, capacity, notes', async () => {
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue([]);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'crane' });

      const callArgs = mockPrisma.supplierEquipmentRate.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { supplier: { supplierName: { contains: 'crane', mode: 'insensitive' } } },
        { equipmentType: { typeName: { contains: 'crane', mode: 'insensitive' } } },
        { capacity: { contains: 'crane', mode: 'insensitive' } },
        { notes: { contains: 'crane', mode: 'insensitive' } },
      ]);
    });

    it('should filter by status when provided', async () => {
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue([]);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'active' });

      const callArgs = mockPrisma.supplierEquipmentRate.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('active');
    });

    it('should filter by supplierId when provided', async () => {
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue([]);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(0);

      await list({ ...baseParams, supplierId: 'sup-1' });

      const callArgs = mockPrisma.supplierEquipmentRate.findMany.mock.calls[0][0];
      expect(callArgs.where.supplierId).toBe('sup-1');
    });

    it('should filter by equipmentTypeId when provided', async () => {
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue([]);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(0);

      await list({ ...baseParams, equipmentTypeId: 'et-1' });

      const callArgs = mockPrisma.supplierEquipmentRate.findMany.mock.calls[0][0];
      expect(callArgs.where.equipmentTypeId).toBe('et-1');
    });

    it('should apply sort and pagination', async () => {
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue([]);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 10, pageSize: 5, sortBy: 'dailyRate', sortDir: 'asc' });

      const callArgs = mockPrisma.supplierEquipmentRate.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ dailyRate: 'asc' });
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(5);
    });

    it('should include supplier and equipmentType in list results', async () => {
      mockPrisma.supplierEquipmentRate.findMany.mockResolvedValue([]);
      mockPrisma.supplierEquipmentRate.count.mockResolvedValue(0);

      await list(baseParams);

      const callArgs = mockPrisma.supplierEquipmentRate.findMany.mock.calls[0][0];
      expect(callArgs.include).toEqual({
        supplier: { select: { id: true, supplierName: true, supplierCode: true } },
        equipmentType: { select: { id: true, typeName: true } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------
  describe('getById', () => {
    it('should return rate card when found', async () => {
      const rateCard = { id: 'rc-1', dailyRate: 100 };
      mockPrisma.supplierEquipmentRate.findUnique.mockResolvedValue(rateCard);

      const result = await getById('rc-1');

      expect(result).toEqual(rateCard);
      expect(mockPrisma.supplierEquipmentRate.findUnique).toHaveBeenCalledWith({
        where: { id: 'rc-1' },
        include: expect.objectContaining({
          supplier: expect.any(Object),
          equipmentType: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundError when rate card not found', async () => {
      mockPrisma.supplierEquipmentRate.findUnique.mockResolvedValue(null);

      await expect(getById('missing')).rejects.toThrow('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should create a rate card with correct data', async () => {
      const body = {
        supplierId: 'sup-1',
        equipmentTypeId: 'et-1',
        capacity: '10T',
        dailyRate: 500,
        weeklyRate: 3000,
        monthlyRate: 10000,
        withOperatorSurcharge: 200,
        operatorIncluded: true,
        fuelIncluded: false,
        insuranceIncluded: true,
        validFrom: '2024-01-01',
        validUntil: '2024-12-31',
        status: 'active',
        notes: 'Test rate',
      };
      const created = { id: 'rc-new', ...body };
      mockPrisma.supplierEquipmentRate.create.mockResolvedValue(created);

      const result = await create(body, 'user-1');

      expect(result).toEqual(created);
      expect(mockPrisma.supplierEquipmentRate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          supplier: { connect: { id: 'sup-1' } },
          equipmentType: { connect: { id: 'et-1' } },
          capacity: '10T',
          dailyRate: 500,
          operatorIncluded: true,
          fuelIncluded: false,
          validFrom: expect.any(Date),
          validUntil: expect.any(Date),
          status: 'active',
        }),
        include: expect.any(Object),
      });
    });

    it('should handle optional fields defaulting to null/false', async () => {
      const body = {
        supplierId: 'sup-1',
        equipmentTypeId: 'et-1',
        validFrom: '2024-01-01',
      };
      mockPrisma.supplierEquipmentRate.create.mockResolvedValue({ id: 'rc-new' });

      await create(body as any, 'user-1');

      const callArgs = mockPrisma.supplierEquipmentRate.create.mock.calls[0][0];
      expect(callArgs.data.capacity).toBeNull();
      expect(callArgs.data.dailyRate).toBeNull();
      expect(callArgs.data.operatorIncluded).toBe(false);
      expect(callArgs.data.fuelIncluded).toBe(false);
      expect(callArgs.data.insuranceIncluded).toBe(false);
      expect(callArgs.data.validUntil).toBeNull();
      expect(callArgs.data.status).toBe('active');
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update rate card when it exists', async () => {
      const existing = { id: 'rc-1', dailyRate: 500 };
      const updated = { id: 'rc-1', dailyRate: 600 };
      mockPrisma.supplierEquipmentRate.findUnique.mockResolvedValue(existing);
      mockPrisma.supplierEquipmentRate.update.mockResolvedValue(updated);

      const result = await update('rc-1', { dailyRate: 600 } as any);

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when rate card not found on update', async () => {
      mockPrisma.supplierEquipmentRate.findUnique.mockResolvedValue(null);

      await expect(update('missing', {} as any)).rejects.toThrow('not found');
    });

    it('should convert date strings for validFrom and validUntil', async () => {
      mockPrisma.supplierEquipmentRate.findUnique.mockResolvedValue({ id: 'rc-1' });
      mockPrisma.supplierEquipmentRate.update.mockResolvedValue({ id: 'rc-1' });

      await update('rc-1', { validFrom: '2025-01-01', validUntil: '2025-12-31' } as any);

      const callArgs = mockPrisma.supplierEquipmentRate.update.mock.calls[0][0];
      expect(callArgs.data.validFrom).toBeInstanceOf(Date);
      expect(callArgs.data.validUntil).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveRateForEquipment
  // ---------------------------------------------------------------------------
  describe('getActiveRateForEquipment', () => {
    it('should return active rate card matching supplier and equipment type', async () => {
      const rateCard = { id: 'rc-1', dailyRate: 400 };
      mockPrisma.supplierEquipmentRate.findFirst.mockResolvedValue(rateCard);

      const result = await getActiveRateForEquipment('sup-1', 'et-1');

      expect(result).toEqual(rateCard);
      expect(mockPrisma.supplierEquipmentRate.findFirst).toHaveBeenCalledWith({
        where: {
          supplierId: 'sup-1',
          equipmentTypeId: 'et-1',
          status: 'active',
          validFrom: { lte: expect.any(Date) },
          OR: [{ validUntil: null }, { validUntil: { gte: expect.any(Date) } }],
        },
        orderBy: { validFrom: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return null when no matching rate card found', async () => {
      mockPrisma.supplierEquipmentRate.findFirst.mockResolvedValue(null);

      const result = await getActiveRateForEquipment('sup-x', 'et-x');

      expect(result).toBeNull();
    });
  });
});
