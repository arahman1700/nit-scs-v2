import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { log } from '../config/logger.js';
import {
  calculateABCClassification,
  applyABCClassification,
  getABCSummary,
  getABCItems,
} from './abc-analysis.service.js';
import type { ABCResult } from './abc-analysis.service.js';

const mockedLog = log as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeConsumptionRow(overrides: Record<string, unknown> = {}) {
  return {
    item_id: 'item-1',
    item_code: 'IC-001',
    item_description: 'Widget A',
    annual_value: 50000,
    ...overrides,
  };
}

function makeABCResult(overrides: Partial<ABCResult> = {}): ABCResult {
  return {
    itemId: 'item-1',
    itemCode: 'IC-001',
    itemDescription: 'Widget A',
    annualConsumptionValue: 80000,
    cumulativePercent: 80,
    abcClass: 'A',
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.assign(mockPrisma, createPrismaMock());
});

// ═════════════════════════════════════════════════════════════════════════
// calculateABCClassification
// ═════════════════════════════════════════════════════════════════════════

describe('calculateABCClassification', () => {
  it('should return empty array when no consumption data exists', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const results = await calculateABCClassification();

    expect(results).toEqual([]);
  });

  it('should classify a single item as C (100% cumulative exceeds 95% threshold)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', item_code: 'IC-001', annual_value: 100000 }),
    ]);

    const results = await calculateABCClassification();

    expect(results).toHaveLength(1);
    // A single item reaches 100% cumulative, which is >95%, so it's class C
    expect(results[0].abcClass).toBe('C');
    expect(results[0].cumulativePercent).toBe(100);
    expect(results[0].itemId).toBe('i1');
  });

  it('should classify items into A, B, C based on cumulative 80/95/100 thresholds', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', item_code: 'IC-001', item_description: 'Widget A', annual_value: 80000 }),
      makeConsumptionRow({ item_id: 'i2', item_code: 'IC-002', item_description: 'Widget B', annual_value: 15000 }),
      makeConsumptionRow({ item_id: 'i3', item_code: 'IC-003', item_description: 'Widget C', annual_value: 5000 }),
    ]);

    const results = await calculateABCClassification();

    expect(results).toHaveLength(3);
    // i1: 80000/100000 = 80% cumulative → A (<=80)
    expect(results[0]).toMatchObject({ itemId: 'i1', abcClass: 'A', cumulativePercent: 80 });
    // i2: (80000+15000)/100000 = 95% cumulative → B (<=95)
    expect(results[1]).toMatchObject({ itemId: 'i2', abcClass: 'B', cumulativePercent: 95 });
    // i3: 100% cumulative → C (>95)
    expect(results[2]).toMatchObject({ itemId: 'i3', abcClass: 'C', cumulativePercent: 100 });
  });

  it('should assign B to items in the 80-95% range', async () => {
    // 5 items: values [50, 20, 15, 10, 5] = total 100
    // cumulative: 50% (A), 70% (A), 85% (B), 95% (B), 100% (C)
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', annual_value: 50 }),
      makeConsumptionRow({ item_id: 'i2', annual_value: 20 }),
      makeConsumptionRow({ item_id: 'i3', annual_value: 15 }),
      makeConsumptionRow({ item_id: 'i4', annual_value: 10 }),
      makeConsumptionRow({ item_id: 'i5', annual_value: 5 }),
    ]);

    const results = await calculateABCClassification();

    expect(results[0].abcClass).toBe('A'); // 50%
    expect(results[1].abcClass).toBe('A'); // 70%
    expect(results[2].abcClass).toBe('B'); // 85%
    expect(results[3].abcClass).toBe('B'); // 95%
    expect(results[4].abcClass).toBe('C'); // 100%
  });

  it('should round cumulative percentages to 2 decimal places', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', annual_value: 33333 }),
      makeConsumptionRow({ item_id: 'i2', annual_value: 33333 }),
      makeConsumptionRow({ item_id: 'i3', annual_value: 33334 }),
    ]);

    const results = await calculateABCClassification();

    // 33333/100000 = 33.333%
    expect(results[0].cumulativePercent).toBe(33.33);
    expect(results[1].cumulativePercent).toBe(66.67);
    expect(results[2].cumulativePercent).toBe(100);
  });

  it('should use warehouse-filtered query when warehouseId is provided', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makeConsumptionRow({ item_id: 'i1', annual_value: 1000 })]);

    const results = await calculateABCClassification('wh-123');

    expect(results).toHaveLength(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should use global query when no warehouseId is provided', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makeConsumptionRow({ item_id: 'i1', annual_value: 1000 })]);

    const results = await calculateABCClassification();

    expect(results).toHaveLength(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should map all raw fields correctly to ABCResult', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({
        item_id: 'uuid-abc',
        item_code: 'MAT-099',
        item_description: 'Steel Plate 10mm',
        annual_value: 250000,
      }),
    ]);

    const results = await calculateABCClassification();

    expect(results[0]).toEqual({
      itemId: 'uuid-abc',
      itemCode: 'MAT-099',
      itemDescription: 'Steel Plate 10mm',
      annualConsumptionValue: 250000,
      cumulativePercent: 100,
      abcClass: 'C', // single item at 100% cumulative > 95%
    });
  });

  it('should handle items exactly at the 80% boundary as class A', async () => {
    // Two items: [80, 20] => total 100
    // First: 80% exactly => A (<=80), Second: 100% => C (>95)
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', annual_value: 80 }),
      makeConsumptionRow({ item_id: 'i2', annual_value: 20 }),
    ]);

    const results = await calculateABCClassification();

    expect(results[0].abcClass).toBe('A');
    expect(results[0].cumulativePercent).toBe(80);
  });

  it('should handle items exactly at the 95% boundary as class B', async () => {
    // [80, 15, 5] => total 100
    // 80% => A, 95% => B, 100% => C
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', annual_value: 80 }),
      makeConsumptionRow({ item_id: 'i2', annual_value: 15 }),
      makeConsumptionRow({ item_id: 'i3', annual_value: 5 }),
    ]);

    const results = await calculateABCClassification();

    expect(results[1].abcClass).toBe('B');
    expect(results[1].cumulativePercent).toBe(95);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// applyABCClassification
