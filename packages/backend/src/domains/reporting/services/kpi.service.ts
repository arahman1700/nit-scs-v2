// ---------------------------------------------------------------------------
// KPI Service — Comprehensive KPI calculations for NIT Supply Chain V2
// ---------------------------------------------------------------------------
// Reads from existing Prisma models to compute 15 key performance indicators
// grouped into 5 categories: Inventory, Procurement, Logistics, Quality, Financial.
// ---------------------------------------------------------------------------

import { prisma } from '../../../utils/prisma.js';
import { logger } from '../../../config/logger.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface KpiResult {
  value: number;
  trend: number; // percent change vs prior period
  label: string;
  unit: string;
}

export type KpiCategory = 'inventory' | 'procurement' | 'logistics' | 'quality' | 'financial';

export interface ComprehensiveKpis {
  inventory: {
    inventoryTurnover: KpiResult;
    stockAccuracy: KpiResult;
    deadStock: KpiResult;
    warehouseUtilization: KpiResult;
  };
  procurement: {
    grnProcessingTime: KpiResult;
    supplierOnTimeDelivery: KpiResult;
    poFulfillmentRate: KpiResult;
  };
  logistics: {
    joCompletionRate: KpiResult;
    joAvgResponseTime: KpiResult;
    gatePassTurnaround: KpiResult;
  };
  quality: {
    qciPassRate: KpiResult;
    drResolutionTime: KpiResult;
    ncrRate: KpiResult;
  };
  financial: {
    pendingApprovalValue: KpiResult;
    monthlySpend: KpiResult;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Safe division: returns 0 when denominator is zero */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Get the prior period range given a current period's dateFrom/dateTo */
function getPriorPeriod(dateFrom: Date, dateTo: Date): { priorFrom: Date; priorTo: Date } {
  const durationMs = dateTo.getTime() - dateFrom.getTime();
  const priorTo = new Date(dateFrom.getTime() - 1); // 1ms before current period
  const priorFrom = new Date(priorTo.getTime() - durationMs);
  return { priorFrom, priorTo };
}

/** Calculate trend as percent change between prior and current values */
function calcTrend(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return round2(((current - prior) / Math.abs(prior)) * 100);
}

// ── Inventory KPIs ─────────────────────────────────────────────────────────

async function calcInventoryTurnover(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // Items issued = count of MIRV lines where parent MIRV has status 'issued' or 'completed'
  const [currentIssued, priorIssued, totalInventoryValue] = await Promise.all([
    prisma.mirv.count({
      where: {
        status: { in: ['issued', 'completed'] },
        issuedDate: { gte: dateFrom, lte: dateTo },
      },
    }),
    prisma.mirv.count({
      where: {
        status: { in: ['issued', 'completed'] },
        issuedDate: { gte: priorFrom, lte: priorTo },
      },
    }),
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(available_qty * COALESCE(unit_cost, 0)), 0)::float AS total
      FROM "MTL_LOT_NUMBERS"
      WHERE status = 'active'
    `,
  ]);

  const invValue = totalInventoryValue[0]?.total ?? 1; // avoid /0
  return {
    current: round2(safeDivide(currentIssued, invValue === 0 ? 1 : invValue) * 1000), // scale for readability
    prior: round2(safeDivide(priorIssued, invValue === 0 ? 1 : invValue) * 1000),
  };
}

async function calcStockAccuracy(): Promise<{ current: number }> {
  // Cycle count lines where abs(variance_percent) < 2 / total counted lines
  const [result] = await prisma.$queryRaw<{ accurate: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE ABS(variance_percent) < 2) AS accurate,
      COUNT(*) AS total
    FROM "MTL_CYCLE_COUNT_LINES"
    WHERE status IN ('counted', 'verified', 'adjusted')
      AND counted_qty IS NOT NULL
  `;

  const accurate = Number(result?.accurate ?? 0);
  const total = Number(result?.total ?? 0);
  return { current: round2(safeDivide(accurate, total) * 100) };
}

async function calcDeadStock(): Promise<{ current: number }> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

  // Items with no movement in 180 days
  const [result] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "MTL_ONHAND_QUANTITIES" il
    WHERE il.qty_on_hand > 0
      AND (il.last_movement_date IS NULL OR il.last_movement_date < ${sixMonthsAgo})
  `;

  return { current: Number(result?.count ?? 0) };
}

async function calcWarehouseUtilization(): Promise<{ current: number }> {
  // Using WarehouseZone capacity vs currentOccupancy
  const [result] = await prisma.$queryRaw<{ occupied: bigint; capacity: bigint }[]>`
    SELECT
      COALESCE(SUM(current_occupancy), 0) AS occupied,
      COALESCE(SUM(capacity), 0) AS capacity
    FROM "WMS_ZONES"
    WHERE capacity IS NOT NULL AND capacity > 0
  `;

  const occupied = Number(result?.occupied ?? 0);
  const capacity = Number(result?.capacity ?? 0);
  return { current: round2(safeDivide(occupied, capacity) * 100) };
}

// ── Procurement KPIs ───────────────────────────────────────────────────────

async function calcGrnProcessingTime(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // Avg hours from GRN (mrrv) creation to QCI (rfim) completion
  const [currentResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (r.updated_at - m.created_at)) / 3600), 0)::float AS avg_hours
    FROM "RCV_INSPECTION_HEADERS" r
    JOIN "RCV_RECEIPT_HEADERS" m ON r.mrrv_id = m.id
    WHERE r.status = 'completed'
      AND r.updated_at >= ${dateFrom}
      AND r.updated_at <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (r.updated_at - m.created_at)) / 3600), 0)::float AS avg_hours
    FROM "RCV_INSPECTION_HEADERS" r
    JOIN "RCV_RECEIPT_HEADERS" m ON r.mrrv_id = m.id
    WHERE r.status = 'completed'
      AND r.updated_at >= ${priorFrom}
      AND r.updated_at <= ${priorTo}
  `;

  return {
    current: round2(currentResult?.avg_hours ?? 0),
    prior: round2(priorResult?.avg_hours ?? 0),
  };
}

async function calcSupplierOnTimeDelivery(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // Shipments delivered by ETA / total delivered shipments
  const [currentResult] = await prisma.$queryRaw<{ on_time: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE delivery_date <= eta_port OR actual_arrival_date <= eta_port) AS on_time,
      COUNT(*) AS total
    FROM "WSH_DELIVERY_HEADERS"
    WHERE status = 'delivered'
      AND delivery_date >= ${dateFrom}
      AND delivery_date <= ${dateTo}
      AND eta_port IS NOT NULL
  `;

  const [priorResult] = await prisma.$queryRaw<{ on_time: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE delivery_date <= eta_port OR actual_arrival_date <= eta_port) AS on_time,
      COUNT(*) AS total
    FROM "WSH_DELIVERY_HEADERS"
    WHERE status = 'delivered'
      AND delivery_date >= ${priorFrom}
      AND delivery_date <= ${priorTo}
      AND eta_port IS NOT NULL
  `;

  return {
    current: round2(safeDivide(Number(currentResult?.on_time ?? 0), Number(currentResult?.total ?? 0)) * 100),
    prior: round2(safeDivide(Number(priorResult?.on_time ?? 0), Number(priorResult?.total ?? 0)) * 100),
  };
}

async function calcPoFulfillmentRate(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // GRN lines: qty_received vs qty_ordered
  const [currentResult] = await prisma.$queryRaw<{ received: number; ordered: number }[]>`
    SELECT
      COALESCE(SUM(ml.qty_received), 0)::float AS received,
      COALESCE(SUM(COALESCE(ml.qty_ordered, ml.qty_received)), 0)::float AS ordered
    FROM "RCV_RECEIPT_LINES" ml
    JOIN "RCV_RECEIPT_HEADERS" m ON ml.mrrv_id = m.id
    WHERE m.created_at >= ${dateFrom}
      AND m.created_at <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ received: number; ordered: number }[]>`
    SELECT
      COALESCE(SUM(ml.qty_received), 0)::float AS received,
      COALESCE(SUM(COALESCE(ml.qty_ordered, ml.qty_received)), 0)::float AS ordered
    FROM "RCV_RECEIPT_LINES" ml
    JOIN "RCV_RECEIPT_HEADERS" m ON ml.mrrv_id = m.id
    WHERE m.created_at >= ${priorFrom}
      AND m.created_at <= ${priorTo}
  `;

  return {
    current: round2(safeDivide(currentResult?.received ?? 0, currentResult?.ordered ?? 0) * 100),
    prior: round2(safeDivide(priorResult?.received ?? 0, priorResult?.ordered ?? 0) * 100),
  };
}

// ── Logistics KPIs ─────────────────────────────────────────────────────────

async function calcJoCompletionRate(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  const [currentResult] = await prisma.$queryRaw<{ completed: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('completed', 'invoiced', 'closure_pending', 'closure_approved')) AS completed,
      COUNT(*) AS total
    FROM "WMS_JOB_ORDERS"
    WHERE status != 'cancelled'
      AND created_at >= ${dateFrom}
      AND created_at <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ completed: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('completed', 'invoiced', 'closure_pending', 'closure_approved')) AS completed,
      COUNT(*) AS total
    FROM "WMS_JOB_ORDERS"
    WHERE status != 'cancelled'
      AND created_at >= ${priorFrom}
      AND created_at <= ${priorTo}
  `;

  return {
    current: round2(safeDivide(Number(currentResult?.completed ?? 0), Number(currentResult?.total ?? 0)) * 100),
    prior: round2(safeDivide(Number(priorResult?.completed ?? 0), Number(priorResult?.total ?? 0)) * 100),
  };
}

async function calcJoAvgResponseTime(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // Avg hours from JO submission (request_date) to first approval
  const [currentResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ja.approved_date - jo.request_date)) / 3600), 0)::float AS avg_hours
    FROM "WMS_JO_APPROVALS" ja
    JOIN "WMS_JOB_ORDERS" jo ON ja.job_order_id = jo.id
    WHERE ja.approved = true
      AND ja.approved_date >= ${dateFrom}
      AND ja.approved_date <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ja.approved_date - jo.request_date)) / 3600), 0)::float AS avg_hours
    FROM "WMS_JO_APPROVALS" ja
    JOIN "WMS_JOB_ORDERS" jo ON ja.job_order_id = jo.id
    WHERE ja.approved = true
      AND ja.approved_date >= ${priorFrom}
      AND ja.approved_date <= ${priorTo}
  `;

  return {
    current: round2(currentResult?.avg_hours ?? 0),
    prior: round2(priorResult?.avg_hours ?? 0),
  };
}

async function calcGatePassTurnaround(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // Avg hours from gate pass creation to return_time (for completed passes)
  const [currentResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (return_time - created_at)) / 3600), 0)::float AS avg_hours
    FROM "WMS_GATE_PASSES"
    WHERE return_time IS NOT NULL
      AND return_time >= ${dateFrom}
      AND return_time <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (return_time - created_at)) / 3600), 0)::float AS avg_hours
    FROM "WMS_GATE_PASSES"
    WHERE return_time IS NOT NULL
      AND return_time >= ${priorFrom}
      AND return_time <= ${priorTo}
  `;

  return {
    current: round2(currentResult?.avg_hours ?? 0),
    prior: round2(priorResult?.avg_hours ?? 0),
  };
}

