/**
 * Demand Forecasting Service
 *
 * Statistical demand forecasting from historical MirvLine consumption data.
 * Uses Simple Moving Average, Weighted Moving Average, linear regression trend,
 * and seasonal indices to project future demand for inventory items.
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ItemForecast {
  itemId: string;
  itemCode: string;
  itemName: string;
  historicalMonthly: Array<{ month: string; quantity: number }>;
  forecastMonthly: Array<{ month: string; quantity: number; confidence: 'high' | 'medium' | 'low' }>;
  avgMonthlyDemand: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendSlope: number;
  suggestedReorderPoint: number;
  currentStock?: number;
  reorderAlert: boolean;
}

export interface SeasonalPattern {
  itemId: string;
  itemCode: string;
  itemName: string;
  seasonalIndices: Array<{ month: number; index: number; label: string }>;
  seasonalityStrength: number; // 0-1, higher = more seasonal
  peakMonth: string;
  troughMonth: string;
}

interface MonthlyRow {
  item_id: string;
  item_code: string;
  item_description: string;
  month_key: string;
  total_qty: number;
}

interface StockRow {
  item_id: string;
  qty_on_hand: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const LOOKBACK_MONTHS = 24;
const FORECAST_MONTHS_DEFAULT = 3;
const LEAD_TIME_MONTHS = 1.5; // default lead time assumption
const SAFETY_FACTOR = 1.3; // safety stock multiplier
const WMA_WEIGHTS = [0.5, 0.3, 0.2]; // most recent → oldest
const TREND_THRESHOLD = 0.02; // slope magnitude below this = stable
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Utility Functions ───────────────────────────────────────────────────────

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

/** Build month keys for the next N months starting from now. */
function buildFutureMonthKeys(months: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** Simple linear regression returning slope and intercept. */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Compute WMA for the last 3 values of an array. */
function weightedMovingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const n = Math.min(values.length, WMA_WEIGHTS.length);
  const slice = values.slice(-n);
  const weights = WMA_WEIGHTS.slice(0, n);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let wma = 0;
  for (let i = 0; i < n; i++) {
    wma += slice[n - 1 - i] * weights[i];
  }
  return wma / totalWeight;
}

/** Compute confidence level based on data availability. */
function getConfidence(dataMonths: number, forecastIndex: number): 'high' | 'medium' | 'low' {
  if (dataMonths >= 12 && forecastIndex === 0) return 'high';
  if (dataMonths >= 6 && forecastIndex <= 1) return 'medium';
  return 'low';
}

// ── Core Data Fetch ─────────────────────────────────────────────────────────

/**
 * Fetch monthly consumption data from MirvLine for the last 24 months.
 * Groups by item + month, summing qtyIssued (falls back to qtyRequested).
 */
