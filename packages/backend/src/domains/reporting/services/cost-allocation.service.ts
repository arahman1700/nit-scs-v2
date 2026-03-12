// ---------------------------------------------------------------------------
// Cost Allocation Service — L7
// ---------------------------------------------------------------------------
// Aggregates cost data across GRNs (mrrv), MIs (mirv), Job Orders,
// Shipments, and rental equipment JOs on a per-project basis.
// No new Prisma models — pure reporting/aggregation over existing tables.
// ---------------------------------------------------------------------------

import { prisma } from '../../../utils/prisma.js';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@nit-scs-v2/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CostCategory {
  count: number;
  totalValue: number;
}

export interface MonthlyBreakdown {
  month: string;
  total: number;
}

export interface CostAllocationResult {
  project: { id: string; projectName: string; projectCode: string };
  dateRange: { from: string | null; to: string | null };
  categories: {
    receiving: CostCategory;
    materialIssues: CostCategory;
    jobOrders: CostCategory;
    shipments: CostCategory;
    rentalEquipment: CostCategory;
  };
  grandTotal: number;
  monthlyBreakdown: MonthlyBreakdown[];
}

export interface ProjectCostSummaryItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  receiving: number;
  materialIssues: number;
  jobOrders: number;
  shipments: number;
  rentalEquipment: number;
  grandTotal: number;
}

export interface CostAllocationSummaryResult {
  dateRange: { from: string | null; to: string | null };
  totals: {
    receiving: CostCategory;
    materialIssues: CostCategory;
    jobOrders: CostCategory;
    shipments: CostCategory;
    rentalEquipment: CostCategory;
  };
  grandTotal: number;
  projects: ProjectCostSummaryItem[];
  monthlyBreakdown: MonthlyBreakdown[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function buildDateRange(dateFrom?: Date, dateTo?: Date) {
  const range: Record<string, Date> = {};
  if (dateFrom) range.gte = dateFrom;
  if (dateTo) range.lte = dateTo;
  return Object.keys(range).length > 0 ? range : undefined;
}

// ── Per-Project Cost Allocation ──────────────────────────────────────────────

export async function getCostAllocation(
  projectId: string,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<CostAllocationResult> {
  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, projectName: true, projectCode: true },
  });
  if (!project) throw new NotFoundError('Project', projectId);

  const dateRangeCreated = buildDateRange(dateFrom, dateTo);

