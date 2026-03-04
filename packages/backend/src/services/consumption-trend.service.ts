/**
 * Consumption Trend Analysis Service (L8)
 *
 * Analyzes historical material issue (MirvLine) data to provide:
 * - Per-item monthly consumption trends with trend direction detection
 * - Top-N most consumed items by volume over a configurable period
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MonthlyConsumption {
  month: string; // YYYY-MM
  totalQty: number;
  totalValue: number;
  issueCount: number;
}

export interface ItemConsumptionTrend {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  months: MonthlyConsumption[];
  averageMonthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface TopConsumptionItem {
  rank: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  totalQty: number;
  totalValue: number;
  issueCount: number;
}

// ── Raw query row types ─────────────────────────────────────────────────────

interface TrendRow {
  item_id: string;
  item_code: string;
  item_description: string;
  month_key: string;
  total_qty: number;
  total_value: number;
  issue_count: number;
}

interface TopItemRow {
  item_id: string;
  item_code: string;
  item_description: string;
  total_qty: number;
  total_value: number;
  issue_count: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LOOKBACK_MONTHS = 12;
const TREND_THRESHOLD = 0.1; // 10% difference for increasing/decreasing

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get monthly consumption trend for a specific item.
 *
 * Groups MirvLine data by month (via the parent Mirv's request_date),
 * computes totals, and determines overall trend direction by comparing
 * the average of the last 3 months vs the prior 3 months.
 */
export async function getItemConsumptionTrend(
  itemId: string,
  months: number = DEFAULT_LOOKBACK_MONTHS,
): Promise<ItemConsumptionTrend | null> {
  const lookback = Math.min(Math.max(months, 1), 60);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - lookback);

  const rows = await prisma.$queryRaw<TrendRow[]>`
    SELECT
      i.id                                           AS item_id,
      i.item_code,
      i.item_description,
      to_char(m.request_date, 'YYYY-MM')             AS month_key,
      COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty,
      COALESCE(SUM(
        COALESCE(ml.qty_issued, ml.qty_requested)::float *
        COALESCE(ml.unit_cost, 0)::float
      ), 0)                                          AS total_value,
      COUNT(DISTINCT m.id)::int                      AS issue_count
    FROM mirv_lines ml
    JOIN mirv m  ON m.id  = ml.mirv_id
    JOIN items i ON i.id  = ml.item_id
    WHERE ml.item_id  = ${itemId}::uuid
      AND m.request_date >= ${cutoff}
      AND m.status NOT IN ('draft', 'cancelled', 'rejected')
      AND i.status = 'active'
    GROUP BY i.id, i.item_code, i.item_description, to_char(m.request_date, 'YYYY-MM')
    ORDER BY month_key
  `;

  if (rows.length === 0) return null;

  // Build a complete month series (fill gaps with zeros)
  const monthlyMap = new Map<string, MonthlyConsumption>();
  const allMonthKeys = buildMonthKeys(lookback);

  for (const mk of allMonthKeys) {
    monthlyMap.set(mk, { month: mk, totalQty: 0, totalValue: 0, issueCount: 0 });
  }

  for (const row of rows) {
    monthlyMap.set(row.month_key, {
      month: row.month_key,
      totalQty: round2(row.total_qty),
      totalValue: round2(row.total_value),
      issueCount: Number(row.issue_count),
    });
  }

  const monthsArray = allMonthKeys.map(mk => monthlyMap.get(mk)!);

  // Average monthly consumption (across months with data, or all months)
  const totalQtyAll = monthsArray.reduce((s, m) => s + m.totalQty, 0);
  const averageMonthly = lookback > 0 ? round2(totalQtyAll / lookback) : 0;

  // Trend detection: last 3 months avg vs prior 3 months avg
  const trend = detectTrend(monthsArray.map(m => m.totalQty));

  const first = rows[0];

  log('info', `[Consumption Trend] Computed trend for item ${first.item_code} over ${lookback} months`);

  return {
    itemId: first.item_id,
    itemCode: first.item_code,
    itemDescription: first.item_description,
    months: monthsArray,
    averageMonthly,
    trend,
  };
}