// ── Quality KPIs ───────────────────────────────────────────────────────────

async function calcQciPassRate(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  const [currentResult] = await prisma.$queryRaw<{ passed: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE result = 'pass') AS passed,
      COUNT(*) AS total
    FROM "RCV_INSPECTION_HEADERS"
    WHERE status = 'completed'
      AND updated_at >= ${dateFrom}
      AND updated_at <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ passed: bigint; total: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE result = 'pass') AS passed,
      COUNT(*) AS total
    FROM "RCV_INSPECTION_HEADERS"
    WHERE status = 'completed'
      AND updated_at >= ${priorFrom}
      AND updated_at <= ${priorTo}
  `;

  return {
    current: round2(safeDivide(Number(currentResult?.passed ?? 0), Number(currentResult?.total ?? 0)) * 100),
    prior: round2(safeDivide(Number(priorResult?.passed ?? 0), Number(priorResult?.total ?? 0)) * 100),
  };
}

async function calcDrResolutionTime(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // Avg hours from DR (osd_reports) creation to resolution_date
  const [currentResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600), 0)::float AS avg_hours
    FROM "RCV_DISCREPANCY_HEADERS"
    WHERE resolution_date IS NOT NULL
      AND resolution_date >= ${dateFrom}
      AND resolution_date <= ${dateTo}
  `;

  const [priorResult] = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600), 0)::float AS avg_hours
    FROM "RCV_DISCREPANCY_HEADERS"
    WHERE resolution_date IS NOT NULL
      AND resolution_date >= ${priorFrom}
      AND resolution_date <= ${priorTo}
  `;

  return {
    current: round2(currentResult?.avg_hours ?? 0),
    prior: round2(priorResult?.avg_hours ?? 0),
  };
}

async function calcNcrRate(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  // DRs (osd_reports) flagged / total GRN lines received in the period
  const [currentResult] = await prisma.$queryRaw<{ dr_count: bigint; grn_lines: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "RCV_DISCREPANCY_HEADERS" WHERE created_at >= ${dateFrom} AND created_at <= ${dateTo}) AS dr_count,
      (SELECT COUNT(*) FROM "RCV_RECEIPT_LINES" ml JOIN "RCV_RECEIPT_HEADERS" m ON ml.mrrv_id = m.id
       WHERE m.created_at >= ${dateFrom} AND m.created_at <= ${dateTo}) AS grn_lines
  `;

  const [priorResult] = await prisma.$queryRaw<{ dr_count: bigint; grn_lines: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "RCV_DISCREPANCY_HEADERS" WHERE created_at >= ${priorFrom} AND created_at <= ${priorTo}) AS dr_count,
      (SELECT COUNT(*) FROM "RCV_RECEIPT_LINES" ml JOIN "RCV_RECEIPT_HEADERS" m ON ml.mrrv_id = m.id
       WHERE m.created_at >= ${priorFrom} AND m.created_at <= ${priorTo}) AS grn_lines
  `;

  return {
    current: round2(safeDivide(Number(currentResult?.dr_count ?? 0), Number(currentResult?.grn_lines ?? 0)) * 100),
    prior: round2(safeDivide(Number(priorResult?.dr_count ?? 0), Number(priorResult?.grn_lines ?? 0)) * 100),
  };
}

// ── Financial KPIs ─────────────────────────────────────────────────────────

async function calcPendingApprovalValue(): Promise<{ current: number }> {
  const result = await prisma.jobOrder.aggregate({
    _sum: { totalAmount: true },
    where: { status: 'pending_approval' },
  });

  return { current: round2(Number(result._sum.totalAmount ?? 0)) };
}

async function calcMonthlySpend(dateFrom: Date, dateTo: Date): Promise<{ current: number; prior: number }> {
  const { priorFrom, priorTo } = getPriorPeriod(dateFrom, dateTo);

  const [currentResult, priorResult] = await Promise.all([
    prisma.jobOrder.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: {
          in: ['approved', 'assigned', 'in_progress', 'completed', 'invoiced', 'closure_pending', 'closure_approved'],
        },
        requestDate: { gte: dateFrom, lte: dateTo },
      },
    }),
    prisma.jobOrder.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: {
          in: ['approved', 'assigned', 'in_progress', 'completed', 'invoiced', 'closure_pending', 'closure_approved'],
        },
        requestDate: { gte: priorFrom, lte: priorTo },
      },
    }),
  ]);

  return {
    current: round2(Number(currentResult._sum.totalAmount ?? 0)),
    prior: round2(Number(priorResult._sum.totalAmount ?? 0)),
  };
}

// ── Main Function ──────────────────────────────────────────────────────────

/**
 * Calculate all 15 comprehensive KPIs.
 * Defaults to current month if no date range is provided.
 */
export async function getComprehensiveKpis(dateFrom?: Date, dateTo?: Date): Promise<ComprehensiveKpis> {
  // Default to current month
  const now = new Date();
  const from = dateFrom ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const to = dateTo ?? now;

  logger.info({ dateFrom: from, dateTo: to }, 'Calculating comprehensive KPIs');

  // Run all calculations in parallel for maximum efficiency
  const [
    inventoryTurnover,
    stockAccuracy,
    deadStock,
    warehouseUtilization,
    grnProcessingTime,
    supplierOnTimeDelivery,
    poFulfillmentRate,
    joCompletionRate,
    joAvgResponseTime,
    gatePassTurnaround,
    qciPassRate,
    drResolutionTime,
    ncrRate,
    pendingApprovalValue,
    monthlySpend,
  ] = await Promise.all([
    calcInventoryTurnover(from, to),
    calcStockAccuracy(),
    calcDeadStock(),
    calcWarehouseUtilization(),
    calcGrnProcessingTime(from, to),
    calcSupplierOnTimeDelivery(from, to),
    calcPoFulfillmentRate(from, to),
    calcJoCompletionRate(from, to),
    calcJoAvgResponseTime(from, to),
    calcGatePassTurnaround(from, to),
    calcQciPassRate(from, to),
    calcDrResolutionTime(from, to),
    calcNcrRate(from, to),
    calcPendingApprovalValue(),
    calcMonthlySpend(from, to),
  ]);

  return {
    inventory: {
      inventoryTurnover: {
        value: inventoryTurnover.current,
        trend: calcTrend(inventoryTurnover.current, inventoryTurnover.prior),
        label: 'Inventory Turnover',
        unit: 'ratio',
      },
      stockAccuracy: {
        value: stockAccuracy.current,
        trend: 0, // point-in-time metric, no trend
        label: 'Stock Accuracy',
        unit: '%',
      },
      deadStock: {
        value: deadStock.current,
        trend: 0, // point-in-time metric
        label: 'Dead Stock Items',
        unit: 'items',
      },
      warehouseUtilization: {
        value: warehouseUtilization.current,
        trend: 0, // point-in-time metric
        label: 'Warehouse Utilization',
        unit: '%',
      },
    },
    procurement: {
      grnProcessingTime: {
        value: grnProcessingTime.current,
        trend: calcTrend(grnProcessingTime.current, grnProcessingTime.prior),
        label: 'GRN Processing Time',
        unit: 'hours',
      },
      supplierOnTimeDelivery: {
        value: supplierOnTimeDelivery.current,
        trend: calcTrend(supplierOnTimeDelivery.current, supplierOnTimeDelivery.prior),
        label: 'On-Time Delivery',
        unit: '%',
      },
      poFulfillmentRate: {
        value: poFulfillmentRate.current,
        trend: calcTrend(poFulfillmentRate.current, poFulfillmentRate.prior),
        label: 'PO Fulfillment Rate',
        unit: '%',
      },
    },
    logistics: {
      joCompletionRate: {
        value: joCompletionRate.current,
        trend: calcTrend(joCompletionRate.current, joCompletionRate.prior),
        label: 'JO Completion Rate',
        unit: '%',
      },
      joAvgResponseTime: {
        value: joAvgResponseTime.current,
        trend: calcTrend(joAvgResponseTime.current, joAvgResponseTime.prior),
        label: 'JO Avg Response Time',
        unit: 'hours',
      },
      gatePassTurnaround: {
        value: gatePassTurnaround.current,
        trend: calcTrend(gatePassTurnaround.current, gatePassTurnaround.prior),
        label: 'Gate Pass Turnaround',
        unit: 'hours',
      },
    },
    quality: {
      qciPassRate: {
        value: qciPassRate.current,
        trend: calcTrend(qciPassRate.current, qciPassRate.prior),
        label: 'QCI Pass Rate',
        unit: '%',
      },
      drResolutionTime: {
        value: drResolutionTime.current,
        trend: calcTrend(drResolutionTime.current, drResolutionTime.prior),
        label: 'DR Resolution Time',
        unit: 'hours',
      },
      ncrRate: {
        value: ncrRate.current,
        trend: calcTrend(ncrRate.current, ncrRate.prior),
        label: 'NCR Rate',
        unit: '%',
      },
    },
    financial: {
      pendingApprovalValue: {
        value: pendingApprovalValue.current,
        trend: 0, // point-in-time metric
        label: 'Pending Approval Value',
        unit: 'SAR',
      },
      monthlySpend: {
        value: monthlySpend.current,
        trend: calcTrend(monthlySpend.current, monthlySpend.prior),
        label: 'Monthly Spend',
        unit: 'SAR',
      },
    },
  };
}

/**
 * Get KPIs filtered by a single category.
 */
export async function getKpisByCategory(
  category: KpiCategory,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<Record<string, KpiResult>> {
  const all = await getComprehensiveKpis(dateFrom, dateTo);
  return all[category];
}
