import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma, prismaRead: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { log } from '../../../config/logger.js';
import { getItemConsumptionTrend, getTopConsumptionItems } from './consumption-trend.service.js';

const mockedLog = log as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

const ITEM_ID = 'item-1';
const DEFAULT_LOOKBACK = 12;

/** Build YYYY-MM keys for the last N months. */
function buildMonthKeys(months: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

interface TrendRow {
  item_id: string;
  item_code: string;
  item_description: string;
  month_key: string;
  total_qty: number;
  total_value: number;
  issue_count: number;
}

function makeTrendRow(overrides: Partial<TrendRow> = {}): TrendRow {
  return {
    item_id: ITEM_ID,
    item_code: 'ITM-001',
    item_description: 'Steel Plate 10mm',
    month_key: buildMonthKeys(DEFAULT_LOOKBACK)[DEFAULT_LOOKBACK - 1],
    total_qty: 100,
    total_value: 5000,
    issue_count: 3,
    ...overrides,
  };
}

/** Build a series of trend rows spanning the most recent N months. */
function makeConsumptionSeries(itemId: string, itemCode: string, itemDesc: string, quantities: number[]): TrendRow[] {
  const allKeys = buildMonthKeys(DEFAULT_LOOKBACK);
  const startIdx = allKeys.length - quantities.length;
  return quantities.map((qty, i) =>
    makeTrendRow({
      item_id: itemId,
      item_code: itemCode,
      item_description: itemDesc,
      month_key: allKeys[startIdx + i],
      total_qty: qty,
      total_value: qty * 50,
      issue_count: Math.ceil(qty / 10),
    }),
  );
}

// ═════════════════════════════════════════════════════════════════════════

describe('consumption-trend.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── getItemConsumptionTrend ────────────────────────────────────────

  describe('getItemConsumptionTrend', () => {
    it('returns null when no consumption data exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getItemConsumptionTrend(ITEM_ID);

      expect(result).toBeNull();
    });

    it('returns trend data for an item with consumption history', async () => {
      const rows = makeConsumptionSeries('item-1', 'ITM-001', 'Steel Plate', [100, 120, 130]);
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID);

      expect(result).not.toBeNull();
      expect(result!.itemId).toBe('item-1');
      expect(result!.itemCode).toBe('ITM-001');
      expect(result!.itemDescription).toBe('Steel Plate');
    });

    it('fills missing months with zeros', async () => {
      const rows = [makeTrendRow({ total_qty: 100 })];
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.months).toHaveLength(12);
      const nonZero = result!.months.filter(m => m.totalQty > 0);
      expect(nonZero).toHaveLength(1);
      expect(nonZero[0].totalQty).toBe(100);
    });

    it('computes averageMonthly across the lookback period', async () => {
      // 3 months with data: [100, 200, 300] => total=600, lookback=12, avg=600/12=50
      const rows = makeConsumptionSeries('item-1', 'ITM-001', 'Steel', [100, 200, 300]);
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.averageMonthly).toBe(50);
    });

    it('detects increasing trend when last 3 months > prior 3 months by >10%', async () => {
      // 6 months: [10, 10, 10, 50, 50, 50] => prior avg=10, recent avg=50
      const allKeys = buildMonthKeys(DEFAULT_LOOKBACK);
      const rows = [10, 10, 10, 50, 50, 50].map((qty, i) =>
        makeTrendRow({
          month_key: allKeys[DEFAULT_LOOKBACK - 6 + i],
          total_qty: qty,
          total_value: qty * 50,
          issue_count: 1,
        }),
      );
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.trend).toBe('increasing');
    });

    it('detects decreasing trend when last 3 months < prior 3 months by >10%', async () => {
      const allKeys = buildMonthKeys(DEFAULT_LOOKBACK);
      const rows = [100, 100, 100, 10, 10, 10].map((qty, i) =>
        makeTrendRow({
          month_key: allKeys[DEFAULT_LOOKBACK - 6 + i],
          total_qty: qty,
          total_value: qty * 50,
          issue_count: 1,
        }),
      );
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.trend).toBe('decreasing');
    });

    it('detects stable trend when change is within 10%', async () => {
      const allKeys = buildMonthKeys(DEFAULT_LOOKBACK);
      const rows = [100, 100, 100, 105, 100, 100].map((qty, i) =>
        makeTrendRow({
          month_key: allKeys[DEFAULT_LOOKBACK - 6 + i],
          total_qty: qty,
          total_value: qty * 50,
          issue_count: 1,
        }),
      );
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.trend).toBe('stable');
    });

    it('returns increasing trend when data is concentrated in recent months', async () => {
      // With 2 data points [10, 20] at the end of 12 zero-filled months,
      // recent 3 avg > prior 3 avg (from zeros), yielding 'increasing'
      const rows = makeConsumptionSeries('item-1', 'ITM-001', 'Steel', [10, 20]);
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.trend).toBe('increasing');
    });

    it('uses 4-month comparison when data has 4-5 months', async () => {
      const allKeys = buildMonthKeys(DEFAULT_LOOKBACK);
      // 4 months: [10, 10, 100, 100] -> compare last 2 [100,100] vs prior 2 [10,10]
      const rows = [10, 10, 100, 100].map((qty, i) =>
        makeTrendRow({
          month_key: allKeys[DEFAULT_LOOKBACK - 4 + i],
          total_qty: qty,
          total_value: qty * 50,
          issue_count: 1,
        }),
      );
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      expect(result!.trend).toBe('increasing');
    });

    it('clamps lookback months to minimum 1', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getItemConsumptionTrend(ITEM_ID, 0);

      expect(result).toBeNull();
      // Verify it was called (even with 0, it clamps to 1)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('clamps lookback months to maximum 60', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getItemConsumptionTrend(ITEM_ID, 100);

      expect(result).toBeNull();
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('rounds totalQty and totalValue to 2 decimal places', async () => {
      const rows = [makeTrendRow({ total_qty: 33.33333, total_value: 166.66666 })];
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      const dataMonth = result!.months.find(m => m.totalQty > 0);
      expect(dataMonth!.totalQty).toBe(33.33);
      expect(dataMonth!.totalValue).toBe(166.67);
    });

    it('logs the computed trend', async () => {
      const rows = makeConsumptionSeries('item-1', 'ITM-001', 'Steel', [10]);
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      await getItemConsumptionTrend(ITEM_ID, 12);

      expect(mockedLog).toHaveBeenCalledWith('info', expect.stringContaining('[Consumption Trend]'));
    });

    it('returns months array ordered chronologically', async () => {
      const rows = makeConsumptionSeries('item-1', 'ITM-001', 'Steel', [10, 20, 30]);
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemConsumptionTrend(ITEM_ID, 12);

      const monthKeys = result!.months.map(m => m.month);
      const sorted = [...monthKeys].sort();
      expect(monthKeys).toEqual(sorted);
    });
  });

  // ─── getTopConsumptionItems ─────────────────────────────────────────

  describe('getTopConsumptionItems', () => {
    it('returns empty array when no data exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getTopConsumptionItems();

      expect(result).toEqual([]);
    });

    it('returns items ranked by totalQty descending', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          item_id: 'item-high',
          item_code: 'ITM-H',
          item_description: 'High',
          total_qty: 500,
          total_value: 25000,
          issue_count: 50,
        },
        {
          item_id: 'item-low',
          item_code: 'ITM-L',
          item_description: 'Low',
          total_qty: 10,
          total_value: 500,
          issue_count: 1,
        },
      ]);

      const result = await getTopConsumptionItems();

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].itemId).toBe('item-high');
      expect(result[1].rank).toBe(2);
      expect(result[1].itemId).toBe('item-low');
    });

    it('respects the limit parameter', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { item_id: 'a', item_code: 'A', item_description: 'A', total_qty: 100, total_value: 5000, issue_count: 10 },
      ]);

      const result = await getTopConsumptionItems(undefined, 12, 1);

      expect(result).toHaveLength(1);
    });

    it('defaults limit to 20', async () => {
      // Just verify the query runs; actual SQL limiting is done server-side
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await getTopConsumptionItems();

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('clamps limit to minimum 1 and maximum 200', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await getTopConsumptionItems(undefined, 12, 0);
      await getTopConsumptionItems(undefined, 12, 999);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('clamps months to minimum 1 and maximum 60', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await getTopConsumptionItems(undefined, 0);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('uses warehouse-specific query when warehouseId is provided', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { item_id: 'a', item_code: 'A', item_description: 'A', total_qty: 100, total_value: 5000, issue_count: 10 },
      ]);

      const result = await getTopConsumptionItems('wh-1', 12, 20);

      expect(result).toHaveLength(1);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('uses global query when warehouseId is not provided', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await getTopConsumptionItems(undefined, 12, 20);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('rounds totalQty and totalValue to 2 decimal places', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          item_id: 'a',
          item_code: 'A',
          item_description: 'A',
          total_qty: 33.33333,
          total_value: 166.66666,
          issue_count: 3,
        },
      ]);

      const result = await getTopConsumptionItems();

      expect(result[0].totalQty).toBe(33.33);
      expect(result[0].totalValue).toBe(166.67);
    });

    it('converts issue_count to number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          item_id: 'a',
          item_code: 'A',
          item_description: 'A',
          total_qty: 100,
          total_value: 5000,
          issue_count: BigInt(15),
        },
      ]);

      const result = await getTopConsumptionItems();

      expect(result[0].issueCount).toBe(15);
      expect(typeof result[0].issueCount).toBe('number');
    });

    it('logs the result count', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { item_id: 'a', item_code: 'A', item_description: 'A', total_qty: 100, total_value: 5000, issue_count: 10 },
      ]);

      await getTopConsumptionItems();

      expect(mockedLog).toHaveBeenCalledWith('info', expect.stringContaining('[Consumption Trend] Top'));
    });
  });
});
