/**
 * Predictive Reorder Point Calculator
 * Analyzes consumption velocity per item and predicts stockout dates.
 * Provides reorder point and quantity recommendations.
 *
 * Algorithm:
 * 1. Calculate Average Daily Consumption (ADC) from MI issuances over N days
 * 2. Calculate Safety Stock = Z-score * StdDev(daily consumption) * sqrt(lead time)
 * 3. Reorder Point = ADC * Lead Time + Safety Stock
 * 4. Predicted Stockout = Current Stock / ADC (days from now)
 * 5. Economic Order Quantity (EOQ) = sqrt(2 * Annual Demand * Order Cost / Holding Cost)
 */
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface ReorderPrediction {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  reservedQty: number;
  effectiveStock: number;
  /** Average daily consumption over analysis window */
  avgDailyConsumption: number;
  /** Standard deviation of daily consumption */
  stdDevDailyConsumption: number;
  /** Estimated lead time in days (from GRN history) */
  estimatedLeadTimeDays: number;
  /** Recommended reorder point */
  reorderPoint: number;
  /** Current reorder point (if set) */
  currentReorderPoint: number | null;
  /** Predicted days until stockout (null if no consumption) */
  daysUntilStockout: number | null;
  /** Predicted stockout date (null if no consumption) */
  predictedStockoutDate: Date | null;
  /** Recommended order quantity */
  suggestedOrderQty: number;
  /** Urgency: 'critical' | 'warning' | 'ok' */
  urgency: 'critical' | 'warning' | 'ok';
}

// ── Configuration ───────────────────────────────────────────────────────

const CONFIG = {
  /** Number of days to analyze for consumption patterns */
  analysisWindowDays: 90,
  /** Z-score for safety stock (1.65 = 95% service level) */
  safetyStockZScore: 1.65,
  /** Default lead time if no historical data (days) */
  defaultLeadTimeDays: 14,
  /** Days threshold for 'critical' urgency */
  criticalDays: 7,
  /** Days threshold for 'warning' urgency */
  warningDays: 21,
  /** Default order cost for EOQ calculation (SAR) */
  defaultOrderCost: 500,
  /** Default annual holding cost percentage */
  holdingCostPct: 0.2,
};

// ── Core Calculation ────────────────────────────────────────────────────

/**
 * Calculate consumption statistics for items with stock.
 */
async function getConsumptionStats(): Promise<
  Array<{
    itemId: string;
    itemCode: string;
    itemDescription: string;
    warehouseId: string;
    warehouseName: string;
    currentStock: number;
    reservedQty: number;
    reorderPoint: number | null;
    avgDaily: number;
    stddevDaily: number;
    totalIssued: number;
    activeDays: number;
  }>
