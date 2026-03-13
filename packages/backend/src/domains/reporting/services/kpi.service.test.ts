import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma, prismaRead: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { Prisma } from '@prisma/client';
import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { getComprehensiveKpis, getKpisByCategory } from './kpi.service.js';
import type { KpiCategory } from './kpi.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Since getComprehensiveKpis runs 15 sub-calculations in parallel via Promise.all,
 * $queryRaw calls happen in non-deterministic order. We use a single mock that
 * returns a generic result structure that satisfies all sub-query shapes.
 * Each sub-query expects differently-keyed rows, so we return an object with all
 * possible keys. Prisma $queryRaw results are just rows, so unused keys are ignored.
 */
function setupDefaultMocks() {
  // $queryRaw returns a generic row that covers all sub-query result shapes
  mockPrisma.$queryRaw.mockResolvedValue([
    {
      total: 100000,
      accurate: BigInt(90),
      count: BigInt(5),
      occupied: BigInt(75),
      capacity: BigInt(100),
      avg_hours: 24,
      on_time: BigInt(8),
      received: 950,
      ordered: 1000,
      completed: BigInt(15),
      passed: BigInt(45),
      dr_count: BigInt(5),
      grn_lines: BigInt(100),
    },
  ]);

  // mirv.count is called twice (current + prior) for inventoryTurnover
  mockPrisma.mirv.count.mockResolvedValueOnce(50).mockResolvedValueOnce(40);

  // jobOrder.aggregate is called 3 times:
  // pendingApprovalValue, monthlySpend current, monthlySpend prior
  mockPrisma.jobOrder.aggregate
    .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(50000) } })
    .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(200000) } })
    .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(180000) } });
}

const DATE_FROM = new Date('2025-01-01');
const DATE_TO = new Date('2025-01-31');

// ═════════════════════════════════════════════════════════════════════════