/**
 * Get top N items by total consumption volume over a period.
 * Optionally filtered by warehouse.
 */
export async function getTopConsumptionItems(
  warehouseId?: string,
  months: number = DEFAULT_LOOKBACK_MONTHS,
  limit: number = 20,
): Promise<TopConsumptionItem[]> {
  const lookback = Math.min(Math.max(months, 1), 60);
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - lookback);

  let rows: TopItemRow[];

  if (warehouseId) {
    rows = await prisma.$queryRaw<TopItemRow[]>`
      SELECT
        i.id              AS item_id,
        i.item_code,
        i.item_description,
        COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty,
        COALESCE(SUM(
          COALESCE(ml.qty_issued, ml.qty_requested)::float *
          COALESCE(ml.unit_cost, 0)::float
        ), 0)             AS total_value,
        COUNT(DISTINCT m.id)::int AS issue_count
      FROM mirv_lines ml
      JOIN mirv m  ON m.id  = ml.mirv_id
      JOIN items i ON i.id  = ml.item_id
      WHERE m.request_date >= ${cutoff}
        AND m.status NOT IN ('draft', 'cancelled', 'rejected')
        AND m.warehouse_id = ${warehouseId}::uuid
        AND i.status = 'active'
      GROUP BY i.id, i.item_code, i.item_description
      HAVING COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) > 0
      ORDER BY total_qty DESC
      LIMIT ${safeLimit}
    `;
  } else {
    rows = await prisma.$queryRaw<TopItemRow[]>`
      SELECT
        i.id              AS item_id,
        i.item_code,
        i.item_description,
        COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty,
        COALESCE(SUM(
          COALESCE(ml.qty_issued, ml.qty_requested)::float *
          COALESCE(ml.unit_cost, 0)::float
        ), 0)             AS total_value,
        COUNT(DISTINCT m.id)::int AS issue_count
      FROM mirv_lines ml
      JOIN mirv m  ON m.id  = ml.mirv_id
      JOIN items i ON i.id  = ml.item_id
      WHERE m.request_date >= ${cutoff}
        AND m.status NOT IN ('draft', 'cancelled', 'rejected')
        AND i.status = 'active'
      GROUP BY i.id, i.item_code, i.item_description
      HAVING COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) > 0
      ORDER BY total_qty DESC
      LIMIT ${safeLimit}
    `;
  }

  const result: TopConsumptionItem[] = rows.map((row, idx) => ({
    rank: idx + 1,
    itemId: row.item_id,
    itemCode: row.item_code,
    itemDescription: row.item_description,
    totalQty: round2(row.total_qty),
    totalValue: round2(row.total_value),
    issueCount: Number(row.issue_count),
  }));

  log('info', `[Consumption Trend] Top ${result.length} items over ${lookback} months`);
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build an ordered array of YYYY-MM strings for the last N months. */
function buildMonthKeys(months: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** Detect trend by comparing average of last 3 months vs prior 3 months. */
function detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 6) {
    // Not enough data — compare last 2 vs prior 2 if possible
    if (values.length < 4) return 'stable';
    const recent = avg(values.slice(-2));
    const prior = avg(values.slice(-4, -2));
    return compareTrend(recent, prior);
  }

  const recentAvg = avg(values.slice(-3));
  const priorAvg = avg(values.slice(-6, -3));
  return compareTrend(recentAvg, priorAvg);
}

function compareTrend(recent: number, prior: number): 'increasing' | 'decreasing' | 'stable' {
  if (prior === 0 && recent === 0) return 'stable';
  if (prior === 0) return 'increasing';

  const change = (recent - prior) / prior;
  if (change > TREND_THRESHOLD) return 'increasing';
  if (change < -TREND_THRESHOLD) return 'decreasing';
  return 'stable';
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
