import type { PrismaMock } from '../test-utils/prisma-mock.js';

const MockJsonNull = vi.hoisted(() => Symbol('JsonNull'));

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('@prisma/client', () => ({
  Prisma: { JsonNull: MockJsonNull, InputJsonValue: null },
}));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { log } from '../config/logger.js';
import {
  listCustomDataSources,
  getCustomDataSource,
  createCustomDataSource,
  updateCustomDataSource,
  deleteCustomDataSource,
  executeCustomDataSource,
  loadCustomDataSources,
} from './custom-data-source.service.js';

describe('custom-data-source.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add findUniqueOrThrow since PrismaModelMock doesn't include it
    (mockPrisma.customDataSource as Record<string, unknown>).findUniqueOrThrow = vi.fn();
    // Clear log mock to prevent bleed between tests
    vi.mocked(log).mockClear();
  });

  // ---------------------------------------------------------------------------
  // listCustomDataSources
  // ---------------------------------------------------------------------------
  describe('listCustomDataSources', () => {
    it('returns all sources when no userId is provided', async () => {
      const sources = [
        { id: 's1', name: 'Source A' },
        { id: 's2', name: 'Source B' },
      ];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);

      const result = await listCustomDataSources();

      expect(mockPrisma.customDataSource.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(sources);
    });

    it('filters by OR (public or own) when userId is provided', async () => {
      const sources = [{ id: 's1', name: 'Public Source', isPublic: true }];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);

      const result = await listCustomDataSources('user-123');

      expect(mockPrisma.customDataSource.findMany).toHaveBeenCalledWith({
        where: { OR: [{ isPublic: true }, { createdById: 'user-123' }] },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(sources);
    });
  });

  // ---------------------------------------------------------------------------
  // getCustomDataSource
  // ---------------------------------------------------------------------------
  describe('getCustomDataSource', () => {
    it('delegates to findUniqueOrThrow with the correct id', async () => {
      const source = { id: 'src-1', name: 'Test Source' };
      const findUniqueOrThrow = (mockPrisma.customDataSource as Record<string, ReturnType<typeof vi.fn>>)
        .findUniqueOrThrow;
      findUniqueOrThrow.mockResolvedValue(source);

      const result = await getCustomDataSource('src-1');

      expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'src-1' } });
      expect(result).toEqual(source);
    });
  });

  // ---------------------------------------------------------------------------
  // createCustomDataSource
  // ---------------------------------------------------------------------------
  describe('createCustomDataSource', () => {
    it('creates with correct data mapping', async () => {
      const input = {
        name: 'GRN Count',
        sourceKey: 'grn_count',
        entityType: 'mrrv',
        aggregation: 'count' as const,
        queryTemplate: { entityType: 'mrrv', filters: [] },
        outputType: 'number' as const,
        isPublic: true,
        createdById: 'user-1',
      };
      const created = { id: 'new-1', ...input };
      mockPrisma.customDataSource.create.mockResolvedValue(created);

      const result = await createCustomDataSource(input);

      expect(mockPrisma.customDataSource.create).toHaveBeenCalledWith({
        data: {
          name: 'GRN Count',
          sourceKey: 'grn_count',
          entityType: 'mrrv',
          aggregation: 'count',
          queryTemplate: input.queryTemplate,
          outputType: 'number',
          isPublic: true,
          createdById: 'user-1',
        },
      });
      expect(result).toEqual(created);
    });

    it('defaults isPublic to false when not provided', async () => {
      const input = {
        name: 'Private Source',
        sourceKey: 'private_src',
        entityType: 'mirv',
        aggregation: 'count' as const,
        queryTemplate: { entityType: 'mirv' },
        outputType: 'number' as const,
        createdById: 'user-2',
      };
      mockPrisma.customDataSource.create.mockResolvedValue({ id: 'new-2', ...input, isPublic: false });

      await createCustomDataSource(input);

      expect(mockPrisma.customDataSource.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isPublic: false }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateCustomDataSource
  // ---------------------------------------------------------------------------
  describe('updateCustomDataSource', () => {
    it('only includes defined fields in the update data', async () => {
      const updated = { id: 'src-1', name: 'Updated Name' };
      mockPrisma.customDataSource.update.mockResolvedValue(updated);

      await updateCustomDataSource('src-1', { name: 'Updated Name' });

      expect(mockPrisma.customDataSource.update).toHaveBeenCalledWith({
        where: { id: 'src-1' },
        data: { name: 'Updated Name' },
      });
    });

    it('spreads all provided fields correctly', async () => {
      const template = { entityType: 'mrrv', filters: [] };
      mockPrisma.customDataSource.update.mockResolvedValue({});

      await updateCustomDataSource('src-1', {
        name: 'New Name',
        entityType: 'mirv',
        aggregation: 'sum',
        queryTemplate: template,
        outputType: 'grouped',
        isPublic: true,
      });

      expect(mockPrisma.customDataSource.update).toHaveBeenCalledWith({
        where: { id: 'src-1' },
        data: {
          name: 'New Name',
          entityType: 'mirv',
          aggregation: 'sum',
          queryTemplate: template,
          outputType: 'grouped',
          isPublic: true,
        },
      });
    });

    it('does not include undefined fields', async () => {
      mockPrisma.customDataSource.update.mockResolvedValue({});

      await updateCustomDataSource('src-1', { isPublic: false });

      const callArgs = mockPrisma.customDataSource.update.mock.calls[0][0];
      expect(callArgs.data).toEqual({ isPublic: false });
      expect(callArgs.data).not.toHaveProperty('name');
      expect(callArgs.data).not.toHaveProperty('entityType');
      expect(callArgs.data).not.toHaveProperty('aggregation');
      expect(callArgs.data).not.toHaveProperty('queryTemplate');
      expect(callArgs.data).not.toHaveProperty('outputType');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteCustomDataSource
  // ---------------------------------------------------------------------------
  describe('deleteCustomDataSource', () => {
    it('deletes by id', async () => {
      mockPrisma.customDataSource.delete.mockResolvedValue({ id: 'src-1' });

      const result = await deleteCustomDataSource('src-1');

      expect(mockPrisma.customDataSource.delete).toHaveBeenCalledWith({ where: { id: 'src-1' } });
      expect(result).toEqual({ id: 'src-1' });
    });
  });

  // ---------------------------------------------------------------------------
  // executeCustomDataSource
  // ---------------------------------------------------------------------------
  describe('executeCustomDataSource', () => {
    const baseSource = {
      entityType: 'mrrv',
      aggregation: 'count',
      queryTemplate: { entityType: 'mrrv' },
      outputType: 'number',
      name: 'GRN Count',
    };

    // -- count --
    it('count aggregation returns { type: "number", data, label }', async () => {
      mockPrisma.mrrv.count.mockResolvedValue(42);

      const result = await executeCustomDataSource(baseSource);

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ type: 'number', data: 42, label: 'GRN Count' });
    });

    // -- sum --
    it('sum aggregation calls aggregate with _sum', async () => {
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _sum: { totalValue: 1500 } });

      const result = await executeCustomDataSource({
        ...baseSource,
        aggregation: 'sum',
        queryTemplate: { entityType: 'mrrv', groupBy: 'totalValue' },
      });

      expect(mockPrisma.mrrv.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: { totalValue: true },
        _avg: undefined,
      });
      expect(result).toEqual({ type: 'number', data: 1500, label: 'GRN Count' });
    });

    it('sum aggregation defaults field to "id" when groupBy is not set', async () => {
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _sum: { id: 100 } });

      await executeCustomDataSource({
        ...baseSource,
        aggregation: 'sum',
      });

      expect(mockPrisma.mrrv.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: { id: true },
        _avg: undefined,
      });
    });

    it('sum returns 0 when aggregated value is null', async () => {
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _sum: { id: null } });

      const result = await executeCustomDataSource({
        ...baseSource,
        aggregation: 'sum',
      });

      expect(result).toEqual({ type: 'number', data: 0, label: 'GRN Count' });
    });

    // -- avg --
    it('avg aggregation calls aggregate with _avg', async () => {
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _avg: { totalValue: 75.5 } });

      const result = await executeCustomDataSource({
        ...baseSource,
        aggregation: 'avg',
        queryTemplate: { entityType: 'mrrv', groupBy: 'totalValue' },
      });

      expect(mockPrisma.mrrv.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: undefined,
        _avg: { totalValue: true },
      });
      expect(result).toEqual({ type: 'number', data: 75.5, label: 'GRN Count' });
    });

    // -- group_by --
    it('group_by aggregation calls groupBy and returns mapped results', async () => {
      mockPrisma.mrrv.groupBy.mockResolvedValue([
        { status: 'draft', _count: { id: 5 } },
        { status: 'approved', _count: { id: 10 } },
        { status: 'completed', _count: { id: 3 } },
      ]);

      const result = await executeCustomDataSource({
        ...baseSource,
        aggregation: 'group_by',
        queryTemplate: { entityType: 'mrrv', groupBy: 'status' },
      });

      expect(mockPrisma.mrrv.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {},
        _count: { id: true },
      });
      expect(result).toEqual({
        type: 'grouped',
        data: [
          { label: 'draft', value: 5 },
          { label: 'approved', value: 10 },
          { label: 'completed', value: 3 },
        ],
        label: 'GRN Count',
      });
    });

    it('group_by defaults groupField to "status" when groupBy is not set', async () => {
      mockPrisma.mrrv.groupBy.mockResolvedValue([]);

      await executeCustomDataSource({
        ...baseSource,
        aggregation: 'group_by',
      });

      expect(mockPrisma.mrrv.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {},
        _count: { id: true },
      });
    });

    // -- timeseries --
    it('timeseries aggregation calls findMany and groups by day', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        { createdAt: '2026-01-10T08:00:00Z', id: '1' },
        { createdAt: '2026-01-10T14:00:00Z', id: '2' },
        { createdAt: '2026-01-11T09:00:00Z', id: '3' },
      ]);

      const result = await executeCustomDataSource({
        ...baseSource,
        aggregation: 'timeseries',
        queryTemplate: { entityType: 'mrrv', dateField: 'createdAt' },
      });

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'asc' },
        take: 365,
        select: { createdAt: true, id: true },
      });
      expect(result).toEqual({
        type: 'timeseries',
        data: [
          { date: '2026-01-10', value: 2 },
          { date: '2026-01-11', value: 1 },
        ],
        label: 'GRN Count',
      });
    });

    it('timeseries defaults dateField to "createdAt" when not set', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);

      await executeCustomDataSource({
        ...baseSource,
        aggregation: 'timeseries',
      });

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'asc' },
        take: 365,
        select: { createdAt: true, id: true },
      });
    });

    it('timeseries uses custom dateField from template', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([{ receivedDate: '2026-02-01T00:00:00Z', id: '1' }]);

      const result = await executeCustomDataSource({
        ...baseSource,
        aggregation: 'timeseries',
        queryTemplate: { entityType: 'mrrv', dateField: 'receivedDate' },
      });

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { receivedDate: 'asc' },
        take: 365,
        select: { receivedDate: true, id: true },
      });
      expect(result).toEqual({
        type: 'timeseries',
        data: [{ date: '2026-02-01', value: 1 }],
        label: 'GRN Count',
      });
    });

    // -- unknown entity type --
    it('throws for unknown entity type', async () => {
      await expect(
        executeCustomDataSource({
          ...baseSource,
          entityType: 'nonexistent',
        }),
      ).rejects.toThrow('Unknown entity type: nonexistent');
    });

    it('includes available entity types in the error message', async () => {
      await expect(
        executeCustomDataSource({
          ...baseSource,
          entityType: 'bogus',
        }),
      ).rejects.toThrow(/Available: mrrv, mirv, mrv/);
    });

    // -- unknown aggregation --
    it('throws for unknown aggregation', async () => {
      await expect(
        executeCustomDataSource({
          ...baseSource,
          aggregation: 'median',
        }),
      ).rejects.toThrow('Unknown aggregation: median');
    });

    // -- filter operators --
    describe('filter operators', () => {
      it('applies eq filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(5);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'status', op: 'eq', value: 'approved' }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { status: 'approved' },
        });
      });

      it('applies ne filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(10);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'status', op: 'ne', value: 'cancelled' }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { status: { not: 'cancelled' } },
        });
      });

      it('applies gt filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(3);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'totalValue', op: 'gt', value: 100 }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { totalValue: { gt: 100 } },
        });
      });

      it('applies gte filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(7);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'totalValue', op: 'gte', value: 50 }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { totalValue: { gte: 50 } },
        });
      });

      it('applies lt filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(2);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'totalValue', op: 'lt', value: 10 }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { totalValue: { lt: 10 } },
        });
      });

      it('applies lte filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(4);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'totalValue', op: 'lte', value: 200 }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { totalValue: { lte: 200 } },
        });
      });

      it('applies in filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(6);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'status', op: 'in', value: ['draft', 'approved'] }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { status: { in: ['draft', 'approved'] } },
        });
      });

      it('applies contains filter with insensitive mode', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(1);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'notes', op: 'contains', value: 'urgent' }],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { notes: { contains: 'urgent', mode: 'insensitive' } },
        });
      });

      it('applies multiple filters together', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(2);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [
              { field: 'status', op: 'eq', value: 'approved' },
              { field: 'totalValue', op: 'gt', value: 100 },
            ],
          },
        });

        expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
          where: { status: 'approved', totalValue: { gt: 100 } },
        });
      });
    });

    // -- date range filters --
    describe('date range filters', () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('applies last_7d date range filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(3);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            dateField: 'createdAt',
            dateRange: 'last_7d',
          },
        });

        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        const expected = new Date('2026-02-15T12:00:00Z').getTime() - 7 * 24 * 60 * 60 * 1000;
        expect(callArgs.where.createdAt.gte.getTime()).toBe(expected);
      });

      it('applies last_30d date range filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(15);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            dateField: 'createdAt',
            dateRange: 'last_30d',
          },
        });

        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        const expected = new Date('2026-02-15T12:00:00Z').getTime() - 30 * 24 * 60 * 60 * 1000;
        expect(callArgs.where.createdAt.gte.getTime()).toBe(expected);
      });

      it('applies last_90d date range filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(50);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            dateField: 'createdAt',
            dateRange: 'last_90d',
          },
        });

        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        const expected = new Date('2026-02-15T12:00:00Z').getTime() - 90 * 24 * 60 * 60 * 1000;
        expect(callArgs.where.createdAt.gte.getTime()).toBe(expected);
      });

      it('applies this_month date range filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(8);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            dateField: 'createdAt',
            dateRange: 'this_month',
          },
        });

        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        // February 1, 2026
        const expected = new Date(2026, 1, 1);
        expect(callArgs.where.createdAt.gte.getTime()).toBe(expected.getTime());
      });

      it('applies this_year date range filter', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(100);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            dateField: 'createdAt',
            dateRange: 'this_year',
          },
        });

        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        // January 1, 2026
        const expected = new Date(2026, 0, 1);
        expect(callArgs.where.createdAt.gte.getTime()).toBe(expected.getTime());
      });

      it('ignores unknown date range values', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(0);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            dateField: 'createdAt',
            dateRange: 'custom' as 'last_7d',
          },
        });

        // buildDateFilter returns {} for 'custom', so createdAt should not be in where
        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        expect(callArgs.where).toEqual({});
      });

      it('combines filters with date range', async () => {
        mockPrisma.mrrv.count.mockResolvedValue(2);

        await executeCustomDataSource({
          ...baseSource,
          queryTemplate: {
            entityType: 'mrrv',
            filters: [{ field: 'status', op: 'eq', value: 'approved' }],
            dateField: 'createdAt',
            dateRange: 'last_7d',
          },
        });

        const callArgs = mockPrisma.mrrv.count.mock.calls[0][0];
        expect(callArgs.where.status).toBe('approved');
        expect(callArgs.where.createdAt).toBeDefined();
        expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
      });
    });

    // -- various entity types via ENTITY_MODEL_MAP --
    it('uses correct Prisma model for different entity types', async () => {
      // Test a few representative entity types
      const entityModelPairs: Array<[string, keyof PrismaMock]> = [
        ['mirv', 'mirv'],
        ['osd', 'osdReport'],
        ['jo', 'jobOrder'],
        ['gate_pass', 'gatePass'],
        ['stock_transfer', 'stockTransfer'],
        ['mrf', 'materialRequisition'],
        ['item', 'item'],
        ['project', 'project'],
        ['inventory_lot', 'inventoryLot'],
        ['surplus', 'surplusDeclaration'],
      ];

      for (const [entityType, modelName] of entityModelPairs) {
        const model = mockPrisma[modelName] as Record<string, ReturnType<typeof vi.fn>>;
        model.count.mockResolvedValue(0);

        await executeCustomDataSource({
          ...baseSource,
          entityType,
          queryTemplate: { entityType },
        });

        expect(model.count).toHaveBeenCalled();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // loadCustomDataSources
  // ---------------------------------------------------------------------------
  describe('loadCustomDataSources', () => {
    it('registers all sources with the registerFn', async () => {
      const sources = [
        {
          id: 's1',
          sourceKey: 'grn_count',
          name: 'GRN Count',
          entityType: 'mrrv',
          aggregation: 'count',
          queryTemplate: { entityType: 'mrrv' },
          outputType: 'number',
        },
        {
          id: 's2',
          sourceKey: 'mi_by_status',
          name: 'MI By Status',
          entityType: 'mirv',
          aggregation: 'group_by',
          queryTemplate: { entityType: 'mirv', groupBy: 'status' },
          outputType: 'grouped',
        },
      ];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);
      const registerFn = vi.fn();

      await loadCustomDataSources(registerFn);

      expect(mockPrisma.customDataSource.findMany).toHaveBeenCalled();
      expect(registerFn).toHaveBeenCalledTimes(2);
      expect(registerFn).toHaveBeenCalledWith('custom/grn_count', expect.any(Function));
      expect(registerFn).toHaveBeenCalledWith('custom/mi_by_status', expect.any(Function));
    });

    it('logs info message when sources are registered', async () => {
      const sources = [
        {
          id: 's1',
          sourceKey: 'test_src',
          name: 'Test',
          entityType: 'mrrv',
          aggregation: 'count',
          queryTemplate: { entityType: 'mrrv' },
          outputType: 'number',
        },
      ];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);
      const registerFn = vi.fn();

      await loadCustomDataSources(registerFn);

      expect(log).toHaveBeenCalledWith('info', '[CustomDataSource] Registered 1 custom data source(s)');
    });

    it('does not log when no sources exist', async () => {
      mockPrisma.customDataSource.findMany.mockResolvedValue([]);
      const registerFn = vi.fn();

      await loadCustomDataSources(registerFn);

      expect(registerFn).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalledWith('info', expect.any(String));
    });

    it('registered function executes the data source correctly', async () => {
      const sources = [
        {
          id: 's1',
          sourceKey: 'grn_count',
          name: 'GRN Count',
          entityType: 'mrrv',
          aggregation: 'count',
          queryTemplate: { entityType: 'mrrv' },
          outputType: 'number',
        },
      ];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);
      mockPrisma.mrrv.count.mockResolvedValue(42);
      const registerFn = vi.fn();

      await loadCustomDataSources(registerFn);

      // Execute the registered function
      const registeredFn = registerFn.mock.calls[0][1];
      const result = await registeredFn();

      expect(result).toEqual({ type: 'number', data: 42, label: 'GRN Count' });
    });

    it('handles execution errors gracefully by returning error label', async () => {
      const sources = [
        {
          id: 's1',
          sourceKey: 'bad_source',
          name: 'Bad Source',
          entityType: 'nonexistent_entity',
          aggregation: 'count',
          queryTemplate: { entityType: 'nonexistent_entity' },
          outputType: 'number',
        },
      ];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);
      const registerFn = vi.fn();

      await loadCustomDataSources(registerFn);

      // Execute the registered function — should catch the error
      const registeredFn = registerFn.mock.calls[0][1];
      const result = await registeredFn();

      expect(result).toEqual({
        type: 'number',
        data: 0,
        label: 'Bad Source (error)',
      });
      expect(log).toHaveBeenCalledWith(
        'error',
        expect.stringContaining("[CustomDataSource] Failed to execute 'bad_source'"),
      );
    });

    it('handles execution errors when delegate method rejects', async () => {
      const sources = [
        {
          id: 's1',
          sourceKey: 'failing_source',
          name: 'Failing Source',
          entityType: 'mrrv',
          aggregation: 'count',
          queryTemplate: { entityType: 'mrrv' },
          outputType: 'number',
        },
      ];
      mockPrisma.customDataSource.findMany.mockResolvedValue(sources);
      mockPrisma.mrrv.count.mockRejectedValue(new Error('DB connection lost'));
      const registerFn = vi.fn();

      await loadCustomDataSources(registerFn);

      const registeredFn = registerFn.mock.calls[0][1];
      const result = await registeredFn();

      expect(result).toEqual({
        type: 'number',
        data: 0,
        label: 'Failing Source (error)',
      });
      expect(log).toHaveBeenCalledWith(
        'error',
        expect.stringContaining("[CustomDataSource] Failed to execute 'failing_source'"),
      );
    });
  });
});
