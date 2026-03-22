/**
 * Maintenance Jobs — email retry, token cleanup, ABC classification,
 * anomaly detection, reorder points, security detection, expired lots,
 * low stock, gate pass expiry, cycle counts, daily reconciliation,
 * scheduled reports, asset depreciation, visitor overstay, scheduled rules.
 *
 * Self-registers all maintenance-related scheduled jobs.
 */

import { registerJob } from '../../../utils/job-registry.js';
import type { JobContext } from '../../../utils/job-registry.js';
import { getEnv } from '../../../config/env.js';
import { processQueuedEmails } from '../../system/services/email.service.js';
import { cleanupExpiredTokens } from '../../auth/services/auth.service.js';
import { calculateABCClassification, applyABCClassification } from '../../inventory/services/abc-analysis.service.js';
import { autoCreateCycleCounts } from '../../inventory/services/cycle-count.service.js';
import { detectAnomalies } from '../../reporting/services/anomaly-detection.service.js';
import { autoUpdateReorderPoints } from '../../reporting/services/reorder-prediction.service.js';
import { calculateDepreciation } from '../../equipment/services/asset.service.js';
import { processScheduledRules } from '../../../events/scheduled-rule-runner.js';
import { detectSuspiciousActivity } from '../../auth/services/security.service.js';
import { checkExpiringContracts as checkAmcExpiry } from '../../equipment/services/amc.service.js';
import { checkDueMaintenances as checkVehicleMaintenanceDueM8 } from '../../equipment/services/vehicle-maintenance.service.js';
import { syncPurchaseOrders } from '../../inbound/services/oracle-po-sync.service.js';

// ── Email Retry ──────────────────────────────────────────────────────────

async function retryEmails(ctx: JobContext): Promise<void> {
  try {
    const sent = await processQueuedEmails();
    if (sent > 0) {
      ctx.log('info', `[Scheduler] Email retry: ${sent} sent`);
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Email retry failed: ${(err as Error).message}`);
  }
}

// ── Expired Lot Marking ──────────────────────────────────────────────────

async function markExpiredLots(ctx: JobContext): Promise<void> {
  try {
    const result = await ctx.prisma.inventoryLot.updateMany({
      where: {
        status: 'active',
        expiryDate: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      ctx.log('info', `[Scheduler] Marked ${result.count} expired lot(s)`);
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Expired lot check failed: ${(err as Error).message}`);
  }
}

// ── Low Stock Alert Check ────────────────────────────────────────────────

async function checkLowStock(ctx: JobContext): Promise<void> {
  try {
    const lowStockItems = await ctx.prisma.$queryRaw<
      Array<{
        item_id: string;
        warehouse_id: string;
        qty_on_hand: number;
        qty_reserved: number;
        min_level: number | null;
        reorder_point: number | null;
        item_code: string;
        item_description: string;
        warehouse_code: string;
      }>
    >`
      SELECT
        il.item_id,
        il.warehouse_id,
        il.qty_on_hand::float,
        il.qty_reserved::float,
        il.min_level::float,
        il.reorder_point::float,
        i.item_code,
        i.item_description,
        w.warehouse_code
      FROM "MTL_ONHAND_QUANTITIES" il
      JOIN "MTL_SYSTEM_ITEMS" i ON i.id = il.item_id
      JOIN "WMS_WAREHOUSES" w ON w.id = il.warehouse_id
      WHERE il.alert_sent = false
        AND (
          (il.min_level IS NOT NULL AND (il.qty_on_hand - il.qty_reserved) <= il.min_level)
          OR (il.reorder_point IS NOT NULL AND (il.qty_on_hand - il.qty_reserved) <= il.reorder_point)
        )
      LIMIT 100
    `;

    if (lowStockItems.length === 0) return;

    await ctx.prisma.inventoryLevel.updateMany({
      where: {
        OR: lowStockItems.map(i => ({
          itemId: i.item_id,
          warehouseId: i.warehouse_id,
        })),
      },
      data: { alertSent: true },
    });

    const warehouseStaff = await ctx.prisma.employee.findMany({
      where: { systemRole: { in: ['warehouse_staff', 'admin'] }, isActive: true },
      select: { id: true },
    });

    const isCritical = lowStockItems.some(i => i.min_level !== null && i.qty_on_hand - i.qty_reserved <= i.min_level);
    const notificationBody =
      lowStockItems
        .slice(0, 5)
        .map(i => `${i.item_code} at ${i.warehouse_code}: ${(i.qty_on_hand - i.qty_reserved).toFixed(0)} available`)
        .join(', ') + (lowStockItems.length > 5 ? ` (+${lowStockItems.length - 5} more)` : '');

    await Promise.all(
      warehouseStaff.map(staff =>
        ctx.createNotification(
          {
            recipientId: staff.id,
            title: `Low Stock Alert: ${lowStockItems.length} item(s)`,
            body: notificationBody,
            notificationType: isCritical ? 'alert' : 'warning',
            referenceTable: 'inventory_levels',
          },
          ctx.io ?? undefined,
        ),
      ),
    );

    ctx.log('warn', `[Scheduler] Low stock: ${lowStockItems.length} item(s) below threshold`);
  } catch (err) {
    ctx.log('error', `[Scheduler] Low stock check failed: ${(err as Error).message}`);
  }
}