async function fetchMonthlyConsumption(warehouseId?: string, itemId?: string): Promise<MonthlyRow[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - LOOKBACK_MONTHS);

  if (warehouseId && itemId) {
    return prisma.$queryRaw<MonthlyRow[]>`
      SELECT
        i.id AS item_id,
        i.item_code,
        i.item_description,
        to_char(m.request_date, 'YYYY-MM') AS month_key,
        COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty
      FROM mirv_lines ml
      JOIN mirv m ON m.id = ml.mirv_id
      JOIN items i ON i.id = ml.item_id
      WHERE m.request_date >= ${cutoff}
        AND m.status NOT IN ('draft', 'cancelled', 'rejected')
        AND m.warehouse_id = ${warehouseId}::uuid
        AND ml.item_id = ${itemId}::uuid
        AND i.status = 'active'
      GROUP BY i.id, i.item_code, i.item_description, to_char(m.request_date, 'YYYY-MM')
      ORDER BY i.item_code, month_key
    `;
  }

  if (warehouseId) {
    return prisma.$queryRaw<MonthlyRow[]>`
      SELECT
        i.id AS item_id,
        i.item_code,
        i.item_description,
        to_char(m.request_date, 'YYYY-MM') AS month_key,
        COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty
      FROM mirv_lines ml
      JOIN mirv m ON m.id = ml.mirv_id
      JOIN items i ON i.id = ml.item_id
      WHERE m.request_date >= ${cutoff}
        AND m.status NOT IN ('draft', 'cancelled', 'rejected')
        AND m.warehouse_id = ${warehouseId}::uuid
        AND i.status = 'active'
      GROUP BY i.id, i.item_code, i.item_description, to_char(m.request_date, 'YYYY-MM')
      ORDER BY i.item_code, month_key
    `;
  }

  if (itemId) {
    return prisma.$queryRaw<MonthlyRow[]>`
      SELECT
        i.id AS item_id,
        i.item_code,
        i.item_description,
        to_char(m.request_date, 'YYYY-MM') AS month_key,
        COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty
      FROM mirv_lines ml
      JOIN mirv m ON m.id = ml.mirv_id
      JOIN items i ON i.id = ml.item_id
      WHERE m.request_date >= ${cutoff}
        AND m.status NOT IN ('draft', 'cancelled', 'rejected')
        AND ml.item_id = ${itemId}::uuid
        AND i.status = 'active'
      GROUP BY i.id, i.item_code, i.item_description, to_char(m.request_date, 'YYYY-MM')
      ORDER BY i.item_code, month_key
    `;
  }

  return prisma.$queryRaw<MonthlyRow[]>`
    SELECT
      i.id AS item_id,
      i.item_code,
      i.item_description,
      to_char(m.request_date, 'YYYY-MM') AS month_key,
      COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty
    FROM mirv_lines ml
    JOIN mirv m ON m.id = ml.mirv_id
    JOIN items i ON i.id = ml.item_id
    WHERE m.request_date >= ${cutoff}
      AND m.status NOT IN ('draft', 'cancelled', 'rejected')
      AND i.status = 'active'
    GROUP BY i.id, i.item_code, i.item_description, to_char(m.request_date, 'YYYY-MM')
    ORDER BY i.item_code, month_key
  `;
}

/**
 * Fetch current stock levels per item for a given warehouse.
 */
async function fetchCurrentStock(warehouseId?: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  if (!warehouseId) return map;

  const rows = await prisma.$queryRaw<StockRow[]>`
    SELECT item_id, qty_on_hand::float AS qty_on_hand
    FROM inventory_levels
    WHERE warehouse_id = ${warehouseId}::uuid
  `;

  for (const row of rows) {
    map.set(row.item_id, row.qty_on_hand);
  }

  return map;
}

// ── Forecast Computation ────────────────────────────────────────────────────

/**
 * Build a full forecast for a single item given its monthly consumption data.
 */
