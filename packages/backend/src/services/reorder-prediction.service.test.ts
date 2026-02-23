import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { log } from '../config/logger.js';
import {
  generateReorderPredictions,
  getWarehousePredictions,
  autoUpdateReorderPoints,
} from './reorder-prediction.service.js';
import type { ReorderPrediction } from './reorder-prediction.service.js';

const mockedLog = log as ReturnType<typeof vi.fn>;

// ── Constants (mirror CONFIG in service) ────────────────────────────────

const ANALYSIS_WINDOW = 90;
const Z_SCORE = 1.65;
const DEFAULT_LEAD_TIME = 14;
const CRITICAL_DAYS = 7;
const WARNING_DAYS = 21;
const DEFAULT_ORDER_COST = 500;
const HOLDING_COST_PCT = 0.2;

// ── Helpers ─────────────────────────────────────────────────────────────

function makeConsumptionRow(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item-1',
    itemCode: 'ITM-001',
    itemDescription: 'Test Item',
    warehouseId: 'wh-1',
    warehouseName: 'Main Warehouse',
    currentStock: 1000,
    reservedQty: 100,
    reorderPoint: null as number | null,
    avgDaily: 10,
    stddevDaily: 3,
    totalIssued: 900,
    activeDays: 60,
    ...overrides,
  };
}

function makeLeadTimeResult(avgDays: number | null = 7) {
  return [{ avg_lead_days: avgDays }];
}

/**
 * Set up $queryRaw to return consumption stats on the first call
 * and lead time results for subsequent calls.
 * N items => call 0 = consumption, calls 1..N = lead times.
 */
function setupQueryRaw(consumptionRows: ReturnType<typeof makeConsumptionRow>[], leadTimes: (number | null)[] = []) {
  let callIndex = 0;
  mockPrisma.$queryRaw.mockImplementation(async () => {
    const idx = callIndex++;
    if (idx === 0) return consumptionRows;
    // Lead time calls: use provided value or default
    const ltIdx = idx - 1;
    const avgDays = ltIdx < leadTimes.length ? leadTimes[ltIdx] : 7;
    return makeLeadTimeResult(avgDays);
  });
}

// ── Setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.assign(mockPrisma, createPrismaMock());
});

// =========================================================================
// generateReorderPredictions
// =========================================================================