describe('kpi.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── getComprehensiveKpis ───────────────────────────────────────────

  describe('getComprehensiveKpis', () => {
    it('returns all 15 KPIs grouped into 5 categories', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // Inventory category (4 KPIs)
      expect(result.inventory.inventoryTurnover).toBeDefined();
      expect(result.inventory.stockAccuracy).toBeDefined();
      expect(result.inventory.deadStock).toBeDefined();
      expect(result.inventory.warehouseUtilization).toBeDefined();

      // Procurement category (3 KPIs)
      expect(result.procurement.grnProcessingTime).toBeDefined();
      expect(result.procurement.supplierOnTimeDelivery).toBeDefined();
      expect(result.procurement.poFulfillmentRate).toBeDefined();

      // Logistics category (3 KPIs)
      expect(result.logistics.joCompletionRate).toBeDefined();
      expect(result.logistics.joAvgResponseTime).toBeDefined();
      expect(result.logistics.gatePassTurnaround).toBeDefined();

      // Quality category (3 KPIs)
      expect(result.quality.qciPassRate).toBeDefined();
      expect(result.quality.drResolutionTime).toBeDefined();
      expect(result.quality.ncrRate).toBeDefined();

      // Financial category (2 KPIs)
      expect(result.financial.pendingApprovalValue).toBeDefined();
      expect(result.financial.monthlySpend).toBeDefined();
    });

    it('each KPI has value, trend, label, and unit properties', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      const kpi = result.inventory.inventoryTurnover;
      expect(typeof kpi.value).toBe('number');
      expect(typeof kpi.trend).toBe('number');
      expect(typeof kpi.label).toBe('string');
      expect(typeof kpi.unit).toBe('string');
    });

    it('has correct labels for all KPIs', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      expect(result.inventory.inventoryTurnover.label).toBe('Inventory Turnover');
      expect(result.inventory.stockAccuracy.label).toBe('Stock Accuracy');
      expect(result.inventory.deadStock.label).toBe('Dead Stock Items');
      expect(result.inventory.warehouseUtilization.label).toBe('Warehouse Utilization');
      expect(result.procurement.grnProcessingTime.label).toBe('GRN Processing Time');
      expect(result.procurement.supplierOnTimeDelivery.label).toBe('On-Time Delivery');
      expect(result.procurement.poFulfillmentRate.label).toBe('PO Fulfillment Rate');
      expect(result.logistics.joCompletionRate.label).toBe('JO Completion Rate');
      expect(result.logistics.joAvgResponseTime.label).toBe('JO Avg Response Time');
      expect(result.logistics.gatePassTurnaround.label).toBe('Gate Pass Turnaround');
      expect(result.quality.qciPassRate.label).toBe('QCI Pass Rate');
      expect(result.quality.drResolutionTime.label).toBe('DR Resolution Time');
      expect(result.quality.ncrRate.label).toBe('NCR Rate');
      expect(result.financial.pendingApprovalValue.label).toBe('Pending Approval Value');
      expect(result.financial.monthlySpend.label).toBe('Monthly Spend');
    });

    it('has correct units for all KPIs', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      expect(result.inventory.inventoryTurnover.unit).toBe('ratio');
      expect(result.inventory.stockAccuracy.unit).toBe('%');
      expect(result.inventory.deadStock.unit).toBe('items');
      expect(result.inventory.warehouseUtilization.unit).toBe('%');
      expect(result.procurement.grnProcessingTime.unit).toBe('hours');
      expect(result.procurement.supplierOnTimeDelivery.unit).toBe('%');
      expect(result.procurement.poFulfillmentRate.unit).toBe('%');
      expect(result.logistics.joCompletionRate.unit).toBe('%');
      expect(result.logistics.joAvgResponseTime.unit).toBe('hours');
      expect(result.logistics.gatePassTurnaround.unit).toBe('hours');
      expect(result.quality.qciPassRate.unit).toBe('%');
      expect(result.quality.drResolutionTime.unit).toBe('hours');
      expect(result.quality.ncrRate.unit).toBe('%');
      expect(result.financial.pendingApprovalValue.unit).toBe('SAR');
      expect(result.financial.monthlySpend.unit).toBe('SAR');
    });

    it('sets trend to 0 for point-in-time KPIs', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      expect(result.inventory.stockAccuracy.trend).toBe(0);
      expect(result.inventory.deadStock.trend).toBe(0);
      expect(result.inventory.warehouseUtilization.trend).toBe(0);
      expect(result.financial.pendingApprovalValue.trend).toBe(0);
    });

    it('returns numeric values for all KPIs', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // Check every KPI value is a finite number
      const allKpis = [
        result.inventory.inventoryTurnover,
        result.inventory.stockAccuracy,
        result.inventory.deadStock,
        result.inventory.warehouseUtilization,
        result.procurement.grnProcessingTime,
        result.procurement.supplierOnTimeDelivery,
        result.procurement.poFulfillmentRate,
        result.logistics.joCompletionRate,
        result.logistics.joAvgResponseTime,
        result.logistics.gatePassTurnaround,
        result.quality.qciPassRate,
        result.quality.drResolutionTime,
        result.quality.ncrRate,
        result.financial.pendingApprovalValue,
        result.financial.monthlySpend,
      ];

      allKpis.forEach(kpi => {
        expect(Number.isFinite(kpi.value)).toBe(true);
        expect(Number.isFinite(kpi.trend)).toBe(true);
      });
    });

    it('defaults date range to current month when not provided', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis();

      expect(result).toBeDefined();
      expect(result.inventory).toBeDefined();
      expect(result.procurement).toBeDefined();
      expect(result.logistics).toBeDefined();
      expect(result.quality).toBeDefined();
      expect(result.financial).toBeDefined();
    });

    it('calls mirv.count for inventory turnover calculation', async () => {
      setupDefaultMocks();

      await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // mirv.count is called at least twice (current + prior)
      expect(mockPrisma.mirv.count).toHaveBeenCalledTimes(2);
    });

    it('calls jobOrder.aggregate for financial KPIs', async () => {
      setupDefaultMocks();

      await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // pendingApprovalValue + monthlySpend (current + prior) = at least 3 calls
      expect(mockPrisma.jobOrder.aggregate).toHaveBeenCalled();
    });

    it('calls $queryRaw for raw SQL calculations', async () => {
      setupDefaultMocks();

      await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // Many sub-queries use $queryRaw
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('handles zero denominators safely (no NaN or Infinity)', async () => {
      // All $queryRaw results return zero values
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total: 0,
          accurate: BigInt(0),
          count: BigInt(0),
          occupied: BigInt(0),
          capacity: BigInt(0),
          avg_hours: 0,
          on_time: BigInt(0),
          received: 0,
          ordered: 0,
          completed: BigInt(0),
          passed: BigInt(0),
          dr_count: BigInt(0),
          grn_lines: BigInt(0),
        },
      ]);
      mockPrisma.mirv.count.mockResolvedValue(0);
      mockPrisma.jobOrder.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
      });

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // All values should be finite (no NaN or Infinity)
      const allKpis = [
        result.inventory.inventoryTurnover,
        result.inventory.stockAccuracy,
        result.inventory.deadStock,
        result.inventory.warehouseUtilization,
        result.procurement.grnProcessingTime,
        result.procurement.supplierOnTimeDelivery,
        result.procurement.poFulfillmentRate,
        result.logistics.joCompletionRate,
        result.logistics.joAvgResponseTime,
        result.logistics.gatePassTurnaround,
        result.quality.qciPassRate,
        result.quality.drResolutionTime,
        result.quality.ncrRate,
        result.financial.pendingApprovalValue,
        result.financial.monthlySpend,
      ];

      allKpis.forEach(kpi => {
        expect(Number.isFinite(kpi.value)).toBe(true);
        expect(Number.isNaN(kpi.value)).toBe(false);
        expect(Number.isFinite(kpi.trend)).toBe(true);
        expect(Number.isNaN(kpi.trend)).toBe(false);
      });
    });

    it('returns non-negative values for percentage KPIs', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      const percentageKpis = [
        result.inventory.stockAccuracy,
        result.inventory.warehouseUtilization,
        result.procurement.supplierOnTimeDelivery,
        result.procurement.poFulfillmentRate,
        result.logistics.joCompletionRate,
        result.quality.qciPassRate,
        result.quality.ncrRate,
      ];

      percentageKpis.forEach(kpi => {
        expect(kpi.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('returns non-negative values for count/hours KPIs', async () => {
      setupDefaultMocks();

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      expect(result.inventory.deadStock.value).toBeGreaterThanOrEqual(0);
      expect(result.procurement.grnProcessingTime.value).toBeGreaterThanOrEqual(0);
      expect(result.logistics.joAvgResponseTime.value).toBeGreaterThanOrEqual(0);
      expect(result.logistics.gatePassTurnaround.value).toBeGreaterThanOrEqual(0);
      expect(result.quality.drResolutionTime.value).toBeGreaterThanOrEqual(0);
    });

    it('calculates trend for inventory turnover based on current vs prior', async () => {
      // current=50 issued, prior=40 issued => trend should be positive
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total: 100000,
          accurate: BigInt(90),
          count: BigInt(5),
          occupied: BigInt(75),
          capacity: BigInt(100),
          avg_hours: 24,
          on_time: BigInt(8),
          received: 950,
          ordered: 1000,
          completed: BigInt(15),
          passed: BigInt(45),
          dr_count: BigInt(5),
          grn_lines: BigInt(100),
        },
      ]);
      mockPrisma.mirv.count
        .mockResolvedValueOnce(50) // current
        .mockResolvedValueOnce(25); // prior (half of current)
      mockPrisma.jobOrder.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(50000) } })
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(200000) } })
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(200000) } });

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      // current > prior => positive trend
      expect(result.inventory.inventoryTurnover.trend).toBeGreaterThan(0);
    });

    it('calculates monthly spend with trend', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total: 100000,
          accurate: BigInt(90),
          count: BigInt(5),
          occupied: BigInt(75),
          capacity: BigInt(100),
          avg_hours: 24,
          on_time: BigInt(8),
          received: 950,
          ordered: 1000,
          completed: BigInt(15),
          passed: BigInt(45),
          dr_count: BigInt(5),
          grn_lines: BigInt(100),
        },
      ]);
      mockPrisma.mirv.count.mockResolvedValue(50);
      mockPrisma.jobOrder.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(50000) } })
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(200000) } }) // current
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(100000) } }); // prior (half)

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      expect(result.financial.monthlySpend.value).toBe(200000);
      // current=200000, prior=100000 => trend = ((200000-100000)/100000)*100 = 100%
      expect(result.financial.monthlySpend.trend).toBe(100);
    });

    it('returns pending approval value from jobOrder aggregate', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          total: 100000,
          accurate: BigInt(90),
          count: BigInt(5),
          occupied: BigInt(75),
          capacity: BigInt(100),
          avg_hours: 0,
          on_time: BigInt(0),
          received: 0,
          ordered: 0,
          completed: BigInt(0),
          passed: BigInt(0),
          dr_count: BigInt(0),
          grn_lines: BigInt(0),
        },
      ]);
      mockPrisma.mirv.count.mockResolvedValue(0);
      mockPrisma.jobOrder.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(75000) } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null } });

      const result = await getComprehensiveKpis(DATE_FROM, DATE_TO);

      expect(result.financial.pendingApprovalValue.value).toBe(75000);
      expect(result.financial.pendingApprovalValue.unit).toBe('SAR');
    });
  });

  // ─── getKpisByCategory ──────────────────────────────────────────────

  describe('getKpisByCategory', () => {
    it('returns only inventory KPIs when category is inventory', async () => {
      setupDefaultMocks();

      const result = await getKpisByCategory('inventory' as KpiCategory, DATE_FROM, DATE_TO);

      expect(result).toHaveProperty('inventoryTurnover');
      expect(result).toHaveProperty('stockAccuracy');
      expect(result).toHaveProperty('deadStock');
      expect(result).toHaveProperty('warehouseUtilization');
      expect(result).not.toHaveProperty('grnProcessingTime');
    });

    it('returns only procurement KPIs when category is procurement', async () => {
      setupDefaultMocks();

      const result = await getKpisByCategory('procurement' as KpiCategory, DATE_FROM, DATE_TO);

      expect(result).toHaveProperty('grnProcessingTime');
      expect(result).toHaveProperty('supplierOnTimeDelivery');
      expect(result).toHaveProperty('poFulfillmentRate');
      expect(result).not.toHaveProperty('inventoryTurnover');
    });

    it('returns only logistics KPIs when category is logistics', async () => {
      setupDefaultMocks();

      const result = await getKpisByCategory('logistics' as KpiCategory, DATE_FROM, DATE_TO);

      expect(result).toHaveProperty('joCompletionRate');
      expect(result).toHaveProperty('joAvgResponseTime');
      expect(result).toHaveProperty('gatePassTurnaround');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('returns only quality KPIs when category is quality', async () => {
      setupDefaultMocks();

      const result = await getKpisByCategory('quality' as KpiCategory, DATE_FROM, DATE_TO);

      expect(result).toHaveProperty('qciPassRate');
      expect(result).toHaveProperty('drResolutionTime');
      expect(result).toHaveProperty('ncrRate');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('returns only financial KPIs when category is financial', async () => {
      setupDefaultMocks();

      const result = await getKpisByCategory('financial' as KpiCategory, DATE_FROM, DATE_TO);

      expect(result).toHaveProperty('pendingApprovalValue');
      expect(result).toHaveProperty('monthlySpend');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('returns KPI objects with value, trend, label, and unit', async () => {
      setupDefaultMocks();

      const result = await getKpisByCategory('quality' as KpiCategory, DATE_FROM, DATE_TO);

      const kpi = result.qciPassRate;
      expect(typeof kpi.value).toBe('number');
      expect(typeof kpi.trend).toBe('number');
      expect(kpi.label).toBe('QCI Pass Rate');
      expect(kpi.unit).toBe('%');
    });
  });
});
