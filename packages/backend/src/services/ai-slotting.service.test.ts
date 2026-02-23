import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const { mockPrisma, mockAnalyzeSlotting } = vi.hoisted(() => ({
  mockPrisma: {} as PrismaMock,
  mockAnalyzeSlotting: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('./slotting-optimizer.service.js', () => ({ analyzeSlotting: mockAnalyzeSlotting }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { analyzeCoLocation, analyzeSeasonalTrends, generateAiSlottingSummary } from './ai-slotting.service.js';

// ── Helpers ────────────────────────────────────────────────────────────

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

const WH_ID = 'wh-001';

function makePair(
  overrides: Partial<{
    item_a_id: string;
    item_a_code: string;
    item_a_name: string;
    item_b_id: string;
    item_b_code: string;
    item_b_name: string;
    co_count: bigint;
  }> = {},
) {
  return {
    item_a_id: 'item-a',
    item_a_code: 'A001',
    item_a_name: 'Item A',
    item_b_id: 'item-b',
    item_b_code: 'B001',
    item_b_name: 'Item B',
    co_count: BigInt(5),
    ...overrides,
  };
}

function makeSeasonalRow(
  overrides: Partial<{
    item_id: string;
    item_code: string;
    item_description: string;
    abc_class: string | null;
    month_key: string;
    month_qty: number;
  }> = {},
) {
  return {
    item_id: 'item-1',
    item_code: 'ITM-001',
    item_description: 'Seasonal Item',
    abc_class: 'A',
    month_key: '2025-06',
    month_qty: 100,
    ...overrides,
  };
}

function makeStandardAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    warehouseId: WH_ID,
    suggestions: [],
    currentEfficiency: 65,
    projectedEfficiency: 80,
    estimatedTimeSavingMinutes: 30,
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  const fresh = createPrismaMock();
  Object.assign(mockPrisma, fresh);
  (mockPrisma as Record<string, unknown>).binCard = createModelMock();
  vi.clearAllMocks();
});

// ── calculateBinDistance (tested via analyzeCoLocation) ────────────────

describe('calculateBinDistance (via analyzeCoLocation)', () => {
  it('returns 99 when itemA has no bin assignment', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    // binCard returns nothing → both bins null
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.binDistance).toBe(99);
  });

  it('returns 99 when itemB has no bin assignment', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      // item-b has no bin
    ]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.binDistance).toBe(99);
  });

  it('returns 0 for identical bin locations', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'A-01-01' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.binDistance).toBe(0);
  });

  it('calculates shelf difference correctly (2 units per shelf)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'A-01-04' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    // shelf diff = |1 - 4| * 2 = 6
    expect(result.pairs[0]!.binDistance).toBe(6);
  });

  it('calculates aisle difference correctly (10 units per aisle)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'A-03-01' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    // aisle diff = |1 - 3| * 10 = 20
    expect(result.pairs[0]!.binDistance).toBe(20);
  });

  it('adds 50 units for different zones', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'B-01-01' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    // zone diff = 50, aisle diff = 0, shelf diff = 0
    expect(result.pairs[0]!.binDistance).toBe(50);
  });

  it('combines zone + aisle + shelf distances', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'C-05-03' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    // zone diff = 50 (A != C), aisle diff = |1-5|*10 = 40, shelf diff = |1-3|*2 = 4
    expect(result.pairs[0]!.binDistance).toBe(94);
  });
});

// ── analyzeCoLocation ──────────────────────────────────────────────────

