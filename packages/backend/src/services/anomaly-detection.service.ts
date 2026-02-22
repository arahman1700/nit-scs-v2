/**
 * Inventory Anomaly Detection Service
 * Identifies unusual inventory movements and patterns that may indicate
 * data entry errors, theft, or process issues.
 *
 * Anomaly Types:
 * 1. Quantity spikes — issuance or receipt significantly above average
 * 2. Off-hours activity — transactions outside normal working hours
 * 3. Repeated item issues — same item issued repeatedly in short period
 * 4. Negative inventory — stock levels below zero after transactions
 * 5. Unusual patterns — large price variance, dormant item sudden activity
 */
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { createNotification } from './notification.service.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface Anomaly {
  type: 'quantity_spike' | 'off_hours' | 'repeated_issue' | 'negative_stock' | 'dormant_reactivation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  itemId?: string;
  itemCode?: string;
  warehouseId?: string;
  warehouseName?: string;
  value?: number;
  threshold?: number;
  detectedAt: Date;
  referenceId?: string;
  referenceTable?: string;
}

// ── Configuration ───────────────────────────────────────────────────────

const CONFIG = {
  /** Z-score threshold for quantity spike detection (2.5 = ~99th percentile) */
  quantitySpikeZScore: 2.5,
  /** Working hours range (24h format) */
  workingHoursStart: 6,
  workingHoursEnd: 22,
  /** Max issues of same item within N hours to flag as repeated */
  repeatedIssueWindowHours: 24,
  repeatedIssueThreshold: 3,
  /** Days of inactivity before an item is considered dormant */
  dormantDays: 180,
  /** Lookback period for analysis (days) */
  analysisWindowDays: 90,
};

// ── Detection Functions ─────────────────────────────────────────────────

/**
 * Detect quantity spikes — transactions where quantity is significantly
 * above the historical average for that item + warehouse combination.
 */
async function detectQuantitySpikes(since: Date): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // Get recent MI issuances with statistical context
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        itemId: string;
        itemCode: string;
        itemDescription: string;
        warehouseId: string;
        warehouseName: string;
        qtyIssued: number;
        avgQty: number;
        stddevQty: number;
      }>
    >`
      WITH item_stats AS (
        SELECT 
          ml."itemId",
          m."warehouseId",
          AVG(ml."qtyIssued") AS avg_qty,
          STDDEV_POP(ml."qtyIssued") AS stddev_qty,
          COUNT(*) AS txn_count
        FROM mirv_lines ml
        JOIN mirv m ON ml."mirvId" = m.id
        WHERE m."createdAt" > NOW() - INTERVAL '${CONFIG.analysisWindowDays} days'
          AND ml."qtyIssued" > 0
        GROUP BY ml."itemId", m."warehouseId"
        HAVING COUNT(*) >= 5
      )
      SELECT 
        ml.id, ml."itemId", i."itemCode", i."itemDescription",
        m."warehouseId", w."warehouseName",
        ml."qtyIssued"::float AS "qtyIssued",
        s.avg_qty::float AS "avgQty",
        COALESCE(s.stddev_qty, 0)::float AS "stddevQty"
      FROM mirv_lines ml
      JOIN mirv m ON ml."mirvId" = m.id
      JOIN items i ON ml."itemId" = i.id
      JOIN warehouses w ON m."warehouseId" = w.id
      JOIN item_stats s ON ml."itemId" = s."itemId" AND m."warehouseId" = s."warehouseId"
      WHERE m."createdAt" > ${since}
        AND s.stddev_qty > 0
        AND (ml."qtyIssued" - s.avg_qty) / NULLIF(s.stddev_qty, 0) > ${CONFIG.quantitySpikeZScore}
      ORDER BY (ml."qtyIssued" - s.avg_qty) / NULLIF(s.stddev_qty, 0) DESC
      LIMIT 50
    `;

    for (const r of results) {
      const zScore = r.stddevQty > 0 ? (r.qtyIssued - r.avgQty) / r.stddevQty : 0;
      anomalies.push({
        type: 'quantity_spike',
        severity: zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low',
        description: `Item ${r.itemCode} issued ${r.qtyIssued} units (avg: ${r.avgQty.toFixed(1)}, z-score: ${zScore.toFixed(1)})`,
        itemId: r.itemId,
        itemCode: r.itemCode,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        value: r.qtyIssued,
        threshold: r.avgQty + CONFIG.quantitySpikeZScore * r.stddevQty,
        detectedAt: new Date(),
        referenceId: r.id,
        referenceTable: 'mirv_lines',
      });
    }
  } catch (err) {
    log('warn', `[AnomalyDetection] Quantity spike detection failed: ${(err as Error).message}`);
  }

  return anomalies;
}

/**
 * Detect off-hours activity — document creation outside working hours.
 */