function computeItemForecast(
  itemId: string,
  itemCode: string,
  itemName: string,
  monthlyData: Map<string, number>,
  currentStock: number | undefined,
  forecastMonths: number,
): ItemForecast {
  const allMonthKeys = buildMonthKeys(LOOKBACK_MONTHS);
  const futureKeys = buildFutureMonthKeys(forecastMonths);

  // Build historical array with zeros for missing months
  const historicalMonthly: Array<{ month: string; quantity: number }> = [];
  const values: number[] = [];

  for (const mk of allMonthKeys) {
    const qty = monthlyData.get(mk) ?? 0;
    historicalMonthly.push({ month: mk, quantity: Math.round(qty * 100) / 100 });
    values.push(qty);
  }

  // Count months with actual data
  const dataMonths = values.filter(v => v > 0).length;
  const totalDemand = values.reduce((a, b) => a + b, 0);
  const avgMonthlyDemand = dataMonths > 0 ? totalDemand / Math.max(dataMonths, 1) : 0;

  // Linear regression for trend
  const { slope } = linearRegression(values);
  const normalizedSlope = avgMonthlyDemand > 0 ? slope / avgMonthlyDemand : 0;
  const trend: 'increasing' | 'decreasing' | 'stable' =
    normalizedSlope > TREND_THRESHOLD ? 'increasing' : normalizedSlope < -TREND_THRESHOLD ? 'decreasing' : 'stable';

  // Seasonal indices: average demand for each calendar month / overall average
  const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < allMonthKeys.length; i++) {
    const calMonth = parseInt(allMonthKeys[i].split('-')[1], 10) - 1;
    if (values[i] > 0) {
      monthBuckets[calMonth].push(values[i]);
    }
  }
  const seasonalIndices = monthBuckets.map(bucket => {
    if (bucket.length === 0 || avgMonthlyDemand === 0) return 1.0;
    const bucketAvg = bucket.reduce((a, b) => a + b, 0) / bucket.length;
    return bucketAvg / avgMonthlyDemand;
  });

  // WMA baseline
  const wma = weightedMovingAverage(values);

  // Forecast next N months: WMA * seasonal_index * trend_adjustment
  const forecastMonthly: Array<{ month: string; quantity: number; confidence: 'high' | 'medium' | 'low' }> = [];

  for (let i = 0; i < futureKeys.length; i++) {
    const calMonth = parseInt(futureKeys[i].split('-')[1], 10) - 1;
    const seasonalFactor = seasonalIndices[calMonth];
    const trendAdjustment = 1 + normalizedSlope * (i + 1);
    const rawForecast = wma * seasonalFactor * Math.max(trendAdjustment, 0.1);
    const forecast = Math.max(0, Math.round(rawForecast * 100) / 100);

    forecastMonthly.push({
      month: futureKeys[i],
      quantity: forecast,
      confidence: getConfidence(dataMonths, i),
    });
  }

  // Suggested reorder point: avg_monthly_demand * lead_time * safety_factor
  const suggestedReorderPoint = Math.round(avgMonthlyDemand * LEAD_TIME_MONTHS * SAFETY_FACTOR * 100) / 100;

  // Reorder alert: current stock below suggested reorder point
  const reorderAlert = currentStock !== undefined && currentStock < suggestedReorderPoint;

  return {
    itemId,
    itemCode,
    itemName,
    historicalMonthly,
    forecastMonthly,
    avgMonthlyDemand: Math.round(avgMonthlyDemand * 100) / 100,
    trend,
    trendSlope: Math.round(slope * 1000) / 1000,
    suggestedReorderPoint,
    currentStock,
    reorderAlert,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get demand forecast for one or all items.
 */
export async function getForecast(params: {
  itemId?: string;
  warehouseId?: string;
  months?: number;
}): Promise<ItemForecast[]> {
  const { itemId, warehouseId, months = FORECAST_MONTHS_DEFAULT } = params;
  const forecastMonths = Math.min(Math.max(months, 1), 12);

  const [rawData, stockMap] = await Promise.all([
    fetchMonthlyConsumption(warehouseId, itemId),
    fetchCurrentStock(warehouseId),
  ]);

  if (rawData.length === 0) {
    return [];
  }

  // Group by item
  const itemMap = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      monthlyData: Map<string, number>;
    }
  >();

  for (const row of rawData) {
    let entry = itemMap.get(row.item_id);
    if (!entry) {
      entry = {
        itemCode: row.item_code,
        itemName: row.item_description,
        monthlyData: new Map(),
      };
      itemMap.set(row.item_id, entry);
    }
    entry.monthlyData.set(row.month_key, row.total_qty);
  }

  // Compute forecast for each item
  const forecasts: ItemForecast[] = [];

  for (const [id, entry] of itemMap) {
    const forecast = computeItemForecast(
      id,
      entry.itemCode,
      entry.itemName,
      entry.monthlyData,
      stockMap.get(id),
      forecastMonths,
    );
    forecasts.push(forecast);
  }

  // Sort by average monthly demand descending
  forecasts.sort((a, b) => b.avgMonthlyDemand - a.avgMonthlyDemand);

  log('info', `[Demand Forecast] Computed forecast for ${forecasts.length} items`);
  return forecasts;
}

/**
 * Get top demand items — items with the highest predicted demand over the
 * forecast period.
 */