describe('analyzeCoLocation', () => {
  it('returns empty pairs when $queryRaw returns no co-picked pairs', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.warehouseId).toBe(WH_ID);
    expect(result.pairs).toHaveLength(0);
    expect(result.potentialTimeSavingMinutes).toBe(0);
  });

  it('converts bigint co_count to number in the result', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair({ co_count: BigInt(7) })]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.coOccurrences).toBe(7);
    expect(typeof result.pairs[0]!.coOccurrences).toBe('number');
  });

  it('generates "Move" suggestion when bin distance > 20', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair({ co_count: BigInt(10) })]);
    // Place in different zones → distance 50
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'B-01-01' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    const suggestion = result.pairs[0]!.suggestion;
    expect(suggestion).toContain('Move');
    expect(suggestion).toContain('A001');
    expect(suggestion).toContain('B001');
    expect(suggestion).toContain('co-picked 10 times');
    expect(suggestion).toContain('50 units apart');
  });

  it('generates "Consider" suggestion when bin distance is 6-20', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair({ co_count: BigInt(4) })]);
    // Aisle diff = |1-2|*10 = 10
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'A-02-01' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    const suggestion = result.pairs[0]!.suggestion;
    expect(suggestion).toContain('Consider moving closer');
    expect(suggestion).toContain('co-picked 4 times');
    expect(suggestion).toContain('10 units apart');
  });

  it('generates "well-placed" suggestion when bin distance <= 5', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair({ co_count: BigInt(3) })]);
    // Shelf diff = |1-2|*2 = 2
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-01' },
      { itemId: 'item-b', binNumber: 'A-01-02' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.suggestion).toContain('well-placed');
    expect(result.pairs[0]!.suggestion).toContain('2 units apart');
  });

  it('calculates time saving only for pairs with distance > 5', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makePair({ item_a_id: 'a1', item_b_id: 'b1' }),
      makePair({ item_a_id: 'a2', item_b_id: 'b2' }),
      makePair({ item_a_id: 'a3', item_b_id: 'b3' }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'a1', binNumber: 'A-01-01' },
      { itemId: 'b1', binNumber: 'B-01-01' }, // distance 50 (> 5, movable)
      { itemId: 'a2', binNumber: 'A-01-01' },
      { itemId: 'b2', binNumber: 'A-02-01' }, // distance 10 (> 5, movable)
      { itemId: 'a3', binNumber: 'A-01-01' },
      { itemId: 'b3', binNumber: 'A-01-02' }, // distance 2 (<= 5, not movable)
    ]);

    const result = await analyzeCoLocation(WH_ID);
    // 2 movable pairs * 1.5 minutes = 3.0
    expect(result.potentialTimeSavingMinutes).toBe(3);
  });

  it('populates itemA and itemB fields correctly', async () => {
    const pair = makePair({
      item_a_id: 'id-AAA',
      item_a_code: 'CODE-A',
      item_a_name: 'Name A',
      item_b_id: 'id-BBB',
      item_b_code: 'CODE-B',
      item_b_name: 'Name B',
    });
    mockPrisma.$queryRaw.mockResolvedValue([pair]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.itemA).toEqual({ id: 'id-AAA', code: 'CODE-A', name: 'Name A' });
    expect(result.pairs[0]!.itemB).toEqual({ id: 'id-BBB', code: 'CODE-B', name: 'Name B' });
  });

  it('maps binCard results to itemABin / itemBBin', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-a', binNumber: 'A-01-05' },
      { itemId: 'item-b', binNumber: 'B-03-02' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.itemABin).toBe('A-01-05');
    expect(result.pairs[0]!.itemBBin).toBe('B-03-02');
  });

  it('sets bin to null when item has no binCard entry', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makePair()]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs[0]!.itemABin).toBeNull();
    expect(result.pairs[0]!.itemBBin).toBeNull();
  });

  it('handles multiple pairs independently', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makePair({ item_a_id: 'x1', item_b_id: 'y1', co_count: BigInt(8) }),
      makePair({ item_a_id: 'x2', item_b_id: 'y2', co_count: BigInt(4) }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'x1', binNumber: 'A-01-01' },
      { itemId: 'y1', binNumber: 'A-01-01' },
      { itemId: 'x2', binNumber: 'A-01-01' },
      { itemId: 'y2', binNumber: 'C-01-01' },
    ]);

    const result = await analyzeCoLocation(WH_ID);
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs[0]!.binDistance).toBe(0); // same bin
    expect(result.pairs[1]!.binDistance).toBe(50); // different zone
  });
});

// ── analyzeSeasonalTrends ──────────────────────────────────────────────

