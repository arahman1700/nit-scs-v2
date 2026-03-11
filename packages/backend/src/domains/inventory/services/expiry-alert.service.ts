/**
 * Expiry Alert Service — L2
 *
 * Two scheduled functions:
 * 1. checkExpiringLots()  — find active lots expiring within 30/60/90 days,
 *    notify warehouse_supervisor & inventory_specialist roles.
 * 2. autoQuarantineExpired() — mark past-due active lots as 'expired',
 *    notify and publish eventBus event.
 */

import { prisma } from '../../../utils/prisma.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { eventBus } from '../../../events/event-bus.js';
import { log } from '../../../config/logger.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const TARGET_ROLES = ['warehouse_supervisor', 'inventory_specialist'] as const;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Start of today (midnight UTC) for clean date comparisons */
function todayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function getRecipientIds(): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: { systemRole: { in: [...TARGET_ROLES] }, isActive: true },
    select: { id: true },
  });
  return employees.map(e => e.id);
}

// ── checkExpiringLots ───────────────────────────────────────────────────────

export async function checkExpiringLots(): Promise<void> {
  const now = todayStart();
  const thresholds = [30, 60, 90] as const;

  try {
    const recipientIds = await getRecipientIds();
    if (recipientIds.length === 0) {
      log('info', '[ExpiryAlert] No recipients found for expiry alerts — skipping');
      return;
    }

    for (const days of thresholds) {
      const cutoff = addDays(now, days);

      // Lots that are active, have an expiryDate, and expire between now and the cutoff
      const lots = await prisma.inventoryLot.findMany({
        where: {
          status: 'active',
          expiryDate: {
            gte: now,
            lte: cutoff,
          },
        },
        select: { id: true },
      });

      if (lots.length === 0) continue;

      // Build notification title (max 200 chars)
      const title = `\u26A0 ${lots.length} item${lots.length === 1 ? '' : 's'} expiring within ${days} days`.slice(
        0,
        200,
      );

      for (const recipientId of recipientIds) {
        await createNotification({
          recipientId,
          title,
          body: `${lots.length} active inventory lot(s) will expire within the next ${days} days. Review and take action.`,
          notificationType: 'expiry_alert',
          referenceTable: 'inventory_lots',
        });
      }

      log(
        'info',
        `[ExpiryAlert] Notified ${recipientIds.length} user(s) about ${lots.length} lot(s) expiring within ${days}d`,
      );
    }
  } catch (err) {
    log('error', `[ExpiryAlert] checkExpiringLots failed: ${(err as Error).message}`);
  }
}

// ── autoQuarantineExpired ───────────────────────────────────────────────────

export async function autoQuarantineExpired(): Promise<void> {
  const now = todayStart();

  try {
    // Find active lots that have already expired
    const expiredLots = await prisma.inventoryLot.findMany({
      where: {
        status: 'active',
        expiryDate: { lt: now },
      },
      select: { id: true },
    });

    if (expiredLots.length === 0) return;

    const expiredIds = expiredLots.map(l => l.id);

    // Bulk-update status to 'expired'
    await prisma.inventoryLot.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: 'expired' },
    });

    log('info', `[ExpiryAlert] Auto-quarantined ${expiredIds.length} expired lot(s)`);

    // Notify relevant users
    const recipientIds = await getRecipientIds();
    const title = `${expiredIds.length} lot${expiredIds.length === 1 ? '' : 's'} auto-quarantined due to expiry`.slice(
      0,
      200,
    );

    for (const recipientId of recipientIds) {
      await createNotification({
        recipientId,
        title,
        body: `${expiredIds.length} inventory lot(s) passed their expiry date and have been automatically set to "expired" status.`,
        notificationType: 'expiry_alert',
        referenceTable: 'inventory_lots',
      });
    }

    // Publish event bus event
    eventBus.publish({
      type: 'inventory:lots_expired',
      entityType: 'inventory_lot',
      entityId: expiredIds[0], // primary reference
      action: 'auto_quarantine',
      payload: {
        lotIds: expiredIds,
        count: expiredIds.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log('error', `[ExpiryAlert] autoQuarantineExpired failed: ${(err as Error).message}`);
  }
}
