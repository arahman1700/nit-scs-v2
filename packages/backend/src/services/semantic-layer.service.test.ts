import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  listMeasures,
  listDimensions,
  getMeasureCatalog,
  getCompatibleDimensions,
  executeSemanticQuery,
} from './semantic-layer.service.js';

// ── Fixtures ────────────────────────────────────────────────────────────

function makeMeasure(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'measure-1',
    key: 'grn_count',
    name: 'GRN Count',
    description: 'Total GRNs',
    category: 'receiving',
    entityType: 'mrrv',
    aggregation: 'count',
    field: null,
    defaultFilters: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDimension(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dim-1',
    key: 'status',
    name: 'Status',
    description: 'Document status',
    entityTypes: ['mrrv', 'mirv'],
    field: 'status',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Test Suite ───────────────────────────────────────────────────────────

describe('semantic-layer.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
  });

  // ═══════════════════════════════════════════════════════════════════════
  // listMeasures
  // ═══════════════════════════════════════════════════════════════════════
  describe('listMeasures', () => {
    it('returns all active measures when no category is provided', async () => {
      const measures = [
        makeMeasure({ key: 'grn_count', category: 'receiving' }),
        makeMeasure({ key: 'mi_count', category: 'issuance', id: 'measure-2' }),
      ];
      mockPrisma.semanticMeasure.findMany.mockResolvedValue(measures);

      const result = await listMeasures();

      expect(mockPrisma.semanticMeasure.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.semanticMeasure.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      expect(result).toEqual(measures);
    });

    it('filters by category when provided', async () => {
      const measures = [makeMeasure({ key: 'grn_count', category: 'receiving' })];
      mockPrisma.semanticMeasure.findMany.mockResolvedValue(measures);

      const result = await listMeasures('receiving');

      expect(mockPrisma.semanticMeasure.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'receiving' },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      expect(result).toEqual(measures);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // listDimensions
  // ═══════════════════════════════════════════════════════════════════════
  describe('listDimensions', () => {
    it('returns all active dimensions when no entityType is provided', async () => {
      const dims = [makeDimension({ key: 'status' }), makeDimension({ key: 'warehouse', id: 'dim-2' })];
      mockPrisma.semanticDimension.findMany.mockResolvedValue(dims);

      const result = await listDimensions();

      expect(mockPrisma.semanticDimension.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.semanticDimension.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(dims);
    });

    it('filters dimensions by exact entityType match', async () => {
      const dimMrrv = makeDimension({ key: 'status', entityTypes: ['mrrv', 'mirv'] });
      const dimMirv = makeDimension({ key: 'project', entityTypes: ['mirv'], id: 'dim-2' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dimMrrv, dimMirv]);

      const result = await listDimensions('mrrv');

      // Only dimMrrv matches because its entityTypes includes 'mrrv'
      expect(result).toEqual([dimMrrv]);
    });

    it('includes dimensions with wildcard entityType "*"', async () => {
      const dimSpecific = makeDimension({ key: 'status', entityTypes: ['mirv'] });
      const dimWildcard = makeDimension({ key: 'created_date', entityTypes: ['*'], id: 'dim-3' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dimSpecific, dimWildcard]);

      const result = await listDimensions('mrrv');

      // dimSpecific does NOT match mrrv, but dimWildcard matches everything via '*'
      expect(result).toEqual([dimWildcard]);
    });

    it('returns dimensions matching both exact and wildcard entityTypes', async () => {
      const dimExact = makeDimension({ key: 'status', entityTypes: ['mrrv'] });
      const dimWild = makeDimension({ key: 'period', entityTypes: ['*'], id: 'dim-2' });
      const dimOther = makeDimension({ key: 'project', entityTypes: ['mirv'], id: 'dim-3' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dimExact, dimWild, dimOther]);

      const result = await listDimensions('mrrv');

      expect(result).toEqual([dimExact, dimWild]);
    });

    it('excludes dimensions with non-array entityTypes', async () => {
      const dimBadType = makeDimension({ key: 'broken', entityTypes: 'not-an-array' as unknown });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dimBadType]);

      const result = await listDimensions('mrrv');

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getMeasureCatalog
  // ═══════════════════════════════════════════════════════════════════════
  describe('getMeasureCatalog', () => {
    it('groups measures by category into a Record', async () => {
      const m1 = makeMeasure({ key: 'grn_count', category: 'receiving', id: 'm1' });
      const m2 = makeMeasure({ key: 'grn_value', category: 'receiving', id: 'm2' });
      const m3 = makeMeasure({ key: 'mi_count', category: 'issuance', id: 'm3' });
      mockPrisma.semanticMeasure.findMany.mockResolvedValue([m1, m2, m3]);

      const catalog = await getMeasureCatalog();

      expect(catalog).toEqual({
        receiving: [m1, m2],
        issuance: [m3],
      });
    });

    it('returns empty object when no active measures exist', async () => {
      mockPrisma.semanticMeasure.findMany.mockResolvedValue([]);

      const catalog = await getMeasureCatalog();

      expect(catalog).toEqual({});
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getCompatibleDimensions
  // ═══════════════════════════════════════════════════════════════════════
  describe('getCompatibleDimensions', () => {
    it('throws for unknown measure key', async () => {
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(null);

      await expect(getCompatibleDimensions('nonexistent_key')).rejects.toThrow('Measure not found: nonexistent_key');
    });

    it('returns dimensions compatible with the measure entityType', async () => {
      const measure = makeMeasure({ entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      const dimMatch = makeDimension({ key: 'status', entityTypes: ['mrrv'] });
      const dimWild = makeDimension({ key: 'period', entityTypes: ['*'], id: 'dim-2' });
      const dimOther = makeDimension({ key: 'project', entityTypes: ['mirv'], id: 'dim-3' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dimMatch, dimWild, dimOther]);

      const result = await getCompatibleDimensions('grn_count');

      expect(mockPrisma.semanticMeasure.findUnique).toHaveBeenCalledWith({
        where: { key: 'grn_count' },
      });
      expect(result).toEqual([dimMatch, dimWild]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // executeSemanticQuery
  // ═══════════════════════════════════════════════════════════════════════
  describe('executeSemanticQuery', () => {
    // ── Error paths ──────────────────────────────────────────────────
    it('throws for unknown measure key', async () => {
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(null);

      await expect(executeSemanticQuery({ measure: 'nonexistent' })).rejects.toThrow('Measure not found: nonexistent');
    });

    it('throws for unknown entity type', async () => {
      const measure = makeMeasure({ entityType: 'unknown_entity' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      await expect(executeSemanticQuery({ measure: 'grn_count' })).rejects.toThrow(
        /Unknown entity type: unknown_entity/,
      );
    });

    it('throws for unsupported aggregation type', async () => {
      const measure = makeMeasure({ aggregation: 'median' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      await expect(executeSemanticQuery({ measure: 'grn_count' })).rejects.toThrow('Unsupported aggregation: median');
    });

    // ── Count without dimensions (scalar) ────────────────────────────
    it('returns scalar count when no dimensions are provided', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(42);

      const result = await executeSemanticQuery({ measure: 'grn_count' });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        measure: { key: 'grn_count', name: 'GRN Count', aggregation: 'count' },
        dimensions: [],
        data: 42,
      });
    });

    // ── Count with dimensions (groupBy) ──────────────────────────────
    it('returns grouped count when dimensions are provided', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      const dim = makeDimension({ key: 'status', field: 'status' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dim]);

      const groupByResult = [
        { status: 'draft', _count: { id: 10 } },
        { status: 'approved', _count: { id: 5 } },
      ];
      mockPrisma.mrrv.groupBy.mockResolvedValue(groupByResult);

      const result = await executeSemanticQuery({
        measure: 'grn_count',
        dimensions: ['status'],
      });

      expect(mockPrisma.mrrv.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {},
        _count: { id: true },
        orderBy: { status: 'asc' },
      });
      expect(result).toEqual({
        measure: { key: 'grn_count', name: 'GRN Count', aggregation: 'count' },
        dimensions: [{ key: 'status', field: 'status' }],
        data: [
          { status: 'draft', value: 10 },
          { status: 'approved', value: 5 },
        ],
      });
    });

    // ── Sum without dimensions (aggregate) ───────────────────────────
    it('returns scalar sum via aggregate when no dimensions', async () => {
      const measure = makeMeasure({
        key: 'grn_total_qty',
        aggregation: 'sum',
        field: 'totalQty',
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _sum: { totalQty: 1500 } });

      const result = await executeSemanticQuery({ measure: 'grn_total_qty' });

      expect(mockPrisma.mrrv.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: { totalQty: true },
      });
      expect(result).toEqual({
        measure: { key: 'grn_total_qty', name: 'GRN Count', aggregation: 'sum' },
        dimensions: [],
        data: 1500,
      });
    });

    // ── Sum with dimensions (groupBy) ────────────────────────────────
    it('returns grouped sum when dimensions are provided', async () => {
      const measure = makeMeasure({
        key: 'grn_total_qty',
        aggregation: 'sum',
        field: 'totalQty',
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      const dim = makeDimension({ key: 'warehouseId', field: 'warehouseId' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dim]);

      const groupByResult = [
        { warehouseId: 'wh-1', _sum: { totalQty: 800 } },
        { warehouseId: 'wh-2', _sum: { totalQty: 700 } },
      ];
      mockPrisma.mrrv.groupBy.mockResolvedValue(groupByResult);

      const result = await executeSemanticQuery({
        measure: 'grn_total_qty',
        dimensions: ['warehouseId'],
      });

      expect(mockPrisma.mrrv.groupBy).toHaveBeenCalledWith({
        by: ['warehouseId'],
        where: {},
        _sum: { totalQty: true },
        orderBy: { warehouseId: 'asc' },
      });
      expect(result).toEqual({
        measure: { key: 'grn_total_qty', name: 'GRN Count', aggregation: 'sum' },
        dimensions: [{ key: 'warehouseId', field: 'warehouseId' }],
        data: [
          { warehouseId: 'wh-1', value: 800 },
          { warehouseId: 'wh-2', value: 700 },
        ],
      });
    });

    // ── Avg with dimensions (groupBy) ────────────────────────────────
    it('returns grouped avg when dimensions are provided', async () => {
      const measure = makeMeasure({
        key: 'grn_avg_qty',
        aggregation: 'avg',
        field: 'totalQty',
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      const dim = makeDimension({ key: 'status', field: 'status' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dim]);

      const groupByResult = [
        { status: 'draft', _avg: { totalQty: 25.5 } },
        { status: 'approved', _avg: { totalQty: 42.0 } },
      ];
      mockPrisma.mrrv.groupBy.mockResolvedValue(groupByResult);

      const result = await executeSemanticQuery({
        measure: 'grn_avg_qty',
        dimensions: ['status'],
      });

      expect(mockPrisma.mrrv.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {},
        _avg: { totalQty: true },
        orderBy: { status: 'asc' },
      });
      expect(result).toEqual({
        measure: { key: 'grn_avg_qty', name: 'GRN Count', aggregation: 'avg' },
        dimensions: [{ key: 'status', field: 'status' }],
        data: [
          { status: 'draft', value: 25.5 },
          { status: 'approved', value: 42.0 },
        ],
      });
    });

    // ── Avg without dimensions (aggregate scalar) ────────────────────
    it('returns scalar avg via aggregate when no dimensions', async () => {
      const measure = makeMeasure({
        key: 'grn_avg_qty',
        aggregation: 'avg',
        field: 'totalQty',
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _avg: { totalQty: 33.3 } });

      const result = await executeSemanticQuery({ measure: 'grn_avg_qty' });

      expect(mockPrisma.mrrv.aggregate).toHaveBeenCalledWith({
        where: {},
        _avg: { totalQty: true },
      });
      expect(result).toEqual({
        measure: { key: 'grn_avg_qty', name: 'GRN Count', aggregation: 'avg' },
        dimensions: [],
        data: 33.3,
      });
    });

    // ── User filters ─────────────────────────────────────────────────
    it('applies user-provided filters to the where clause', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(7);

      const result = await executeSemanticQuery({
        measure: 'grn_count',
        filters: [
          { field: 'status', op: 'eq', value: 'approved' },
          { field: 'warehouseId', op: 'in', value: ['wh-1', 'wh-2'] },
        ],
      });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: {
          status: 'approved',
          warehouseId: { in: ['wh-1', 'wh-2'] },
        },
      });
      expect(result!.data).toBe(7);
    });

    it('applies all supported filter operators', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(3);

      await executeSemanticQuery({
        measure: 'grn_count',
        filters: [
          { field: 'f1', op: 'ne', value: 'x' },
          { field: 'f2', op: 'gt', value: 10 },
          { field: 'f3', op: 'gte', value: 20 },
          { field: 'f4', op: 'lt', value: 30 },
          { field: 'f5', op: 'lte', value: 40 },
          { field: 'f6', op: 'contains', value: 'test' },
        ],
      });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: {
          f1: { not: 'x' },
          f2: { gt: 10 },
          f3: { gte: 20 },
          f4: { lt: 30 },
          f5: { lte: 40 },
          f6: { contains: 'test', mode: 'insensitive' },
        },
      });
    });

    // ── Date range filter ────────────────────────────────────────────
    it('applies date range filter on createdAt', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(15);

      await executeSemanticQuery({
        measure: 'grn_count',
        dateRange: { start: '2026-01-01', end: '2026-01-31' },
      });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        },
      });
    });

    // ── Default filters from measure ─────────────────────────────────
    it('applies default filters from measure definition (object form)', async () => {
      const measure = makeMeasure({
        key: 'active_grn_count',
        aggregation: 'count',
        entityType: 'mrrv',
        defaultFilters: { status: 'approved', isActive: true },
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(20);

      await executeSemanticQuery({ measure: 'active_grn_count' });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: { status: 'approved', isActive: true },
      });
    });

    it('applies default filters from measure definition (array form)', async () => {
      const measure = makeMeasure({
        key: 'draft_grn_count',
        aggregation: 'count',
        entityType: 'mrrv',
        defaultFilters: [
          { field: 'status', op: 'eq', value: 'draft' },
          { field: 'priority', op: 'gte', value: 3 },
        ],
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(8);

      await executeSemanticQuery({ measure: 'draft_grn_count' });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: { status: 'draft', priority: { gte: 3 } },
      });
    });

    it('merges default filters with user filters and date range', async () => {
      const measure = makeMeasure({
        key: 'grn_count',
        aggregation: 'count',
        entityType: 'mrrv',
        defaultFilters: { isActive: true },
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(5);

      await executeSemanticQuery({
        measure: 'grn_count',
        filters: [{ field: 'status', op: 'eq', value: 'approved' }],
        dateRange: { start: '2026-02-01', end: '2026-02-15' },
      });

      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: {
          isActive: true,
          status: 'approved',
          createdAt: {
            gte: new Date('2026-02-01'),
            lte: new Date('2026-02-15'),
          },
        },
      });
    });

    // ── Multiple dimensions ──────────────────────────────────────────
    it('supports multiple dimensions in groupBy', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      const dim1 = makeDimension({ key: 'status', field: 'status', id: 'dim-1' });
      const dim2 = makeDimension({ key: 'warehouseId', field: 'warehouseId', id: 'dim-2' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dim1, dim2]);

      const groupByResult = [
        { status: 'draft', warehouseId: 'wh-1', _count: { id: 3 } },
        { status: 'approved', warehouseId: 'wh-1', _count: { id: 7 } },
      ];
      mockPrisma.mrrv.groupBy.mockResolvedValue(groupByResult);

      const result = await executeSemanticQuery({
        measure: 'grn_count',
        dimensions: ['status', 'warehouseId'],
      });

      expect(mockPrisma.mrrv.groupBy).toHaveBeenCalledWith({
        by: ['status', 'warehouseId'],
        where: {},
        _count: { id: true },
        orderBy: { status: 'asc', warehouseId: 'asc' },
      });
      expect(result).toEqual({
        measure: { key: 'grn_count', name: 'GRN Count', aggregation: 'count' },
        dimensions: [
          { key: 'status', field: 'status' },
          { key: 'warehouseId', field: 'warehouseId' },
        ],
        data: [
          { status: 'draft', warehouseId: 'wh-1', value: 3 },
          { status: 'approved', warehouseId: 'wh-1', value: 7 },
        ],
      });
    });

    // ── Different entity types via ENTITY_MODEL_MAP ──────────────────
    it('uses correct Prisma model for osd entity type (osdReport)', async () => {
      const measure = makeMeasure({
        key: 'dr_count',
        aggregation: 'count',
        entityType: 'osd',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.osdReport.count.mockResolvedValue(12);

      const result = await executeSemanticQuery({ measure: 'dr_count' });

      expect(mockPrisma.osdReport.count).toHaveBeenCalledWith({ where: {} });
      expect(result!.data).toBe(12);
    });

    it('uses correct Prisma model for jo entity type (jobOrder)', async () => {
      const measure = makeMeasure({
        key: 'jo_count',
        aggregation: 'count',
        entityType: 'jo',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.jobOrder.count.mockResolvedValue(9);

      const result = await executeSemanticQuery({ measure: 'jo_count' });

      expect(mockPrisma.jobOrder.count).toHaveBeenCalledWith({ where: {} });
      expect(result!.data).toBe(9);
    });

    // ── Null agg field fallback ──────────────────────────────────────
    it('falls back to "id" when measure.field is null for sum', async () => {
      const measure = makeMeasure({
        key: 'grn_sum',
        aggregation: 'sum',
        field: null,
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _sum: { id: 0 } });

      await executeSemanticQuery({ measure: 'grn_sum' });

      expect(mockPrisma.mrrv.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: { id: true },
      });
    });

    // ── Null aggregate value fallback ────────────────────────────────
    it('returns 0 when aggregate result is null (no matching rows)', async () => {
      const measure = makeMeasure({
        key: 'grn_sum',
        aggregation: 'sum',
        field: 'totalQty',
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.aggregate.mockResolvedValue({ _sum: { totalQty: null } });

      const result = await executeSemanticQuery({ measure: 'grn_sum' });

      expect(result!.data).toBe(0);
    });

    it('returns 0 for groupBy rows with null aggregate value', async () => {
      const measure = makeMeasure({
        key: 'grn_sum',
        aggregation: 'sum',
        field: 'totalQty',
        entityType: 'mrrv',
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);

      const dim = makeDimension({ key: 'status', field: 'status' });
      mockPrisma.semanticDimension.findMany.mockResolvedValue([dim]);

      mockPrisma.mrrv.groupBy.mockResolvedValue([{ status: 'draft', _sum: { totalQty: null } }]);

      const result = await executeSemanticQuery({
        measure: 'grn_sum',
        dimensions: ['status'],
      });

      expect(result!.data).toEqual([{ status: 'draft', value: 0 }]);
    });

    // ── Empty dimensions array treated as no dimensions ──────────────
    it('treats empty dimensions array as no dimensions (scalar)', async () => {
      const measure = makeMeasure({ key: 'grn_count', aggregation: 'count', entityType: 'mrrv' });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(99);

      const result = await executeSemanticQuery({
        measure: 'grn_count',
        dimensions: [],
      });

      // Empty array => no dimensions looked up, no groupBy
      expect(mockPrisma.semanticDimension.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({ where: {} });
      expect(result!.data).toBe(99);
    });

    // ── Date range merges with existing createdAt filter ─────────────
    it('merges date range with existing createdAt from default filters', async () => {
      const measure = makeMeasure({
        key: 'grn_count',
        aggregation: 'count',
        entityType: 'mrrv',
        defaultFilters: [{ field: 'createdAt', op: 'gte', value: '2025-01-01T00:00:00Z' }],
      });
      mockPrisma.semanticMeasure.findUnique.mockResolvedValue(measure);
      mockPrisma.mrrv.count.mockResolvedValue(4);

      await executeSemanticQuery({
        measure: 'grn_count',
        dateRange: { start: '2026-01-01', end: '2026-06-30' },
      });

      // The date range should override/merge with the existing createdAt filter
      expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-06-30'),
          },
        },
      });
    });
  });
});