describe('generateReorderPredictions', () => {
  it('should return empty array when no consumption data exists', async () => {
    setupQueryRaw([]);

    const results = await generateReorderPredictions();

    expect(results).toEqual([]);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when consumption stats query fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB connection failed'));

    const results = await generateReorderPredictions();

    expect(results).toEqual([]);
    expect(mockedLog).toHaveBeenCalledWith('warn', expect.stringContaining('Consumption stats query failed'));
  });

  it('should generate prediction for a single item', async () => {
    const row = makeConsumptionRow();
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results).toHaveLength(1);
    expect(results[0].itemId).toBe('item-1');
    expect(results[0].itemCode).toBe('ITM-001');
    expect(results[0].warehouseId).toBe('wh-1');
    // $queryRaw: 1 consumption + 1 lead time = 2
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('should calculate avgDailyConsumption as totalIssued / analysisWindowDays', async () => {
    const row = makeConsumptionRow({ totalIssued: 450, activeDays: 30 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    // ADC = 450 / 90 = 5
    expect(results[0].avgDailyConsumption).toBe(5);
  });

  it('should calculate effectiveStock as currentStock - reservedQty', async () => {
    const row = makeConsumptionRow({ currentStock: 500, reservedQty: 200 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].effectiveStock).toBe(300);
  });

  it('should calculate safetyStock and reorderPoint correctly', async () => {
    // stddevDaily = 4, leadTime = 9
    // safetyStock = 1.65 * 4 * sqrt(9) = 1.65 * 4 * 3 = 19.8
    // ADC = 360 / 90 = 4
    // reorderPoint = ceil(4 * 9 + 19.8) = ceil(55.8) = 56
    const row = makeConsumptionRow({ totalIssued: 360, stddevDaily: 4 });
    setupQueryRaw([row], [9]);

    const results = await generateReorderPredictions();

    const adc = 360 / ANALYSIS_WINDOW; // 4
    const safety = Z_SCORE * 4 * Math.sqrt(9); // 19.8
    const expected = Math.ceil(adc * 9 + safety); // ceil(55.8) = 56
    expect(results[0].reorderPoint).toBe(expected);
    expect(results[0].estimatedLeadTimeDays).toBe(9);
    expect(results[0].stdDevDailyConsumption).toBe(4);
  });

  it('should calculate daysUntilStockout from effective stock and ADC', async () => {
    // effectiveStock = 1000 - 100 = 900, ADC = 900/90 = 10
    // daysUntilStockout = floor(900 / 10) = 90
    const row = makeConsumptionRow({ currentStock: 1000, reservedQty: 100, totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBe(90);
  });

  it('should return null daysUntilStockout when avgDailyConsumption is 0', async () => {
    const row = makeConsumptionRow({ totalIssued: 0, stddevDaily: 0 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBeNull();
    expect(results[0].predictedStockoutDate).toBeNull();
  });

  it('should clamp daysUntilStockout to 0 when effective stock is negative', async () => {
    // effectiveStock = 50 - 200 = -150, ADC = 900/90 = 10
    // daysUntilStockout = max(0, floor(-150/10)) = 0
    const row = makeConsumptionRow({ currentStock: 50, reservedQty: 200, totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBe(0);
    expect(results[0].effectiveStock).toBe(-150);
  });

  it('should set predictedStockoutDate based on daysUntilStockout', async () => {
    const row = makeConsumptionRow({ currentStock: 200, reservedQty: 0, totalIssued: 90 });
    setupQueryRaw([row], [7]);

    const before = Date.now();
    const results = await generateReorderPredictions();
    const after = Date.now();

    // ADC = 90/90 = 1, effectiveStock = 200, days = 200
    expect(results[0].daysUntilStockout).toBe(200);
    expect(results[0].predictedStockoutDate).toBeInstanceOf(Date);

    const expectedMin = before + 200 * 86400000;
    const expectedMax = after + 200 * 86400000;
    const actual = results[0].predictedStockoutDate!.getTime();
    expect(actual).toBeGreaterThanOrEqual(expectedMin);
    expect(actual).toBeLessThanOrEqual(expectedMax);
  });

  it('should calculate EOQ based on annual demand', async () => {
    // ADC = 900/90 = 10, annualDemand = 10 * 365 = 3650
    // EOQ = ceil(sqrt(2 * 3650 * 500 / (0.2 * (500/3650))))
    const row = makeConsumptionRow({ totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    const adc = 900 / ANALYSIS_WINDOW;
    const annualDemand = adc * 365;
    const unitCost = DEFAULT_ORDER_COST / annualDemand || 1;
    const expectedEoq = Math.ceil(Math.sqrt((2 * annualDemand * DEFAULT_ORDER_COST) / (HOLDING_COST_PCT * unitCost)));
    // suggestedOrderQty = max(eoq, reorderPoint)
    expect(results[0].suggestedOrderQty).toBeGreaterThanOrEqual(expectedEoq);
  });

  it('should use reorderPoint * 2 as EOQ fallback when no annual demand', async () => {
    const row = makeConsumptionRow({ totalIssued: 0, stddevDaily: 0 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    // ADC = 0, annualDemand = 0, so eoq = reorderPoint * 2
    // reorderPoint = ceil(0 * 7 + 0) = 0
    // suggestedOrderQty = max(0, 0) = 0
    expect(results[0].suggestedOrderQty).toBe(0);
  });

  // ── Urgency classification ────────────────────────────────────────────

  it('should classify as critical when daysUntilStockout <= 7', async () => {
    // effectiveStock = 50, ADC = 900/90 = 10, days = floor(50/10) = 5
    const row = makeConsumptionRow({ currentStock: 150, reservedQty: 100, totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBe(5);
    expect(results[0].urgency).toBe('critical');
  });

  it('should classify as critical when daysUntilStockout is exactly 7', async () => {
    // effectiveStock = 70, ADC = 900/90 = 10, days = floor(70/10) = 7
    const row = makeConsumptionRow({ currentStock: 170, reservedQty: 100, totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBe(7);
    expect(results[0].urgency).toBe('critical');
  });

  it('should classify as warning when daysUntilStockout is between 8 and 21', async () => {
    // effectiveStock = 150, ADC = 900/90 = 10, days = floor(150/10) = 15
    const row = makeConsumptionRow({ currentStock: 250, reservedQty: 100, totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBe(15);
    expect(results[0].urgency).toBe('warning');
  });

  it('should classify as warning when daysUntilStockout is exactly 21', async () => {
    // effectiveStock = 210, ADC = 900/90 = 10, days = floor(210/10) = 21
    const row = makeConsumptionRow({ currentStock: 310, reservedQty: 100, totalIssued: 900 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBe(21);
    expect(results[0].urgency).toBe('warning');
  });

  it('should classify as ok when daysUntilStockout > 21 and above reorder point', async () => {
    // effectiveStock = 5000, ADC = 90/90 = 1, days = 5000
    const row = makeConsumptionRow({
      currentStock: 5000,
      reservedQty: 0,
      totalIssued: 90,
      stddevDaily: 0.5,
    });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBeGreaterThan(WARNING_DAYS);
    expect(results[0].urgency).toBe('ok');
  });

  it('should classify as warning when effectiveStock <= reorderPoint even if days > 21', async () => {
    // ADC = 45/90 = 0.5, leadTime = 14
    // safetyStock = 1.65 * 2 * sqrt(14) ~= 12.35
    // reorderPoint = ceil(0.5 * 14 + 12.35) = ceil(19.35) = 20
    // effectiveStock = 20 - 5 = 15, days = floor(15/0.5) = 30 (> 21)
    // BUT effectiveStock (15) <= reorderPoint (20) => warning
    const row = makeConsumptionRow({
      currentStock: 20,
      reservedQty: 5,
      totalIssued: 45,
      stddevDaily: 2,
    });
    setupQueryRaw([row], [14]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBeGreaterThan(WARNING_DAYS);
    expect(results[0].effectiveStock).toBeLessThanOrEqual(results[0].reorderPoint);
    expect(results[0].urgency).toBe('warning');
  });

  it('should classify as ok for null daysUntilStockout (no consumption) with stock above reorder point', async () => {
    const row = makeConsumptionRow({
      currentStock: 100,
      reservedQty: 0,
      totalIssued: 0,
      stddevDaily: 0,
    });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].daysUntilStockout).toBeNull();
    expect(results[0].urgency).toBe('ok');
  });

  // ── Sorting ───────────────────────────────────────────────────────────

  it('should sort predictions: critical first, then warning, then ok', async () => {
    const rows = [
      makeConsumptionRow({ itemId: 'ok-item', currentStock: 10000, reservedQty: 0, totalIssued: 90, stddevDaily: 0.5 }),
      makeConsumptionRow({
        itemId: 'critical-item',
        currentStock: 150,
        reservedQty: 100,
        totalIssued: 900,
        stddevDaily: 3,
      }),
      makeConsumptionRow({
        itemId: 'warning-item',
        currentStock: 250,
        reservedQty: 100,
        totalIssued: 900,
        stddevDaily: 3,
      }),
    ];
    setupQueryRaw(rows, [7, 7, 7]);

    const results = await generateReorderPredictions();

    expect(results).toHaveLength(3);
    expect(results[0].urgency).toBe('critical');
    expect(results[0].itemId).toBe('critical-item');
    expect(results[1].urgency).toBe('warning');
    expect(results[1].itemId).toBe('warning-item');
    expect(results[2].urgency).toBe('ok');
    expect(results[2].itemId).toBe('ok-item');
  });

  it('should sort by daysUntilStockout within same urgency level', async () => {
    const rows = [
      makeConsumptionRow({ itemId: 'crit-5', currentStock: 150, reservedQty: 100, totalIssued: 900 }),
      makeConsumptionRow({ itemId: 'crit-2', currentStock: 120, reservedQty: 100, totalIssued: 900 }),
    ];
    setupQueryRaw(rows, [7, 7]);

    const results = await generateReorderPredictions();

    // Both critical, crit-2 has fewer days (effectiveStock=20 => days=2)
    expect(results[0].itemId).toBe('crit-2');
    expect(results[1].itemId).toBe('crit-5');
  });

  // ── Lead time fallback ────────────────────────────────────────────────

  it('should use default lead time (14 days) when no historical GRN data', async () => {
    const row = makeConsumptionRow();
    setupQueryRaw([row], [null]);

    const results = await generateReorderPredictions();

    expect(results[0].estimatedLeadTimeDays).toBe(DEFAULT_LEAD_TIME);
  });

  it('should use default lead time when lead time query fails', async () => {
    const row = makeConsumptionRow();
    let callIndex = 0;
    mockPrisma.$queryRaw.mockImplementation(async () => {
      const idx = callIndex++;
      if (idx === 0) return [row];
      throw new Error('Lead time query failed');
    });

    const results = await generateReorderPredictions();

    expect(results[0].estimatedLeadTimeDays).toBe(DEFAULT_LEAD_TIME);
  });

  // ── Multiple items ────────────────────────────────────────────────────

  it('should make N+1 $queryRaw calls for N items (1 consumption + N lead times)', async () => {
    const rows = [
      makeConsumptionRow({ itemId: 'item-1' }),
      makeConsumptionRow({ itemId: 'item-2' }),
      makeConsumptionRow({ itemId: 'item-3' }),
    ];
    setupQueryRaw(rows, [5, 10, 15]);

    await generateReorderPredictions();

    // 1 consumption query + 3 lead time queries = 4
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);
  });

  it('should preserve currentReorderPoint from consumption stats', async () => {
    const row = makeConsumptionRow({ reorderPoint: 42 });
    setupQueryRaw([row], [7]);

    const results = await generateReorderPredictions();

    expect(results[0].currentReorderPoint).toBe(42);
  });

  it('should log prediction count and critical count', async () => {
    const rows = [
      makeConsumptionRow({ itemId: 'crit', currentStock: 150, reservedQty: 100, totalIssued: 900 }),
      makeConsumptionRow({ itemId: 'ok', currentStock: 10000, reservedQty: 0, totalIssued: 90 }),
    ];
    setupQueryRaw(rows, [7, 7]);

    await generateReorderPredictions();

    expect(mockedLog).toHaveBeenCalledWith('info', expect.stringContaining('2 predictions'));
    expect(mockedLog).toHaveBeenCalledWith('info', expect.stringContaining('1 critical'));
  });
});

// =========================================================================
// getWarehousePredictions
// =========================================================================

describe('getWarehousePredictions', () => {
  it('should filter predictions by warehouseId', async () => {
    const rows = [
      makeConsumptionRow({ itemId: 'item-a', warehouseId: 'wh-1' }),
      makeConsumptionRow({ itemId: 'item-b', warehouseId: 'wh-2' }),
      makeConsumptionRow({ itemId: 'item-c', warehouseId: 'wh-1' }),
    ];
    setupQueryRaw(rows, [7, 7, 7]);

    const results = await getWarehousePredictions('wh-1');

    expect(results).toHaveLength(2);
    expect(results.every(r => r.warehouseId === 'wh-1')).toBe(true);
  });

  it('should return empty array when no items match the warehouse', async () => {
    const rows = [makeConsumptionRow({ warehouseId: 'wh-1' })];
    setupQueryRaw(rows, [7]);

    const results = await getWarehousePredictions('wh-nonexistent');

    expect(results).toEqual([]);
  });

  it('should return empty array when there are no predictions at all', async () => {
    setupQueryRaw([]);

    const results = await getWarehousePredictions('wh-1');

    expect(results).toEqual([]);
  });
});

// =========================================================================
// autoUpdateReorderPoints
// =========================================================================

describe('autoUpdateReorderPoints', () => {
  it('should update reorder point when currentReorderPoint is null', async () => {
    const row = makeConsumptionRow({ totalIssued: 900, reorderPoint: null });
    setupQueryRaw([row], [7]);
    mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

    const result = await autoUpdateReorderPoints();

    expect(result.updated).toBe(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith({
      where: { itemId: 'item-1', warehouseId: 'wh-1' },
      data: { reorderPoint: expect.any(Number) },
    });
  });

  it('should update when difference exceeds 20%', async () => {
    // current reorder point = 100
    // new reorder point will be much higher due to consumption
    // ADC = 900/90 = 10, leadTime = 7
    // safety = 1.65 * 3 * sqrt(7) ~= 13.1
    // reorderPoint = ceil(10 * 7 + 13.1) = ceil(83.1) = 84
    // |84 - 100| / 100 = 0.16 => NOT >0.2 threshold
    // Use different values to ensure >20% diff
    // ADC = 1800/90 = 20, leadTime = 14
    // safety = 1.65 * 5 * sqrt(14) ~= 30.87
    // reorderPoint = ceil(20 * 14 + 30.87) = ceil(310.87) = 311
    // |311 - 100| / 100 = 2.11 => >0.2
    const row = makeConsumptionRow({
      totalIssued: 1800,
      stddevDaily: 5,
      reorderPoint: 100,
    });
    setupQueryRaw([row], [14]);
    mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

    const result = await autoUpdateReorderPoints();

    expect(result.updated).toBe(1);
  });

  it('should NOT update when difference is within 20%', async () => {
    // We need calculated reorderPoint to be within 20% of currentReorderPoint
    // ADC = 900/90 = 10, leadTime = 7
    // safety = 1.65 * 3 * sqrt(7) ~= 13.1
    // reorderPoint = ceil(10*7 + 13.1) = ceil(83.1) = 84
    // Set current to 84 => diff = 0 => no update
    const row = makeConsumptionRow({
      totalIssued: 900,
      stddevDaily: 3,
      reorderPoint: 84,
    });
    setupQueryRaw([row], [7]);

    const result = await autoUpdateReorderPoints();

    expect(result.updated).toBe(0);
    expect(mockPrisma.inventoryLevel.updateMany).not.toHaveBeenCalled();
  });

  it('should skip items with zero consumption', async () => {
    const row = makeConsumptionRow({ totalIssued: 0, stddevDaily: 0, reorderPoint: null });
    setupQueryRaw([row], [7]);

    const result = await autoUpdateReorderPoints();

    expect(result.updated).toBe(0);
    expect(mockPrisma.inventoryLevel.updateMany).not.toHaveBeenCalled();
  });

  it('should handle updateMany failure gracefully (non-critical)', async () => {
    const row = makeConsumptionRow({ totalIssued: 900, reorderPoint: null });
    setupQueryRaw([row], [7]);
    mockPrisma.inventoryLevel.updateMany.mockRejectedValue(new Error('DB write failed'));

    const result = await autoUpdateReorderPoints();

    // Failure is swallowed, updated stays 0
    expect(result.updated).toBe(0);
    expect(result.total).toBe(1);
  });

  it('should update multiple items that qualify', async () => {
    const rows = [
      makeConsumptionRow({ itemId: 'i1', totalIssued: 900, reorderPoint: null }),
      makeConsumptionRow({ itemId: 'i2', totalIssued: 450, reorderPoint: null }),
      makeConsumptionRow({ itemId: 'i3', totalIssued: 0, stddevDaily: 0, reorderPoint: null }), // skipped: zero consumption
    ];
    setupQueryRaw(rows, [7, 7, 7]);
    mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

    const result = await autoUpdateReorderPoints();

    // i1 and i2 updated (null reorder point), i3 skipped (no consumption)
    expect(result.updated).toBe(2);
    expect(result.total).toBe(3);
    expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledTimes(2);
  });

  it('should return total count of all predictions', async () => {
    setupQueryRaw([]);

    const result = await autoUpdateReorderPoints();

    expect(result).toEqual({ updated: 0, total: 0 });
  });

  it('should log the update summary', async () => {
    const row = makeConsumptionRow({ totalIssued: 900, reorderPoint: null });
    setupQueryRaw([row], [7]);
    mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

    await autoUpdateReorderPoints();

    expect(mockedLog).toHaveBeenCalledWith('info', expect.stringContaining('Auto-updated 1/1'));
  });
});