// ── Token Cleanup ────────────────────────────────────────────────────────

async function cleanupTokens(ctx: JobContext): Promise<void> {
  try {
    const count = await cleanupExpiredTokens();
    if (count > 0) {
      ctx.log('info', `[Scheduler] Cleaned up ${count} expired refresh token(s)`);
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Token cleanup failed: ${(err as Error).message}`);
  }
}

// ── ABC Classification Recalculation ─────────────────────────────────────

async function recalculateAbcClassification(ctx: JobContext): Promise<void> {
  try {
    const results = await calculateABCClassification();
    if (results.length > 0) {
      await applyABCClassification(results);
      ctx.log(
        'info',
        `[Scheduler] ABC classification: ${results.length} items updated (A: ${results.filter(r => r.abcClass === 'A').length}, B: ${results.filter(r => r.abcClass === 'B').length}, C: ${results.filter(r => r.abcClass === 'C').length})`,
      );
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] ABC classification failed: ${(err as Error).message}`);
  }
}

// ── Cycle Count Auto-Create ───────────────────────────────────────────────

async function runCycleCountAutoCreate(ctx: JobContext): Promise<void> {
  try {
    await autoCreateCycleCounts();
    ctx.log('info', '[Scheduler] Cycle count auto-creation completed');
  } catch (err) {
    ctx.log('error', `[Scheduler] Cycle count auto-creation failed: ${(err as Error).message}`);
  }
}

// ── Gate Pass Expiry Check ────────────────────────────────────────────────

async function expireGatePasses(ctx: JobContext): Promise<void> {
  try {
    const result = await ctx.prisma.gatePass.updateMany({
      where: {
        status: { in: ['approved', 'pending'] },
        validUntil: { lt: new Date() },
      },
      data: { status: 'cancelled' },
    });

    if (result.count > 0) {
      ctx.log('info', `[Scheduler] Expired ${result.count} gate pass(es) past validUntil date`);

      const securityStaff = await ctx.prisma.employee.findMany({
        where: {
          systemRole: { in: ['security_officer', 'warehouse_supervisor'] },
          isActive: true,
        },
        select: { id: true },
      });

      if (securityStaff.length > 0) {
        await ctx.prisma.notification.createMany({
          data: securityStaff.map(r => ({
            recipientId: r.id,
            title: `${result.count} gate pass(es) auto-expired`,
            body: `${result.count} gate pass(es) exceeded their valid-until date and have been automatically cancelled.`,
            notificationType: 'gate_pass_expired',
          })),
        });
      }
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Gate pass expiry check failed: ${(err as Error).message}`);
  }
}

// ── Anomaly Detection (Scheduled) ────────────────────────────────────────

async function runAnomalyDetection(ctx: JobContext): Promise<void> {
  try {
    const anomalies = await detectAnomalies({ notify: true });
    const highCount = anomalies.filter(a => a.severity === 'high').length;
    if (anomalies.length > 0) {
      ctx.log(
        highCount > 0 ? 'warn' : 'info',
        `[Scheduler] Anomaly detection: ${anomalies.length} found (${highCount} high severity)`,
      );
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Anomaly detection failed: ${(err as Error).message}`);
  }
}

// ── Reorder Point Auto-Update (Scheduled) ────────────────────────────────