describe('analyzeSeasonalTrends', () => {
  it('returns empty items when $queryRaw returns no rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.warehouseId).toBe(WH_ID);
    expect(result.items).toHaveLength(0);
    expect(result.seasonalAlertCount).toBe(0);
  });

  it('excludes items with fewer than 3 months of data', async () => {
    // Only 2 months of data
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 100 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 500 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items).toHaveLength(0);
  });

  it('excludes items with seasonality index below 2.0', async () => {
    // 4 months, all similar volume → index ≈ 1.x
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 100 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 110 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 105 }),
      makeSeasonalRow({ month_key: '2025-04', month_qty: 108 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    // avg ~105.75, peak 110, index ≈ 1.04 → below 2.0
    expect(result.items).toHaveLength(0);
  });

  it('includes items with seasonality index >= 2.0', async () => {
    // 4 months: one big spike → peak/avg >= 2.0
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 50 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 50 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 50 }),
      makeSeasonalRow({ month_key: '2025-04', month_qty: 300 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items).toHaveLength(1);
    // avg = (50+50+50+300)/4 = 112.5, peak = 300, index = 300/112.5 ≈ 2.67
    expect(result.items[0]!.seasonalityIndex).toBeCloseTo(2.67, 1);
    expect(result.items[0]!.peakMonth).toBe('2025-04');
    expect(result.items[0]!.peakVolume).toBe(300);
  });

  it('calculates avgMonthlyVolume rounded to 2 decimal places', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 33 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 33 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 200 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    // avg = (33+33+200)/3 = 88.666... rounded to 88.67
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.avgMonthlyVolume).toBe(88.67);
  });

  it('sorts seasonal items by seasonality index descending', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      // Item 1: avg=50, peak=150 → index=3.0
      makeSeasonalRow({ item_id: 'i1', item_code: 'I1', month_key: '2025-01', month_qty: 25 }),
      makeSeasonalRow({ item_id: 'i1', item_code: 'I1', month_key: '2025-02', month_qty: 25 }),
      makeSeasonalRow({ item_id: 'i1', item_code: 'I1', month_key: '2025-03', month_qty: 150 }),
      // Item 2: avg=50, peak=250 → index=5.0
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-02', month_qty: 10 }),
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-03', month_qty: 10 }),
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-04', month_qty: 250 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items).toHaveLength(2);
    // Item 2 (higher index) should come first
    expect(result.items[0]!.itemCode).toBe('I2');
    expect(result.items[1]!.itemCode).toBe('I1');
  });

  it('generates recommendation with peak month and seasonality index', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-06', month_qty: 100 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items[0]!.recommendation).toContain('2025-06');
    expect(result.items[0]!.recommendation).toContain('golden zone');
  });

  it('assigns current bin from binCard data', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 200 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([
      { itemId: 'item-1', binNumber: 'C-05-03' },
    ]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items[0]!.currentBin).toBe('C-05-03');
  });

  it('sets currentBin to null when no binCard exists', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 200 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items[0]!.currentBin).toBeNull();
  });

  it('defaults abcClass to "C" when abc_class is null', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ abc_class: null, month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ abc_class: null, month_key: '2025-02', month_qty: 10 }),
      makeSeasonalRow({ abc_class: null, month_key: '2025-03', month_qty: 200 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items[0]!.abcClass).toBe('C');
  });

  it('sets seasonalAlertCount equal to the number of seasonal items', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      // Item 1 — seasonal
      makeSeasonalRow({ item_id: 'i1', month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ item_id: 'i1', month_key: '2025-02', month_qty: 10 }),
      makeSeasonalRow({ item_id: 'i1', month_key: '2025-03', month_qty: 100 }),
      // Item 2 — seasonal
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-01', month_qty: 5 }),
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-02', month_qty: 5 }),
      makeSeasonalRow({ item_id: 'i2', item_code: 'I2', month_key: '2025-03', month_qty: 50 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.seasonalAlertCount).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('skips items with zero average monthly volume', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 0 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 0 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 0 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items).toHaveLength(0);
  });

  it('populates monthlyVolumes map correctly from multiple rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeSeasonalRow({ month_key: '2025-01', month_qty: 10 }),
      makeSeasonalRow({ month_key: '2025-02', month_qty: 20 }),
      makeSeasonalRow({ month_key: '2025-03', month_qty: 200 }),
    ]);
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue([]);

    const result = await analyzeSeasonalTrends(WH_ID);
    expect(result.items[0]!.monthlyVolumes).toEqual({
      '2025-01': 10,
      '2025-02': 20,
      '2025-03': 200,
    });
  });
});

// ── generateAiSlottingSummary ──────────────────────────────────────────