  // Run all aggregate queries in parallel
  const [grnAgg, miAgg, joAgg, shipmentAgg, rentalJoAgg, monthlyRaw] = await Promise.all([
    // 1. GRN (mrrv) — totalValue
    prisma.mrrv.aggregate({
      where: {
        projectId,
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { totalValue: true },
      _count: { id: true },
    }),

    // 2. MI (mirv) — estimatedValue
    prisma.mirv.aggregate({
      where: {
        projectId,
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { estimatedValue: true },
      _count: { id: true },
    }),

    // 3. Job Orders — totalAmount (approved or beyond)
    prisma.jobOrder.aggregate({
      where: {
        projectId,
        status: {
          in: [
            'approved',
            'assigned',
            'in_progress',
            'on_hold',
            'completed',
            'closure_pending',
            'closure_approved',
            'invoiced',
          ],
        },
        joType: { notIn: ['rental_monthly', 'rental_daily', 'generator_rental'] },
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),

    // 4. Shipments — commercialValue + freightCost
    prisma.shipment.aggregate({
      where: {
        projectId,
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { commercialValue: true, freightCost: true },
      _count: { id: true },
    }),

    // 5. Rental Equipment JOs — totalAmount for rental types
    prisma.jobOrder.aggregate({
      where: {
        projectId,
        status: {
          in: [
            'approved',
            'assigned',
            'in_progress',
            'on_hold',
            'completed',
            'closure_pending',
            'closure_approved',
            'invoiced',
          ],
        },
        joType: { in: ['rental_monthly', 'rental_daily', 'generator_rental'] },
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),

    // 6. Monthly breakdown using raw SQL
    getMonthlyBreakdownForProject(projectId, dateFrom, dateTo),
  ]);

  const receiving: CostCategory = {
    count: grnAgg._count.id,
    totalValue: toNumber(grnAgg._sum.totalValue),
  };

  const materialIssues: CostCategory = {
    count: miAgg._count.id,
    totalValue: toNumber(miAgg._sum.estimatedValue),
  };

  const jobOrders: CostCategory = {
    count: joAgg._count.id,
    totalValue: toNumber(joAgg._sum.totalAmount),
  };

  const shipments: CostCategory = {
    count: shipmentAgg._count.id,
    totalValue: toNumber(shipmentAgg._sum.commercialValue) + toNumber(shipmentAgg._sum.freightCost),
  };

  const rentalEquipment: CostCategory = {
    count: rentalJoAgg._count.id,
    totalValue: toNumber(rentalJoAgg._sum.totalAmount),
  };

  const grandTotal =
    receiving.totalValue +
    materialIssues.totalValue +
    jobOrders.totalValue +
    shipments.totalValue +
    rentalEquipment.totalValue;

  return {
    project,
    dateRange: {
      from: dateFrom?.toISOString() ?? null,
      to: dateTo?.toISOString() ?? null,
    },
    categories: { receiving, materialIssues, jobOrders, shipments, rentalEquipment },
    grandTotal,
    monthlyBreakdown: monthlyRaw,
  };
}

// ── Summary Across All Projects ──────────────────────────────────────────────

export async function getCostAllocationSummary(dateFrom?: Date, dateTo?: Date): Promise<CostAllocationSummaryResult> {
  const dateRangeCreated = buildDateRange(dateFrom, dateTo);

  // Global totals
  const [grnAgg, miAgg, joAgg, shipmentAgg, rentalJoAgg] = await Promise.all([
    prisma.mrrv.aggregate({
      where: dateRangeCreated ? { createdAt: dateRangeCreated } : {},
      _sum: { totalValue: true },
      _count: { id: true },
    }),
    prisma.mirv.aggregate({
      where: dateRangeCreated ? { createdAt: dateRangeCreated } : {},
      _sum: { estimatedValue: true },
      _count: { id: true },
    }),
    prisma.jobOrder.aggregate({
      where: {
        status: {
          in: [
            'approved',
            'assigned',
            'in_progress',
            'on_hold',
            'completed',
            'closure_pending',
            'closure_approved',
            'invoiced',
          ],
        },
        joType: { notIn: ['rental_monthly', 'rental_daily', 'generator_rental'] },
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.shipment.aggregate({
      where: dateRangeCreated ? { createdAt: dateRangeCreated } : {},
      _sum: { commercialValue: true, freightCost: true },
      _count: { id: true },
    }),
    prisma.jobOrder.aggregate({
      where: {
        status: {
          in: [
            'approved',
            'assigned',
            'in_progress',
            'on_hold',
            'completed',
            'closure_pending',
            'closure_approved',
            'invoiced',
          ],
        },
        joType: { in: ['rental_monthly', 'rental_daily', 'generator_rental'] },
        ...(dateRangeCreated ? { createdAt: dateRangeCreated } : {}),
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
  ]);

  const totals = {
    receiving: { count: grnAgg._count.id, totalValue: toNumber(grnAgg._sum.totalValue) },
    materialIssues: { count: miAgg._count.id, totalValue: toNumber(miAgg._sum.estimatedValue) },
    jobOrders: { count: joAgg._count.id, totalValue: toNumber(joAgg._sum.totalAmount) },
    shipments: {
      count: shipmentAgg._count.id,
      totalValue: toNumber(shipmentAgg._sum.commercialValue) + toNumber(shipmentAgg._sum.freightCost),
    },
    rentalEquipment: { count: rentalJoAgg._count.id, totalValue: toNumber(rentalJoAgg._sum.totalAmount) },
  };

  const grandTotal =
    totals.receiving.totalValue +
    totals.materialIssues.totalValue +
    totals.jobOrders.totalValue +
    totals.shipments.totalValue +
    totals.rentalEquipment.totalValue;

  // Per-project breakdown via raw SQL for efficiency
  const [projectBreakdown, monthlyBreakdown] = await Promise.all([
    getPerProjectBreakdown(dateFrom, dateTo),
    getMonthlyBreakdownGlobal(dateFrom, dateTo),
  ]);

  return {
    dateRange: {
      from: dateFrom?.toISOString() ?? null,
      to: dateTo?.toISOString() ?? null,
    },
    totals,
    grandTotal,
    projects: projectBreakdown,
    monthlyBreakdown,
  };
}

// ── Raw SQL Helpers ──────────────────────────────────────────────────────────

// Use far-past/far-future boundaries so date filters are always present (no dynamic SQL)
const DATE_MIN = new Date('1900-01-01T00:00:00Z');
const DATE_MAX = new Date('2100-01-01T00:00:00Z');

async function getMonthlyBreakdownForProject(
  projectId: string,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<MonthlyBreakdown[]> {
  const dFrom = dateFrom ?? DATE_MIN;
  const dTo = dateTo ?? DATE_MAX;

  const rows = await prisma.$queryRaw<Array<{ month: string; total: number | Prisma.Decimal }>>`
    SELECT month, SUM(total)::numeric AS total FROM (
      SELECT to_char(m.created_at, 'YYYY-MM') AS month,
             COALESCE(m.total_value, 0) AS total
        FROM "RCV_RECEIPT_HEADERS" m
       WHERE m.project_id = ${projectId}::uuid
         AND m.created_at >= ${dFrom} AND m.created_at <= ${dTo}
      UNION ALL
      SELECT to_char(mi.created_at, 'YYYY-MM') AS month,
             COALESCE(mi.estimated_value, 0) AS total
        FROM "ONT_ISSUE_HEADERS" mi
       WHERE mi.project_id = ${projectId}::uuid
         AND mi.created_at >= ${dFrom} AND mi.created_at <= ${dTo}
      UNION ALL
      SELECT to_char(jo.created_at, 'YYYY-MM') AS month,
             COALESCE(jo.total_amount, 0) AS total
        FROM "WMS_JOB_ORDERS" jo
       WHERE jo.project_id = ${projectId}::uuid
         AND jo.status IN ('approved','assigned','in_progress','on_hold','completed','closure_pending','closure_approved','invoiced')
         AND jo.created_at >= ${dFrom} AND jo.created_at <= ${dTo}
      UNION ALL
      SELECT to_char(s.created_at, 'YYYY-MM') AS month,
             COALESCE(s.commercial_value, 0) + COALESCE(s.freight_cost, 0) AS total
        FROM "WSH_DELIVERY_HEADERS" s
       WHERE s.project_id = ${projectId}::uuid
         AND s.created_at >= ${dFrom} AND s.created_at <= ${dTo}
    ) sub
    GROUP BY month
    ORDER BY month
  `;

  return rows.map(r => ({
    month: r.month,
    total: toNumber(r.total),
  }));
}

async function getMonthlyBreakdownGlobal(dateFrom?: Date, dateTo?: Date): Promise<MonthlyBreakdown[]> {
  const dFrom = dateFrom ?? DATE_MIN;
  const dTo = dateTo ?? DATE_MAX;

  const rows = await prisma.$queryRaw<Array<{ month: string; total: number | Prisma.Decimal }>>`
    SELECT month, SUM(total)::numeric AS total FROM (
      SELECT to_char(m.created_at, 'YYYY-MM') AS month,
             COALESCE(m.total_value, 0) AS total
        FROM "RCV_RECEIPT_HEADERS" m
       WHERE m.created_at >= ${dFrom} AND m.created_at <= ${dTo}
      UNION ALL
      SELECT to_char(mi.created_at, 'YYYY-MM') AS month,
             COALESCE(mi.estimated_value, 0) AS total
        FROM "ONT_ISSUE_HEADERS" mi
       WHERE mi.created_at >= ${dFrom} AND mi.created_at <= ${dTo}
      UNION ALL
      SELECT to_char(jo.created_at, 'YYYY-MM') AS month,
             COALESCE(jo.total_amount, 0) AS total
        FROM "WMS_JOB_ORDERS" jo
       WHERE jo.status IN ('approved','assigned','in_progress','on_hold','completed','closure_pending','closure_approved','invoiced')
         AND jo.created_at >= ${dFrom} AND jo.created_at <= ${dTo}
      UNION ALL
      SELECT to_char(s.created_at, 'YYYY-MM') AS month,
             COALESCE(s.commercial_value, 0) + COALESCE(s.freight_cost, 0) AS total
        FROM "WSH_DELIVERY_HEADERS" s
       WHERE s.created_at >= ${dFrom} AND s.created_at <= ${dTo}
    ) sub
    GROUP BY month
    ORDER BY month
  `;

  return rows.map(r => ({
    month: r.month,
    total: toNumber(r.total),
  }));
}

async function getPerProjectBreakdown(dateFrom?: Date, dateTo?: Date): Promise<ProjectCostSummaryItem[]> {
  const dFrom = dateFrom ?? DATE_MIN;
  const dTo = dateTo ?? DATE_MAX;

  const rows = await prisma.$queryRaw<
    Array<{
      projectId: string;
      projectName: string;
      projectCode: string;
      receiving: number | Prisma.Decimal;
      materialIssues: number | Prisma.Decimal;
      jobOrders: number | Prisma.Decimal;
      shipments: number | Prisma.Decimal;
      rentalEquipment: number | Prisma.Decimal;
      grandTotal: number | Prisma.Decimal;
    }>
  >`
    WITH grn_costs AS (
      SELECT project_id, COALESCE(SUM(total_value), 0)::numeric AS total
        FROM "RCV_RECEIPT_HEADERS"
       WHERE project_id IS NOT NULL
         AND created_at >= ${dFrom} AND created_at <= ${dTo}
       GROUP BY project_id
    ),
    mi_costs AS (
      SELECT project_id, COALESCE(SUM(estimated_value), 0)::numeric AS total
        FROM "ONT_ISSUE_HEADERS"
       WHERE created_at >= ${dFrom} AND created_at <= ${dTo}
       GROUP BY project_id
    ),
    jo_costs AS (
      SELECT project_id, COALESCE(SUM(total_amount), 0)::numeric AS total
        FROM "WMS_JOB_ORDERS"
       WHERE jo_type NOT IN ('rental_monthly','rental_daily','generator_rental')
         AND status IN ('approved','assigned','in_progress','on_hold','completed','closure_pending','closure_approved','invoiced')
         AND created_at >= ${dFrom} AND created_at <= ${dTo}
       GROUP BY project_id
    ),
    ship_costs AS (
      SELECT project_id, (COALESCE(SUM(commercial_value), 0) + COALESCE(SUM(freight_cost), 0))::numeric AS total
        FROM "WSH_DELIVERY_HEADERS"
       WHERE project_id IS NOT NULL
         AND created_at >= ${dFrom} AND created_at <= ${dTo}
       GROUP BY project_id
    ),
    rental_costs AS (
      SELECT project_id, COALESCE(SUM(total_amount), 0)::numeric AS total
        FROM "WMS_JOB_ORDERS"
       WHERE jo_type IN ('rental_monthly','rental_daily','generator_rental')
         AND status IN ('approved','assigned','in_progress','on_hold','completed','closure_pending','closure_approved','invoiced')
         AND created_at >= ${dFrom} AND created_at <= ${dTo}
       GROUP BY project_id
    ),
    all_project_ids AS (
      SELECT project_id FROM grn_costs
       UNION SELECT project_id FROM mi_costs
       UNION SELECT project_id FROM jo_costs
       UNION SELECT project_id FROM ship_costs
       UNION SELECT project_id FROM rental_costs
    )
    SELECT
      p.id AS "projectId",
      p.project_name AS "projectName",
      p.project_code AS "projectCode",
      COALESCE(g.total, 0)::numeric AS receiving,
      COALESCE(mi.total, 0)::numeric AS "materialIssues",
      COALESCE(jo.total, 0)::numeric AS "jobOrders",
      COALESCE(s.total, 0)::numeric AS shipments,
      COALESCE(r.total, 0)::numeric AS "rentalEquipment",
      (COALESCE(g.total, 0) + COALESCE(mi.total, 0) + COALESCE(jo.total, 0) + COALESCE(s.total, 0) + COALESCE(r.total, 0))::numeric AS "grandTotal"
    FROM all_project_ids api
    JOIN "FND_PROJECTS" p ON p.id = api.project_id
    LEFT JOIN grn_costs g ON g.project_id = api.project_id
    LEFT JOIN mi_costs mi ON mi.project_id = api.project_id
    LEFT JOIN jo_costs jo ON jo.project_id = api.project_id
    LEFT JOIN ship_costs s ON s.project_id = api.project_id
    LEFT JOIN rental_costs r ON r.project_id = api.project_id
    ORDER BY "grandTotal" DESC
  `;

  return rows.map(r => ({
    projectId: r.projectId,
    projectName: r.projectName,
    projectCode: r.projectCode,
    receiving: toNumber(r.receiving),
    materialIssues: toNumber(r.materialIssues),
    jobOrders: toNumber(r.jobOrders),
    shipments: toNumber(r.shipments),
    rentalEquipment: toNumber(r.rentalEquipment),
    grandTotal: toNumber(r.grandTotal),
  }));
}