async function runReorderPointUpdate(ctx: JobContext): Promise<void> {
  try {
    const result = await autoUpdateReorderPoints();
    if (result.updated > 0) {
      ctx.log('info', `[Scheduler] Reorder points auto-updated: ${result.updated}/${result.total}`);
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Reorder point update failed: ${(err as Error).message}`);
  }
}

// ── C7: Daily Material Movement Reconciliation ─────────────────────────

async function runDailyReconciliation(ctx: JobContext): Promise<void> {
  ctx.log('info', '[Scheduler] Running daily material movement reconciliation');

  try {
    const lotSummaries = await ctx.prisma.$queryRaw<
      Array<{ item_id: string; warehouse_id: string; lot_total: number }>
    >`
      SELECT
        il."item_id",
        il."warehouse_id",
        COALESCE(SUM(il."available_qty"), 0)::numeric AS lot_total
      FROM "MTL_LOT_NUMBERS" il
      WHERE il.status IN ('active', 'blocked')
      GROUP BY il."item_id", il."warehouse_id"
    `;

    const levels = await ctx.prisma.inventoryLevel.findMany({
      select: { id: true, itemId: true, warehouseId: true, qtyOnHand: true },
    });

    const lotMap = new Map<string, number>();
    for (const row of lotSummaries) {
      lotMap.set(`${row.item_id}:${row.warehouse_id}`, Number(row.lot_total));
    }

    const threshold = getEnv().RECONCILIATION_THRESHOLD;

    const discrepancies: Array<{
      itemId: string;
      warehouseId: string;
      qtyOnHand: number;
      lotTotal: number;
      diff: number;
    }> = [];

    for (const level of levels) {
      const key = `${level.itemId}:${level.warehouseId}`;
      const lotTotal = lotMap.get(key) ?? 0;
      const onHand = Number(level.qtyOnHand);
      const diff = Math.abs(onHand - lotTotal);

      if (diff > 0) {
        discrepancies.push({
          itemId: level.itemId,
          warehouseId: level.warehouseId,
          qtyOnHand: onHand,
          lotTotal,
          diff,
        });
      }
    }

    // Filter to only significant discrepancies above threshold
    const significantDiscrepancies = discrepancies.filter(d => Math.abs(d.diff) > threshold);

    if (significantDiscrepancies.length > 0) {
      ctx.log(
        'warn',
        `[Reconciliation] ${significantDiscrepancies.length} discrepancies above threshold ${threshold}`,
        { discrepancies: significantDiscrepancies.slice(0, 10) },
      );

      // Create audit log entries for each discrepancy
      for (const d of significantDiscrepancies) {
        await ctx.prisma.auditLog.create({
          data: {
            tableName: 'InventoryLevel',
            recordId: d.itemId,
            action: 'reconciliation_discrepancy',
            performedAt: new Date(),
            changedFields: ['qtyOnHand'],
            oldValues: {
              qtyOnHand: d.qtyOnHand,
              warehouseId: d.warehouseId,
            },
            newValues: {
              lotTotal: d.lotTotal,
              diff: d.diff,
              threshold,
            },
          },
        });
      }

      // Notify relevant staff about discrepancies
      const supervisorIds = await ctx.getEmployeeIdsByRole('warehouse_supervisor');
      const inventorySpecialistIds = await ctx.getEmployeeIdsByRole('inventory_specialist');
      const adminIds = await ctx.getAdminIds();
      const allRecipients = [...new Set([...supervisorIds, ...inventorySpecialistIds, ...adminIds])];

      if (allRecipients.length > 0) {
        const top5 = significantDiscrepancies
          .slice(0, 5)
          .map(d => `Item ${d.itemId}: expected ${d.lotTotal}, actual ${d.qtyOnHand} (delta ${d.diff.toFixed(3)})`);

        await ctx.notifySla({
          recipientIds: allRecipients,
          title: `Reconciliation Alert: ${significantDiscrepancies.length} discrepancies`,
          body: `Daily reconciliation found ${significantDiscrepancies.length} inventory level mismatches.\n${top5.join('\n')}`,
          notificationType: 'reconciliation_alert',
          referenceTable: 'inventory_levels',
          referenceId: 'daily-reconciliation',
          socketEvent: 'inventory:reconciliation',
          socketRoles: ['admin', 'warehouse_supervisor', 'inventory_specialist'],
        });
      }
    }

    // Always log summary
    ctx.log(
      'info',
      `[Reconciliation] Completed: ${significantDiscrepancies.length} discrepancies above threshold ${threshold} (${discrepancies.length} total, ${discrepancies.length - significantDiscrepancies.length} below threshold)`,
    );

    // ── SOW Gap 5: Gate movement vs inventory transaction reconciliation ──
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [gateOutbound, miIssued] = await Promise.all([
      ctx.prisma.$queryRaw<Array<{ item_id: string; warehouse_id: string; total_qty: number }>>`
        SELECT gpi.item_id, gp.warehouse_id, COALESCE(SUM(gpi.quantity), 0)::float AS total_qty
        FROM "WMS_GATE_PASS_ITEMS" gpi
        JOIN "WMS_GATE_PASSES" gp ON gp.id = gpi.gate_pass_id
        WHERE gp.status = 'released'
          AND gp.pass_type = 'outbound'
          AND gp.exit_time >= ${oneDayAgo}
        GROUP BY gpi.item_id, gp.warehouse_id
      `,
      ctx.prisma.$queryRaw<Array<{ item_id: string; warehouse_id: string; total_qty: number }>>`
        SELECT ml.item_id, m.warehouse_id, COALESCE(SUM(ml.qty_issued), 0)::float AS total_qty
        FROM "ONT_ISSUE_LINES" ml
        JOIN "ONT_ISSUE_HEADERS" m ON m.id = ml.mirv_id
        WHERE m.status IN ('issued', 'partially_issued')
          AND m.issued_date >= ${oneDayAgo}
        GROUP BY ml.item_id, m.warehouse_id
      `,
    ]);

    const gateMap = new Map(gateOutbound.map(r => [`${r.item_id}:${r.warehouse_id}`, r.total_qty]));
    const gateDiscrepancies: Array<{ itemId: string; warehouseId: string; gateQty: number; miQty: number }> = [];

    for (const mi of miIssued) {
      const key = `${mi.item_id}:${mi.warehouse_id}`;
      const gateQty = gateMap.get(key) ?? 0;
      if (Math.abs(gateQty - mi.total_qty) > 0.01) {
        gateDiscrepancies.push({ itemId: mi.item_id, warehouseId: mi.warehouse_id, gateQty, miQty: mi.total_qty });
      }
      gateMap.delete(key);
    }

    // Items through gate with no MI record
    for (const [key, gateQty] of gateMap) {
      const [itemId, warehouseId] = key.split(':');
      gateDiscrepancies.push({ itemId, warehouseId, gateQty, miQty: 0 });
    }

    if (gateDiscrepancies.length > 0) {
      ctx.log('warn', `[reconciliation] ${gateDiscrepancies.length} gate-vs-inventory discrepancies`);

      const detail = gateDiscrepancies
        .slice(0, 5)
        .map(d => `Item ${d.itemId.slice(0, 8)}… WH ${d.warehouseId.slice(0, 8)}…: gate=${d.gateQty} MI=${d.miQty}`)
        .join('\n');

      const gateSupervisorIds = await ctx.getEmployeeIdsByRole('warehouse_supervisor');
      const gateOfficerIds = await ctx.getEmployeeIdsByRole('gate_officer');
      const gateRecipients = [...new Set([...gateSupervisorIds, ...gateOfficerIds])];

      if (gateRecipients.length > 0) {
        await ctx.notifySla({
          recipientIds: gateRecipients,
          title: 'Gate vs Inventory Mismatch',
          body: `${gateDiscrepancies.length} discrepancies found in last 24h:\n${detail}`,
          notificationType: 'gate_reconciliation',
          referenceTable: 'gate_passes',
          referenceId: 'gate-reconciliation',
          socketEvent: 'inventory:gate-reconciliation',
          socketRoles: ['warehouse_supervisor', 'gate_officer'],
        });
      }
    } else {
      ctx.log('info', '[reconciliation] Gate-vs-inventory check: no discrepancies');
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Reconciliation failed: ${(err as Error).message}`);
  }
}

