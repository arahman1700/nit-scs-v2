import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma, prismaRead: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));

import { Prisma } from '@prisma/client';
import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import { getCostAllocation, getCostAllocationSummary } from './cost-allocation.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-1';

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    projectName: 'Test Project',
    projectCode: 'TP-001',
    ...overrides,
  };
}

function makeAggResult(sum: Record<string, unknown>, count: number) {
  return {
    _sum: sum,
    _count: { id: count },
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('cost-allocation.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── getCostAllocation ──────────────────────────────────────────────

  describe('getCostAllocation', () => {
    function setupAllAggregates(
      grnTotal = 0,
      miTotal = 0,
      joTotal = 0,
      shipCommercial = 0,
      shipFreight = 0,
      rentalTotal = 0,
    ) {
      mockPrisma.mrrv.aggregate.mockResolvedValue(
        makeAggResult({ totalValue: grnTotal > 0 ? new Prisma.Decimal(grnTotal) : null }, grnTotal > 0 ? 1 : 0),
      );
      mockPrisma.mirv.aggregate.mockResolvedValue(
        makeAggResult({ estimatedValue: miTotal > 0 ? new Prisma.Decimal(miTotal) : null }, miTotal > 0 ? 1 : 0),
      );
      // JO is called twice: once for non-rental, once for rental
      mockPrisma.jobOrder.aggregate
        .mockResolvedValueOnce(
          makeAggResult({ totalAmount: joTotal > 0 ? new Prisma.Decimal(joTotal) : null }, joTotal > 0 ? 1 : 0),
        )
        .mockResolvedValueOnce(
          makeAggResult(
            { totalAmount: rentalTotal > 0 ? new Prisma.Decimal(rentalTotal) : null },
            rentalTotal > 0 ? 1 : 0,
          ),
        );
      mockPrisma.shipment.aggregate.mockResolvedValue(
        makeAggResult(
          {
            commercialValue: shipCommercial > 0 ? new Prisma.Decimal(shipCommercial) : null,
            freightCost: shipFreight > 0 ? new Prisma.Decimal(shipFreight) : null,
          },
          shipCommercial > 0 || shipFreight > 0 ? 1 : 0,
        ),
      );
      mockPrisma.$queryRaw.mockResolvedValue([]);
    }

    it('returns cost allocation for a project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates(10000, 5000, 20000, 3000, 500, 2000);

      const result = await getCostAllocation(PROJECT_ID);

      expect(result.project.id).toBe(PROJECT_ID);
      expect(result.categories.receiving.totalValue).toBe(10000);
      expect(result.categories.materialIssues.totalValue).toBe(5000);
      expect(result.categories.jobOrders.totalValue).toBe(20000);
      expect(result.categories.shipments.totalValue).toBe(3500); // 3000 + 500
      expect(result.categories.rentalEquipment.totalValue).toBe(2000);
      expect(result.grandTotal).toBe(40500); // 10000 + 5000 + 20000 + 3500 + 2000
    });

    it('throws NotFoundError when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(getCostAllocation('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('handles all zero costs', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates(0, 0, 0, 0, 0, 0);

      const result = await getCostAllocation(PROJECT_ID);

      expect(result.grandTotal).toBe(0);
      expect(result.categories.receiving.totalValue).toBe(0);
      expect(result.categories.receiving.count).toBe(0);
    });

    it('returns correct date range when dateFrom and dateTo are provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates();

      const from = new Date('2025-01-01');
      const to = new Date('2025-03-31');
      const result = await getCostAllocation(PROJECT_ID, from, to);

      expect(result.dateRange.from).toBe(from.toISOString());
      expect(result.dateRange.to).toBe(to.toISOString());
    });

    it('returns null date range when no dates provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates();

      const result = await getCostAllocation(PROJECT_ID);

      expect(result.dateRange.from).toBeNull();
      expect(result.dateRange.to).toBeNull();
    });

    it('includes monthly breakdown from raw SQL', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates();
      // Override the $queryRaw mock for monthly breakdown
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: '2025-01', total: new Prisma.Decimal(5000) },
        { month: '2025-02', total: new Prisma.Decimal(8000) },
      ]);

      const result = await getCostAllocation(PROJECT_ID);

      expect(result.monthlyBreakdown).toHaveLength(2);
      expect(result.monthlyBreakdown[0]).toEqual({ month: '2025-01', total: 5000 });
      expect(result.monthlyBreakdown[1]).toEqual({ month: '2025-02', total: 8000 });
    });

    it('converts Prisma.Decimal values to numbers', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates(1234.56);

      const result = await getCostAllocation(PROJECT_ID);

      expect(typeof result.categories.receiving.totalValue).toBe('number');
      expect(result.categories.receiving.totalValue).toBe(1234.56);
    });

    it('handles null aggregate sums as zero', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      // All aggregates return null sums
      mockPrisma.mrrv.aggregate.mockResolvedValue(makeAggResult({ totalValue: null }, 0));
      mockPrisma.mirv.aggregate.mockResolvedValue(makeAggResult({ estimatedValue: null }, 0));
      mockPrisma.jobOrder.aggregate
        .mockResolvedValueOnce(makeAggResult({ totalAmount: null }, 0))
        .mockResolvedValueOnce(makeAggResult({ totalAmount: null }, 0));
      mockPrisma.shipment.aggregate.mockResolvedValue(makeAggResult({ commercialValue: null, freightCost: null }, 0));
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getCostAllocation(PROJECT_ID);

      expect(result.grandTotal).toBe(0);
    });

    it('passes date range filters to all aggregate queries', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates();

      const from = new Date('2025-01-01');
      const to = new Date('2025-06-30');
      await getCostAllocation(PROJECT_ID, from, to);

      // Verify mrrv aggregate was called with date filter
      const mrrvCall = mockPrisma.mrrv.aggregate.mock.calls[0][0];
      expect(mrrvCall.where.createdAt).toBeDefined();
      expect(mrrvCall.where.createdAt.gte).toEqual(from);
      expect(mrrvCall.where.createdAt.lte).toEqual(to);
    });

    it('calculates shipments as commercialValue + freightCost', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      setupAllAggregates(0, 0, 0, 10000, 2500, 0);

      const result = await getCostAllocation(PROJECT_ID);

      expect(result.categories.shipments.totalValue).toBe(12500);
    });
  });

  // ─── getCostAllocationSummary ───────────────────────────────────────

  describe('getCostAllocationSummary', () => {
    function setupGlobalAggregates(
      grnTotal = 0,
      miTotal = 0,
      joTotal = 0,
      shipCommercial = 0,
      shipFreight = 0,
      rentalTotal = 0,
    ) {
      mockPrisma.mrrv.aggregate.mockResolvedValue(
        makeAggResult({ totalValue: grnTotal > 0 ? new Prisma.Decimal(grnTotal) : null }, grnTotal > 0 ? 5 : 0),
      );
      mockPrisma.mirv.aggregate.mockResolvedValue(
        makeAggResult({ estimatedValue: miTotal > 0 ? new Prisma.Decimal(miTotal) : null }, miTotal > 0 ? 10 : 0),
      );
      mockPrisma.jobOrder.aggregate
        .mockResolvedValueOnce(
          makeAggResult({ totalAmount: joTotal > 0 ? new Prisma.Decimal(joTotal) : null }, joTotal > 0 ? 3 : 0),
        )
        .mockResolvedValueOnce(
          makeAggResult(
            { totalAmount: rentalTotal > 0 ? new Prisma.Decimal(rentalTotal) : null },
            rentalTotal > 0 ? 2 : 0,
          ),
        );
      mockPrisma.shipment.aggregate.mockResolvedValue(
        makeAggResult(
          {
            commercialValue: shipCommercial > 0 ? new Prisma.Decimal(shipCommercial) : null,
            freightCost: shipFreight > 0 ? new Prisma.Decimal(shipFreight) : null,
          },
          shipCommercial > 0 || shipFreight > 0 ? 1 : 0,
        ),
      );
      // Two $queryRaw calls: per-project breakdown + monthly breakdown
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // per-project breakdown
        .mockResolvedValueOnce([]); // monthly breakdown
    }

    it('returns global cost allocation summary', async () => {
      setupGlobalAggregates(50000, 30000, 100000, 15000, 5000, 10000);

      const result = await getCostAllocationSummary();

      expect(result.totals.receiving.totalValue).toBe(50000);
      expect(result.totals.materialIssues.totalValue).toBe(30000);
      expect(result.totals.jobOrders.totalValue).toBe(100000);
      expect(result.totals.shipments.totalValue).toBe(20000); // 15000 + 5000
      expect(result.totals.rentalEquipment.totalValue).toBe(10000);
      expect(result.grandTotal).toBe(210000);
    });

    it('returns null date range when no dates provided', async () => {
      setupGlobalAggregates();

      const result = await getCostAllocationSummary();

      expect(result.dateRange.from).toBeNull();
      expect(result.dateRange.to).toBeNull();
    });

    it('returns date range when dates provided', async () => {
      setupGlobalAggregates();

      const from = new Date('2025-01-01');
      const to = new Date('2025-12-31');
      const result = await getCostAllocationSummary(from, to);

      expect(result.dateRange.from).toBe(from.toISOString());
      expect(result.dateRange.to).toBe(to.toISOString());
    });

    it('includes per-project breakdown from raw SQL', async () => {
      setupGlobalAggregates();
      // Override first $queryRaw (per-project)
      mockPrisma.$queryRaw
        .mockReset()
        .mockResolvedValueOnce([
          {
            projectId: 'proj-1',
            projectName: 'Project A',
            projectCode: 'PA',
            receiving: new Prisma.Decimal(1000),
            materialIssues: new Prisma.Decimal(500),
            jobOrders: new Prisma.Decimal(2000),
            shipments: new Prisma.Decimal(300),
            rentalEquipment: new Prisma.Decimal(100),
            grandTotal: new Prisma.Decimal(3900),
          },
        ])
        .mockResolvedValueOnce([]); // monthly

      const result = await getCostAllocationSummary();

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].projectId).toBe('proj-1');
      expect(result.projects[0].grandTotal).toBe(3900);
    });

    it('includes monthly breakdown from raw SQL', async () => {
      setupGlobalAggregates();
      mockPrisma.$queryRaw
        .mockReset()
        .mockResolvedValueOnce([]) // per-project
        .mockResolvedValueOnce([
          { month: '2025-01', total: new Prisma.Decimal(10000) },
          { month: '2025-02', total: new Prisma.Decimal(15000) },
        ]);

      const result = await getCostAllocationSummary();

      expect(result.monthlyBreakdown).toHaveLength(2);
      expect(result.monthlyBreakdown[0]).toEqual({ month: '2025-01', total: 10000 });
    });

    it('handles all zero costs', async () => {
      setupGlobalAggregates(0, 0, 0, 0, 0, 0);

      const result = await getCostAllocationSummary();

      expect(result.grandTotal).toBe(0);
    });

    it('includes counts from aggregations', async () => {
      setupGlobalAggregates(50000, 30000, 100000, 15000, 5000, 10000);

      const result = await getCostAllocationSummary();

      expect(result.totals.receiving.count).toBe(5);
      expect(result.totals.materialIssues.count).toBe(10);
      expect(result.totals.jobOrders.count).toBe(3);
      expect(result.totals.rentalEquipment.count).toBe(2);
    });

    it('converts Prisma.Decimal values in project breakdown to numbers', async () => {
      setupGlobalAggregates();
      mockPrisma.$queryRaw
        .mockReset()
        .mockResolvedValueOnce([
          {
            projectId: 'proj-1',
            projectName: 'Project A',
            projectCode: 'PA',
            receiving: new Prisma.Decimal('1234.56'),
            materialIssues: new Prisma.Decimal('0'),
            jobOrders: new Prisma.Decimal('0'),
            shipments: new Prisma.Decimal('0'),
            rentalEquipment: new Prisma.Decimal('0'),
            grandTotal: new Prisma.Decimal('1234.56'),
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await getCostAllocationSummary();

      expect(typeof result.projects[0].receiving).toBe('number');
      expect(result.projects[0].receiving).toBe(1234.56);
    });
  });
});