> {
  try {
    const results = await prisma.$queryRaw<
      Array<{
        itemId: string;
        itemCode: string;
        itemDescription: string;
        warehouseId: string;
        warehouseName: string;
        currentStock: number;
        reservedQty: number;
        reorderPoint: number | null;
        avgDaily: number;
        stddevDaily: number;
        totalIssued: number;
        activeDays: number;
      }>
    >`
      WITH daily_consumption AS (
        SELECT
          ml."itemId",
          m."warehouseId",
          DATE(m."createdAt") AS issue_date,
          SUM(ml."qtyIssued")::float AS daily_qty
        FROM mirv_lines ml
        JOIN mirv m ON ml."mirvId" = m.id
        WHERE m.status IN ('issued', 'completed', 'partially_issued')
          AND m."createdAt" > NOW() - INTERVAL '${CONFIG.analysisWindowDays} days'
          AND ml."qtyIssued" > 0
        GROUP BY ml."itemId", m."warehouseId", DATE(m."createdAt")
      ),
      consumption_stats AS (
        SELECT
          dc."itemId",
          dc."warehouseId",
          AVG(dc.daily_qty)::float AS avg_daily,
          COALESCE(STDDEV_POP(dc.daily_qty), 0)::float AS stddev_daily,
          SUM(dc.daily_qty)::float AS total_issued,
          COUNT(DISTINCT dc.issue_date)::int AS active_days
        FROM daily_consumption dc
        GROUP BY dc."itemId", dc."warehouseId"
      )
      SELECT
        cs."itemId",
        i."itemCode",
        i."itemDescription",
        cs."warehouseId",
        w."warehouseName",
        il.qty_on_hand::float AS "currentStock",
        il.qty_reserved::float AS "reservedQty",
        il.reorder_point::float AS "reorderPoint",
        cs.avg_daily AS "avgDaily",
        cs.stddev_daily AS "stddevDaily",
        cs.total_issued AS "totalIssued",
        cs.active_days AS "activeDays"
      FROM consumption_stats cs
      JOIN inventory_levels il ON cs."itemId" = il.item_id AND cs."warehouseId" = il.warehouse_id
      JOIN items i ON cs."itemId" = i.id
      JOIN warehouses w ON cs."warehouseId" = w.id
      WHERE il.qty_on_hand > 0
      ORDER BY cs.avg_daily DESC
    `;

    return results;
  } catch (err) {
    log('warn', `[ReorderPrediction] Consumption stats query failed: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Estimate average lead time for an item from historical GRN data.
 * Lead time = average days between PO date and GRN received date.
 */
async function getLeadTimeEstimate(itemId: string): Promise<number> {
  try {
    const result = await prisma.$queryRaw<[{ avg_lead_days: number | null }]>`
      SELECT AVG(
        EXTRACT(EPOCH FROM (m."receivedDate" - m."createdAt")) / 86400
      )::float AS avg_lead_days
      FROM mrrv_lines ml
      JOIN mrrv m ON ml."mrrvId" = m.id
      WHERE ml."itemId" = ${itemId}::uuid
        AND m."receivedDate" IS NOT NULL
        AND m."createdAt" > NOW() - INTERVAL '365 days'
    `;
    return result[0]?.avg_lead_days ?? CONFIG.defaultLeadTimeDays;
  } catch {
    return CONFIG.defaultLeadTimeDays;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Generate reorder predictions for all active inventory items.
 */
export async function generateReorderPredictions(): Promise<ReorderPrediction[]> {
  log('info', '[ReorderPrediction] Generating predictions...');

  const stats = await getConsumptionStats();
  const predictions: ReorderPrediction[] = [];

  for (const item of stats) {
    // Scale avg daily consumption: total issued / analysis window days
    // (not just active days, to account for zero-consumption days)
    const avgDailyConsumption = item.totalIssued / CONFIG.analysisWindowDays;
    const stdDevDaily = item.stddevDaily;

    // Estimate lead time
    const leadTime = await getLeadTimeEstimate(item.itemId);

    // Safety Stock = Z * stddev * sqrt(lead time)
    const safetyStock = CONFIG.safetyStockZScore * stdDevDaily * Math.sqrt(leadTime);

    // Reorder Point = (ADC * Lead Time) + Safety Stock
    const reorderPoint = Math.ceil(avgDailyConsumption * leadTime + safetyStock);

    // Effective stock
    const effectiveStock = item.currentStock - item.reservedQty;

    // Days until stockout
    const daysUntilStockout =
      avgDailyConsumption > 0 ? Math.max(0, Math.floor(effectiveStock / avgDailyConsumption)) : null;

    const predictedStockoutDate =
      daysUntilStockout !== null ? new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000) : null;

    // EOQ (Economic Order Quantity)
    const annualDemand = avgDailyConsumption * 365;
    const eoq =
      annualDemand > 0
        ? Math.ceil(
            Math.sqrt(
              (2 * annualDemand * CONFIG.defaultOrderCost) /
                (CONFIG.holdingCostPct * (CONFIG.defaultOrderCost / annualDemand || 1)),
            ),
          )
        : reorderPoint * 2;

    // Suggested order qty = max of EOQ or enough to last until next order
    const suggestedOrderQty = Math.max(eoq, reorderPoint);

    // Urgency
    let urgency: 'critical' | 'warning' | 'ok' = 'ok';
    if (daysUntilStockout !== null && daysUntilStockout <= CONFIG.criticalDays) {
      urgency = 'critical';
    } else if (daysUntilStockout !== null && daysUntilStockout <= CONFIG.warningDays) {
      urgency = 'warning';
    } else if (effectiveStock <= reorderPoint) {
      urgency = 'warning';
    }

    predictions.push({
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemDescription: item.itemDescription,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouseName,
      currentStock: item.currentStock,
      reservedQty: item.reservedQty,
      effectiveStock,
      avgDailyConsumption,
      stdDevDailyConsumption: stdDevDaily,
      estimatedLeadTimeDays: leadTime,
      reorderPoint,
      currentReorderPoint: item.reorderPoint,
      daysUntilStockout,
      predictedStockoutDate,
      suggestedOrderQty,
      urgency,
    });
  }

  // Sort: critical first, then by days until stockout
  predictions.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, ok: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity);
  });

  log(
    'info',
    `[ReorderPrediction] Generated ${predictions.length} predictions (${predictions.filter(p => p.urgency === 'critical').length} critical)`,
  );

  return predictions;
}

/**
 * Get predictions for a specific warehouse.
 */
export async function getWarehousePredictions(warehouseId: string): Promise<ReorderPrediction[]> {
  const all = await generateReorderPredictions();
  return all.filter(p => p.warehouseId === warehouseId);
}

/**
 * Auto-update reorder points in inventory_levels based on predictions.
 * Only updates items where the calculated reorder point differs significantly
 * from the current one (>20% difference).
 */
export async function autoUpdateReorderPoints(): Promise<{ updated: number; total: number }> {
  const predictions = await generateReorderPredictions();
  let updated = 0;

  for (const p of predictions) {
    if (p.avgDailyConsumption === 0) continue; // Skip items with no consumption

    const current = p.currentReorderPoint ?? 0;
    const diff = Math.abs(p.reorderPoint - current);
    const pctDiff = current > 0 ? diff / current : 1;

    // Only update if >20% different or if currently unset
    if (pctDiff > 0.2 || p.currentReorderPoint === null) {
      try {
        await prisma.inventoryLevel.updateMany({
          where: { itemId: p.itemId, warehouseId: p.warehouseId },
          data: { reorderPoint: p.reorderPoint },
        });
        updated++;
      } catch {
        // Non-critical
      }
    }
  }

  log('info', `[ReorderPrediction] Auto-updated ${updated}/${predictions.length} reorder points`);
  return { updated, total: predictions.length };
}