// ── SOW M4-F07: Scheduled Report Auto-Generation ─────────────────────────

async function runScheduledReports(ctx: JobContext): Promise<void> {
  try {
    const now = new Date();

    const dueReports = await ctx.prisma.savedReport.findMany({
      where: {
        scheduleFrequency: { not: null },
        nextRunAt: { lte: now },
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (dueReports.length === 0) return;

    ctx.log('info', `[Scheduler] Processing ${dueReports.length} scheduled report(s)`);

    for (const report of dueReports) {
      try {
        const nextRun = new Date(now);
        switch (report.scheduleFrequency) {
          case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case 'weekly':
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case 'monthly':
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
          case 'quarterly':
            nextRun.setMonth(nextRun.getMonth() + 3);
            break;
          default:
            nextRun.setDate(nextRun.getDate() + 1);
        }

        await ctx.prisma.savedReport.update({
          where: { id: report.id },
          data: { lastRunAt: now, nextRunAt: nextRun },
        });

        await ctx.prisma.notification.create({
          data: {
            recipientId: report.ownerId,
            title: `Scheduled report ready: ${report.name}`.slice(0, 200),
            body: `Your ${report.scheduleFrequency} report "${report.name}" has been generated and is ready for viewing.`,
            notificationType: 'scheduled_report',
            isRead: false,
          },
        });

        ctx.log('info', `[Scheduler] Generated scheduled report: ${report.name} (next: ${nextRun.toISOString()})`);
      } catch (err) {
        ctx.log('error', `[Scheduler] Failed to process report ${report.name}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Scheduled reports check failed: ${(err as Error).message}`);
  }
}

// ── Visitor Overstay Detection (SOW M5-F03) ──────────────────────────────

async function checkVisitorOverstays(ctx: JobContext): Promise<void> {
  try {
    const now = new Date();

    const overstayVisitors = await ctx.prisma.visitorPass.findMany({
      where: {
        status: 'checked_in',
        checkInTime: { not: null },
      },
      include: {
        warehouse: { select: { id: true, warehouseName: true, managerId: true } },
        registeredBy: { select: { id: true } },
      },
    });

    const overstayIds: string[] = [];
    const notifyTargets: Array<{
      visitorName: string;
      passNumber: string;
      warehouseManagerId: string | null;
      registeredById: string;
    }> = [];

    for (const visitor of overstayVisitors) {
      if (!visitor.checkInTime) continue;
      const expectedEnd = new Date(visitor.checkInTime.getTime() + visitor.expectedDuration * 60 * 1000);
      if (expectedEnd < now) {
        overstayIds.push(visitor.id);
        notifyTargets.push({
          visitorName: visitor.visitorName,
          passNumber: visitor.passNumber,
          warehouseManagerId: visitor.warehouse.managerId,
          registeredById: visitor.registeredBy.id,
        });
      }
    }

    if (overstayIds.length === 0) return;

    await ctx.prisma.visitorPass.updateMany({
      where: { id: { in: overstayIds } },
      data: { status: 'overstay' },
    });

    const staffToNotify = await ctx.prisma.employee.findMany({
      where: {
        systemRole: { in: ['gate_officer', 'warehouse_supervisor'] },
        isActive: true,
      },
      select: { id: true },
    });

    const recipientIds = new Set(staffToNotify.map(s => s.id));
    for (const target of notifyTargets) {
      if (target.warehouseManagerId) recipientIds.add(target.warehouseManagerId);
      recipientIds.add(target.registeredById);
    }

    await Promise.allSettled(
      Array.from(recipientIds).map(recipientId =>
        ctx.createNotification(
          {
            recipientId,
            title: 'Visitor Overstay Alert',
            body: `${overstayIds.length} visitor(s) have exceeded their expected visit duration and require attention.`,
            notificationType: 'visitor_overstay',
            referenceTable: 'visitor_passes',
          },
          ctx.io ?? undefined,
        ),
      ),
    );

    ctx.log('warn', `[Scheduler] Visitor overstay: ${overstayIds.length} visitor(s) marked as overstay`);
  } catch (err) {
    ctx.log('error', `[Scheduler] Visitor overstay check failed: ${(err as Error).message}`);
  }
}

// ── Register Jobs ────────────────────────────────────────────────────────

// Email retry — every 2 minutes (lock: 90 sec)
registerJob({
  name: 'email_retry',
  intervalMs: 2 * 60 * 1000,
  lockTtlSec: 90,
  handler: retryEmails,
});

// Expired lot marking — every hour (lock: 50 min)
registerJob({
  name: 'expired_lots',
  intervalMs: 60 * 60 * 1000,
  lockTtlSec: 3000,
  handler: markExpiredLots,
});

// Low stock alert — every 30 minutes (lock: 25 min)
registerJob({
  name: 'low_stock',
  intervalMs: 30 * 60 * 1000,
  lockTtlSec: 1500,
  handler: checkLowStock,
});

// Token cleanup — every 6 hours (lock: 5 hours)
registerJob({
  name: 'token_cleanup',
  intervalMs: 6 * 60 * 60 * 1000,
  lockTtlSec: 18000,
  handler: cleanupTokens,
});

// ABC classification — every 7 days (lock: 6 days)
registerJob({
  name: 'abc_classification',
  intervalMs: 7 * 24 * 60 * 60 * 1000,
  lockTtlSec: 518400,
  handler: recalculateAbcClassification,
});

// Cycle count auto-creation — daily (lock: 23 hours)
registerJob({
  name: 'cycle_count_auto',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: runCycleCountAutoCreate,
});

// Gate pass expiry — every hour (lock: 50 min)
registerJob({
  name: 'gate_pass_expiry',
  intervalMs: 60 * 60 * 1000,
  lockTtlSec: 3000,
  handler: expireGatePasses,
});

// Anomaly detection — every 6 hours (lock: 5 hours)
registerJob({
  name: 'anomaly_detection',
  intervalMs: 6 * 60 * 60 * 1000,
  lockTtlSec: 18000,
  handler: runAnomalyDetection,
});

// Reorder point auto-update — every 7 days (lock: 6 days)
registerJob({
  name: 'reorder_update',
  intervalMs: 7 * 24 * 60 * 60 * 1000,
  lockTtlSec: 518400,
  handler: runReorderPointUpdate,
});

// Scheduled workflow rules — every 60 seconds (lock: 50 sec)
registerJob({
  name: 'scheduled_rules',
  intervalMs: 60 * 1000,
  lockTtlSec: 50,
  handler: async (_ctx: JobContext) => {
    await processScheduledRules();
  },
});

// SOW C7: Daily material movement reconciliation — every 24 hours (lock: 23 hours)
registerJob({
  name: 'daily_reconciliation',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: runDailyReconciliation,
});

// SOW M4-F07: Scheduled report auto-generation — every hour (lock: 50 min)
registerJob({
  name: 'scheduled_reports',
  intervalMs: 60 * 60 * 1000,
  lockTtlSec: 3000,
  handler: runScheduledReports,
});

// Asset depreciation calculation — daily check, quarterly execution (lock: 2 hours)
registerJob({
  name: 'asset_depreciation',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 7200,
  handler: async (_ctx: JobContext) => {
    await calculateDepreciation();
  },
});

// SOW M5-F03: Visitor overstay detection — every 30 minutes (lock: 25 min)
registerJob({
  name: 'visitor_overstay',
  intervalMs: 30 * 60 * 1000,
  lockTtlSec: 1500,
  handler: checkVisitorOverstays,
});

// SOW M1: AMC expiry check — daily (lock: 2 hours)
registerJob({
  name: 'amc_expiry',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 7200,
  handler: async (_ctx: JobContext) => {
    await checkAmcExpiry();
  },
});

// M6: Security monitor — suspicious login activity detection — every hour (lock: 50 min)
registerJob({
  name: 'security_monitor',
  intervalMs: 60 * 60 * 1000,
  lockTtlSec: 3000,
  handler: async (_ctx: JobContext) => {
    await detectSuspiciousActivity();
  },
});

// M8: Vehicle maintenance usage-based scheduling — every 12 hours (lock: 11 hours)
registerJob({
  name: 'vehicle_maintenance',
  intervalMs: 12 * 60 * 60 * 1000,
  lockTtlSec: 39600,
  handler: async (_ctx: JobContext) => {
    await checkVehicleMaintenanceDueM8();
  },
});

// Oracle PO sync — every 15 minutes (lock: 12 minutes)
registerJob({
  name: 'po_sync',
  intervalMs: 15 * 60 * 1000,
  lockTtlSec: 720,
  handler: async (ctx: JobContext) => {
    try {
      const result = await syncPurchaseOrders();
      if (result.skipped === 0) {
        ctx.log('info', `[Scheduler] Oracle PO sync: ${result.synced} synced, ${result.failed} failed`);
      }
    } catch (err) {
      ctx.log('error', `[Scheduler] Oracle PO sync failed: ${(err as Error).message}`);
    }
  },
});