describe('generateAiSlottingSummary', () => {
  // Helper: set up all three analysis results at once
  function setupAllAnalyses(
    opts: {
      standard?: Record<string, unknown>;
      queryRawResults?: unknown[];
      binCards?: unknown[];
    } = {},
  ) {
    const standard = makeStandardAnalysis(opts.standard);
    mockAnalyzeSlotting.mockResolvedValue(standard);

    // $queryRaw is called twice: once for co-location pairs, once for seasonal rows
    // We stack the resolved values in order
    const queryRawResults = opts.queryRawResults ?? [[], []];
    for (const result of queryRawResults) {
      mockPrisma.$queryRaw.mockResolvedValueOnce(result);
    }

    const binCards = opts.binCards ?? [];
    (mockPrisma as Record<string, unknown> & { binCard: PrismaModelMock }).binCard.findMany.mockResolvedValue(binCards);

    return standard;
  }

  it('runs all three analyses in parallel', async () => {
    setupAllAnalyses();

    const result = await generateAiSlottingSummary(WH_ID);

    expect(mockAnalyzeSlotting).toHaveBeenCalledWith(WH_ID);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(result.warehouseId).toBe(WH_ID);
  });

  it('returns base confidence of 40 when no data from any source', async () => {
    setupAllAnalyses({
      standard: { suggestions: [], currentEfficiency: 0, projectedEfficiency: 0 },
    });

    const result = await generateAiSlottingSummary(WH_ID);
    expect(result.aiConfidence).toBe(40);
  });

  it('adds 25 to confidence when frequency data is present', async () => {
    setupAllAnalyses({
      standard: {
        suggestions: [
          {
            itemId: 'i1',
            itemCode: 'I1',
            itemName: 'Item 1',
            abcClass: 'A',
            pickFrequency: 10,
            currentBin: 'A-01-01',
            suggestedBin: 'A-01-02',
            currentZone: 'A',
            suggestedZone: 'A',
            reason: 'High frequency',
            priorityScore: 90,
          },
        ],
      },
    });

    const result = await generateAiSlottingSummary(WH_ID);
    // 40 base + 25 frequency = 65
    expect(result.aiConfidence).toBe(65);
  });

  it('adds 20 to confidence when co-location data is present', async () => {
    setupAllAnalyses({
      queryRawResults: [
        [makePair()], // co-location pairs
        [], // seasonal rows
      ],
    });

    const result = await generateAiSlottingSummary(WH_ID);
    // 40 base + 20 co-location = 60
    expect(result.aiConfidence).toBe(60);
  });

  it('adds 15 to confidence when seasonal data is present', async () => {
    setupAllAnalyses({
      queryRawResults: [
        [], // co-location pairs
        [
          // seasonal rows with high seasonality
          makeSeasonalRow({ month_key: '2025-01', month_qty: 10 }),
          makeSeasonalRow({ month_key: '2025-02', month_qty: 10 }),
          makeSeasonalRow({ month_key: '2025-03', month_qty: 200 }),
        ],
      ],
    });

    const result = await generateAiSlottingSummary(WH_ID);
    // 40 base + 15 seasonal = 55
    expect(result.aiConfidence).toBe(55);
  });

  it('caps confidence at 100 even if all sources present', async () => {
    setupAllAnalyses({
      standard: {
        suggestions: [
          {
            itemId: 'i1',
            itemCode: 'I1',
            itemName: 'Item 1',
            abcClass: 'A',
            pickFrequency: 10,
            currentBin: 'A-01-01',
            suggestedBin: 'A-01-02',
            currentZone: 'A',
            suggestedZone: 'A',
            reason: 'High freq',
            priorityScore: 90,
          },
        ],
      },
      queryRawResults: [
        [makePair()],
        [
          makeSeasonalRow({ month_key: '2025-01', month_qty: 10 }),
          makeSeasonalRow({ month_key: '2025-02', month_qty: 10 }),
          makeSeasonalRow({ month_key: '2025-03', month_qty: 200 }),
        ],
      ],
    });

    const result = await generateAiSlottingSummary(WH_ID);
    // 40 + 25 + 20 + 15 = 100
    expect(result.aiConfidence).toBe(100);
  });

  it('includes top standard suggestion in recommendations', async () => {
    setupAllAnalyses({
      standard: {
        suggestions: [
          {
            itemId: 'i1',
            itemCode: 'BOLT-001',
            itemName: 'Bolt',
            abcClass: 'A',
            pickFrequency: 50,
            currentBin: 'C-05-03',
            suggestedBin: 'A-01-01',
            currentZone: 'C',
            suggestedZone: 'A',
            reason: 'High freq',
            priorityScore: 95,
          },
        ],
      },
    });

    const result = await generateAiSlottingSummary(WH_ID);
    expect(result.topRecommendations).toContainEqual(expect.stringContaining('BOLT-001'));
    expect(result.topRecommendations).toContainEqual(expect.stringContaining('C-05-03'));
    expect(result.topRecommendations).toContainEqual(expect.stringContaining('A-01-01'));
  });

  it('includes co-location recommendation for movable pairs (distance > 20)', async () => {
    setupAllAnalyses({
      queryRawResults: [[makePair({ item_a_code: 'PIPE-A', item_b_code: 'PIPE-B', co_count: BigInt(12) })], []],
      binCards: [
        { itemId: 'item-a', binNumber: 'A-01-01' },
        { itemId: 'item-b', binNumber: 'C-01-01' }, // distance = 50
      ],
    });

    const result = await generateAiSlottingSummary(WH_ID);
    const coLocRec = result.topRecommendations.find(r => r.includes('Co-locate'));
    expect(coLocRec).toBeDefined();
    expect(coLocRec).toContain('PIPE-A');
    expect(coLocRec).toContain('PIPE-B');
    expect(coLocRec).toContain('12 times');
  });

  it('does not include co-location recommendation when all pairs within distance 20', async () => {
    setupAllAnalyses({
      queryRawResults: [[makePair()], []],
      binCards: [
        { itemId: 'item-a', binNumber: 'A-01-01' },
        { itemId: 'item-b', binNumber: 'A-02-01' }, // distance = 10 (≤ 20)
      ],
    });

    const result = await generateAiSlottingSummary(WH_ID);
    const coLocRec = result.topRecommendations.find(r => r.includes('Co-locate'));
    expect(coLocRec).toBeUndefined();
  });

  it('includes seasonal recommendation for seasonal items', async () => {
    setupAllAnalyses({
      queryRawResults: [
        [],
        [
          makeSeasonalRow({ item_code: 'CEMENT-X', month_key: '2025-01', month_qty: 10 }),
          makeSeasonalRow({ item_code: 'CEMENT-X', month_key: '2025-02', month_qty: 10 }),
          makeSeasonalRow({ item_code: 'CEMENT-X', month_key: '2025-07', month_qty: 200 }),
        ],
      ],
    });

    const result = await generateAiSlottingSummary(WH_ID);
    const seasonalRec = result.topRecommendations.find(r => r.includes('Pre-position'));
    expect(seasonalRec).toBeDefined();
    expect(seasonalRec).toContain('CEMENT-X');
    expect(seasonalRec).toContain('2025-07');
  });

  it('includes efficiency improvement recommendation when projected > current', async () => {
    setupAllAnalyses({
      standard: { currentEfficiency: 60, projectedEfficiency: 85 },
    });

    const result = await generateAiSlottingSummary(WH_ID);
    const effRec = result.topRecommendations.find(r => r.includes('efficiency'));
    expect(effRec).toBeDefined();
    expect(effRec).toContain('60%');
    expect(effRec).toContain('85%');
  });

  it('omits efficiency recommendation when projected <= current', async () => {
    setupAllAnalyses({
      standard: { currentEfficiency: 80, projectedEfficiency: 80 },
    });

    const result = await generateAiSlottingSummary(WH_ID);
    const effRec = result.topRecommendations.find(r => r.includes('efficiency'));
    expect(effRec).toBeUndefined();
  });

  it('returns all three analysis objects in the summary', async () => {
    const standard = setupAllAnalyses();

    const result = await generateAiSlottingSummary(WH_ID);
    expect(result.standardAnalysis).toEqual(standard);
    expect(result.coLocation).toBeDefined();
    expect(result.coLocation.warehouseId).toBe(WH_ID);
    expect(result.seasonal).toBeDefined();
    expect(result.seasonal.warehouseId).toBe(WH_ID);
  });

  it('generates no topRecommendations when all analyses are empty and efficiency is not improving', async () => {
    setupAllAnalyses({
      standard: {
        suggestions: [],
        currentEfficiency: 50,
        projectedEfficiency: 50,
      },
    });

    const result = await generateAiSlottingSummary(WH_ID);
    expect(result.topRecommendations).toHaveLength(0);
  });
});