export async function getTopDemandItems(warehouseId?: string, limit = 20): Promise<ItemForecast[]> {
  const forecasts = await getForecast({ warehouseId });

  // Sum predicted demand over forecast months for sorting
  const withPredicted = forecasts.map(f => ({
    ...f,
    totalPredicted: f.forecastMonthly.reduce((s, m) => s + m.quantity, 0),
  }));

  withPredicted.sort((a, b) => b.totalPredicted - a.totalPredicted);

  return withPredicted.slice(0, limit);
}

/**
 * Get items where current stock is below the suggested reorder point.
 */
export async function getReorderAlerts(warehouseId?: string): Promise<ItemForecast[]> {
  const forecasts = await getForecast({ warehouseId });
  return forecasts.filter(f => f.reorderAlert);
}

/**
 * Get seasonal patterns for items — identifies which items have strong
 * seasonal demand patterns and their monthly indices.
 */
export async function getSeasonalPatterns(warehouseId?: string): Promise<SeasonalPattern[]> {
  const rawData = await fetchMonthlyConsumption(warehouseId);

  if (rawData.length === 0) return [];

  // Group by item
  const itemMap = new Map<
    string,
    {
      itemCode: string;
      itemName: string;
      monthlyData: Map<string, number>;
    }
  >();

  for (const row of rawData) {
    let entry = itemMap.get(row.item_id);
    if (!entry) {
      entry = {
        itemCode: row.item_code,
        itemName: row.item_description,
        monthlyData: new Map(),
      };
      itemMap.set(row.item_id, entry);
    }
    entry.monthlyData.set(row.month_key, row.total_qty);
  }

  const allMonthKeys = buildMonthKeys(LOOKBACK_MONTHS);
  const results: SeasonalPattern[] = [];

  for (const [itemId, entry] of itemMap) {
    // Build values array
    const values: number[] = allMonthKeys.map(mk => entry.monthlyData.get(mk) ?? 0);
    const dataMonths = values.filter(v => v > 0).length;
    if (dataMonths < 6) continue; // need at least 6 months of data

    const totalDemand = values.reduce((a, b) => a + b, 0);
    const avgMonthlyDemand = totalDemand / Math.max(dataMonths, 1);
    if (avgMonthlyDemand === 0) continue;

    // Compute seasonal indices per calendar month
    const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);
    for (let i = 0; i < allMonthKeys.length; i++) {
      const calMonth = parseInt(allMonthKeys[i].split('-')[1], 10) - 1;
      if (values[i] > 0) {
        monthBuckets[calMonth].push(values[i]);
      }
    }

    const indices = monthBuckets.map((bucket, idx) => {
      const avg = bucket.length > 0 ? bucket.reduce((a, b) => a + b, 0) / bucket.length : 0;
      return {
        month: idx + 1,
        index: avgMonthlyDemand > 0 ? Math.round((avg / avgMonthlyDemand) * 100) / 100 : 1.0,
        label: MONTH_LABELS[idx],
      };
    });

    // Seasonality strength: coefficient of variation of seasonal indices
    const idxValues = indices.map(si => si.index).filter(v => v > 0);
    const mean = idxValues.reduce((a, b) => a + b, 0) / idxValues.length;
    const variance = idxValues.reduce((s, v) => s + (v - mean) ** 2, 0) / idxValues.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const strength = Math.min(cv, 1.0);

    // Only include items with meaningful seasonality
    if (strength < 0.1) continue;

    // Peak and trough
    let peakIdx = 0;
    let troughIdx = 0;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i].index > indices[peakIdx].index) peakIdx = i;
      if (indices[i].index > 0 && (indices[troughIdx].index === 0 || indices[i].index < indices[troughIdx].index)) {
        troughIdx = i;
      }
    }

    results.push({
      itemId,
      itemCode: entry.itemCode,
      itemName: entry.itemName,
      seasonalIndices: indices,
      seasonalityStrength: Math.round(strength * 100) / 100,
      peakMonth: MONTH_LABELS[peakIdx],
      troughMonth: MONTH_LABELS[troughIdx],
    });
  }

  // Sort by seasonality strength descending
  results.sort((a, b) => b.seasonalityStrength - a.seasonalityStrength);

  log('info', `[Demand Forecast] Found ${results.length} items with seasonal patterns`);
  return results;
}