// ═════════════════════════════════════════════════════════════════════════

describe('applyABCClassification', () => {
  it('should update each item with its ABC class in a transaction', async () => {
    mockPrisma.item.update.mockResolvedValue({});

    const results: ABCResult[] = [
      makeABCResult({ itemId: 'i1', abcClass: 'A' }),
      makeABCResult({ itemId: 'i2', abcClass: 'B' }),
      makeABCResult({ itemId: 'i3', abcClass: 'C' }),
    ];

    await applyABCClassification(results);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // The transaction receives an array of Prisma update promises
    const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArg).toHaveLength(3);
  });

  it('should pass correct data to item.update for each result', async () => {
    mockPrisma.item.update.mockResolvedValue({});

    const results: ABCResult[] = [makeABCResult({ itemId: 'item-A', abcClass: 'A' })];

    await applyABCClassification(results);

    expect(mockPrisma.item.update).toHaveBeenCalledWith({
      where: { id: 'item-A' },
      data: {
        abcClass: 'A',
        abcUpdatedAt: expect.any(Date),
      },
    });
  });

  it('should log the number of updated items', async () => {
    mockPrisma.item.update.mockResolvedValue({});

    const results: ABCResult[] = [makeABCResult({ itemId: 'i1' }), makeABCResult({ itemId: 'i2' })];

    await applyABCClassification(results);

    expect(mockedLog).toHaveBeenCalledWith('info', '[ABC Analysis] Updated 2 item classifications');
  });

  it('should handle empty results array without errors', async () => {
    await applyABCClassification([]);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
    expect(mockedLog).toHaveBeenCalledWith('info', '[ABC Analysis] Updated 0 item classifications');
  });

  it('should propagate transaction errors', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

    const results: ABCResult[] = [makeABCResult({ itemId: 'i1' })];

    await expect(applyABCClassification(results)).rejects.toThrow('DB connection lost');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// getABCSummary
// ═════════════════════════════════════════════════════════════════════════

describe('getABCSummary', () => {
  const lastDate = new Date('2026-02-20T10:00:00Z');

  beforeEach(() => {
    // Default mocks for summary
    mockPrisma.item.findFirst.mockResolvedValue({ abcUpdatedAt: lastDate });
    mockPrisma.item.count
      .mockResolvedValueOnce(2) // class A
      .mockResolvedValueOnce(3) // class B
      .mockResolvedValueOnce(5); // class C

    // Mock the internal calculateABCClassification call
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', annual_value: 80000 }),
      makeConsumptionRow({ item_id: 'i2', annual_value: 15000 }),
      makeConsumptionRow({ item_id: 'i3', annual_value: 5000 }),
    ]);
  });

  it('should return correct class counts', async () => {
    const summary = await getABCSummary();

    expect(summary.classA.count).toBe(2);
    expect(summary.classB.count).toBe(3);
    expect(summary.classC.count).toBe(5);
    expect(summary.totalItems).toBe(10);
  });

  it('should return correct class values from live calculation', async () => {
    const summary = await getABCSummary();

    expect(summary.classA.totalValue).toBe(80000);
    expect(summary.classB.totalValue).toBe(15000);
    expect(summary.classC.totalValue).toBe(5000);
    expect(summary.totalValue).toBe(100000);
  });

  it('should calculate correct percentOfItems', async () => {
    const summary = await getABCSummary();

    // 2/10 = 20%, 3/10 = 30%, 5/10 = 50%
    expect(summary.classA.percentOfItems).toBe(20);
    expect(summary.classB.percentOfItems).toBe(30);
    expect(summary.classC.percentOfItems).toBe(50);
  });

  it('should calculate correct percentOfValue', async () => {
    const summary = await getABCSummary();

    // 80000/100000 = 80%, 15000/100000 = 15%, 5000/100000 = 5%
    expect(summary.classA.percentOfValue).toBe(80);
    expect(summary.classB.percentOfValue).toBe(15);
    expect(summary.classC.percentOfValue).toBe(5);
  });

  it('should return lastCalculatedAt from the most recent item', async () => {
    const summary = await getABCSummary();

    expect(summary.lastCalculatedAt).toEqual(lastDate);
  });

  it('should return null lastCalculatedAt when no items have been classified', async () => {
    mockPrisma.item.findFirst.mockResolvedValue(null);

    const summary = await getABCSummary();

    expect(summary.lastCalculatedAt).toBeNull();
  });

  it('should handle zero items gracefully (all counts 0)', async () => {
    mockPrisma.item.findFirst.mockResolvedValue(null);
    mockPrisma.item.count.mockReset().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const summary = await getABCSummary();

    expect(summary.totalItems).toBe(0);
    expect(summary.totalValue).toBe(0);
    // percentOfItems should be 0 when denominator is 0
    expect(summary.classA.percentOfItems).toBe(0);
    expect(summary.classA.percentOfValue).toBe(0);
  });

  it('should pass warehouseId to calculateABCClassification', async () => {
    await getABCSummary('wh-filter');

    // $queryRaw should have been called (by the internal calculateABCClassification)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// getABCItems
// ═════════════════════════════════════════════════════════════════════════

describe('getABCItems', () => {
  const dbItems = [
    { id: 'i1', itemCode: 'IC-001', itemDescription: 'Widget A', abcClass: 'A', abcUpdatedAt: new Date() },
    { id: 'i2', itemCode: 'IC-002', itemDescription: 'Widget B', abcClass: 'B', abcUpdatedAt: new Date() },
  ];

  beforeEach(() => {
    mockPrisma.item.findMany.mockResolvedValue(dbItems);
    mockPrisma.item.count.mockResolvedValue(2);

    // For enrichment via calculateABCClassification
    mockPrisma.$queryRaw.mockResolvedValue([
      makeConsumptionRow({ item_id: 'i1', item_code: 'IC-001', annual_value: 80000 }),
      makeConsumptionRow({ item_id: 'i2', item_code: 'IC-002', annual_value: 15000 }),
    ]);
  });

  it('should return paginated items with enriched ABC data', async () => {
    const result = await getABCItems({ page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].annualConsumptionValue).toBe(80000);
    expect(result.items[1].annualConsumptionValue).toBe(15000);
  });

  it('should use default page=1 and pageSize=25', async () => {
    await getABCItems({});

    expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
      }),
    );
  });

  it('should apply pagination correctly', async () => {
    await getABCItems({ page: 3, pageSize: 10 });

    expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
  });

  it('should filter by abcClass when provided', async () => {
    await getABCItems({ abcClass: 'A' });

    expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ abcClass: 'A' }),
      }),
    );
  });

  it('should ignore invalid abcClass values', async () => {
    await getABCItems({ abcClass: 'X' });

    const findManyCall = mockPrisma.item.findMany.mock.calls[0][0];
    expect(findManyCall.where.abcClass).toBeUndefined();
  });

  it('should apply search filter on itemCode and itemDescription', async () => {
    await getABCItems({ search: 'Widget' });

    const findManyCall = mockPrisma.item.findMany.mock.calls[0][0];
    expect(findManyCall.where.OR).toEqual([
      { itemCode: { contains: 'Widget', mode: 'insensitive' } },
      { itemDescription: { contains: 'Widget', mode: 'insensitive' } },
    ]);
  });

  it('should always filter by active status', async () => {
    await getABCItems({});

    expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  it('should return 0 for consumption values of items not found in classification', async () => {
    // Item i3 is in DB but not in $queryRaw results
    mockPrisma.item.findMany.mockResolvedValue([
      { id: 'i3', itemCode: 'IC-003', itemDescription: 'Widget C', abcClass: 'C', abcUpdatedAt: null },
    ]);

    const result = await getABCItems({});

    expect(result.items[0].annualConsumptionValue).toBe(0);
    expect(result.items[0].cumulativePercent).toBe(0);
  });

  it('should default abcClass to C when item has no abcClass stored', async () => {
    mockPrisma.item.findMany.mockResolvedValue([
      { id: 'i4', itemCode: 'IC-004', itemDescription: 'Widget D', abcClass: null, abcUpdatedAt: null },
    ]);

    const result = await getABCItems({});

    expect(result.items[0].abcClass).toBe('C');
  });

  it('should order results by itemCode ascending', async () => {
    await getABCItems({});

    expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { itemCode: 'asc' },
      }),
    );
  });
});