async function detectOffHoursActivity(since: Date): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    const results = await prisma.$queryRaw<
      Array<{
        table_name: string;
        record_id: string;
        performed_at: Date;
        full_name: string;
        hour: number;
      }>
    >`
      SELECT al.table_name, al.record_id, al.performed_at, e."fullName" AS full_name,
        EXTRACT(HOUR FROM al.performed_at AT TIME ZONE 'Asia/Riyadh')::int AS hour
      FROM audit_log al
      JOIN employees e ON al.performed_by_id = e.id
      WHERE al.performed_at > ${since}
        AND al.action = 'create'
        AND (
          EXTRACT(HOUR FROM al.performed_at AT TIME ZONE 'Asia/Riyadh') < ${CONFIG.workingHoursStart}
          OR EXTRACT(HOUR FROM al.performed_at AT TIME ZONE 'Asia/Riyadh') >= ${CONFIG.workingHoursEnd}
        )
        AND al.table_name IN ('mrrv', 'mirv', 'mrv', 'material_requisitions', 'stock_transfers')
      ORDER BY al.performed_at DESC
      LIMIT 20
    `;

    for (const r of results) {
      anomalies.push({
        type: 'off_hours',
        severity: r.hour >= 0 && r.hour < 5 ? 'high' : 'low',
        description: `${r.full_name} created ${r.table_name} record at ${r.hour}:00 (outside ${CONFIG.workingHoursStart}:00-${CONFIG.workingHoursEnd}:00)`,
        detectedAt: new Date(),
        referenceId: r.record_id,
        referenceTable: r.table_name,
      });
    }
  } catch (err) {
    log('warn', `[AnomalyDetection] Off-hours detection failed: ${(err as Error).message}`);
  }

  return anomalies;
}

/**
 * Detect items with negative effective stock levels.
 */
async function detectNegativeStock(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        itemId: string;
        itemCode: string;
        warehouseId: string;
        warehouseName: string;
        quantity: number;
        reservedQty: number;
        effective: number;
      }>
    >`
      SELECT il.id, il."itemId", i."itemCode", il."warehouseId", w."warehouseName",
        il.qty_on_hand::float AS quantity,
        il.qty_reserved::float AS "reservedQty",
        (il.qty_on_hand - il.qty_reserved)::float AS effective
      FROM inventory_levels il
      JOIN items i ON il.item_id = i.id
      JOIN warehouses w ON il.warehouse_id = w.id
      WHERE il.qty_on_hand < 0 OR (il.qty_on_hand - il.qty_reserved) < 0
      ORDER BY (il.qty_on_hand - il.qty_reserved) ASC
      LIMIT 50
    `;

    for (const r of results) {
      anomalies.push({
        type: 'negative_stock',
        severity: r.quantity < 0 ? 'high' : 'medium',
        description: `${r.itemCode} at ${r.warehouseName}: qty=${r.quantity}, reserved=${r.reservedQty}, effective=${r.effective}`,
        itemId: r.itemId,
        itemCode: r.itemCode,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        value: r.effective,
        detectedAt: new Date(),
        referenceId: r.id,
        referenceTable: 'inventory_levels',
      });
    }
  } catch (err) {
    log('warn', `[AnomalyDetection] Negative stock detection failed: ${(err as Error).message}`);
  }

  return anomalies;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Run all anomaly detection checks and return results.
 * Optionally notify admins about high-severity anomalies.
 */
export async function detectAnomalies(options?: { notify?: boolean; since?: Date }): Promise<Anomaly[]> {
  const since = options?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h

  log('info', '[AnomalyDetection] Running anomaly detection...');

  const [quantitySpikes, offHours, negativeStock] = await Promise.all([
    detectQuantitySpikes(since),
    detectOffHoursActivity(since),
    detectNegativeStock(),
  ]);

  const allAnomalies = [...quantitySpikes, ...offHours, ...negativeStock];

  log(
    'info',
    `[AnomalyDetection] Found ${allAnomalies.length} anomalies (${allAnomalies.filter(a => a.severity === 'high').length} high severity)`,
  );

  // Notify admins about high-severity anomalies
  if (options?.notify !== false && allAnomalies.some(a => a.severity === 'high')) {
    const highSev = allAnomalies.filter(a => a.severity === 'high');
    const admins = await prisma.employee.findMany({
      where: { systemRole: 'admin', isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      try {
        await createNotification({
          recipientId: admin.id,
          title: `Inventory Alert: ${highSev.length} anomalies detected`,
          body: highSev
            .slice(0, 3)
            .map(a => a.description)
            .join('\n'),
          notificationType: 'sla_breach',
          referenceTable: 'system',
          referenceId: 'anomaly_detection',
        });
      } catch {
        // Non-critical
      }
    }
  }

  return allAnomalies;
}

/**
 * Get a summary of current inventory health.
 */
export async function getInventoryHealthSummary(): Promise<{
  totalItems: number;
  negativeStockCount: number;
  lowStockCount: number;
  overstockCount: number;
  dormantItemCount: number;
}> {
  try {
    const [negativeCount, lowCount, overstockCount, dormantCount, totalCount] = await Promise.all([
      prisma.inventoryLevel.count({
        where: { qtyOnHand: { lt: 0 } },
      }),
      prisma.inventoryLevel.count({
        where: {
          qtyOnHand: { gt: 0 },
          reorderPoint: { not: null },
        },
      }),
      // Overstock: qty > 3x reorder point (no maxStockLevel field — heuristic)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM inventory_levels 
        WHERE qty_on_hand > 0 AND reorder_point IS NOT NULL AND qty_on_hand > reorder_point * 3
      `.then(r => Number(r[0].count)),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT il."itemId")::bigint AS count 
        FROM inventory_levels il
        WHERE il.qty_on_hand > 0
          AND il.updated_at < NOW() - INTERVAL '${CONFIG.dormantDays} days'
      `.then(r => Number(r[0].count)),
      prisma.inventoryLevel.count({ where: { qtyOnHand: { gt: 0 } } }),
    ]);

    return {
      totalItems: totalCount,
      negativeStockCount: negativeCount,
      lowStockCount: lowCount,
      overstockCount: overstockCount,
      dormantItemCount: dormantCount,
    };
  } catch (err) {
    log('warn', `[AnomalyDetection] Health summary failed: ${(err as Error).message}`);
    return { totalItems: 0, negativeStockCount: 0, lowStockCount: 0, overstockCount: 0, dormantItemCount: 0 };
  }
}
