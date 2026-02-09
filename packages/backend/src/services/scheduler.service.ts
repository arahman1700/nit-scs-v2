/**
 * Background Job Scheduler
 *
 * Runs periodic maintenance tasks using simple setInterval.
 * No external dependency required (no node-cron, no bull).
 *
 * Jobs:
 * 1. SLA breach detection — every 5 minutes
 * 2. Email retry — every 2 minutes
 * 3. Expired lot marking — every hour
 * 4. Low-stock alert check — every 30 minutes
 * 5. Expired refresh token cleanup — every 6 hours
 */

import { prisma } from '../utils/prisma.js';
import { processQueuedEmails } from './email.service.js';
import { createNotification } from './notification.service.js';
import { cleanupExpiredTokens } from './auth.service.js';
import { log } from '../config/logger.js';
import type { Server as SocketIOServer } from 'socket.io';

const timers: ReturnType<typeof setInterval>[] = [];
let io: SocketIOServer | null = null;

// ── SLA Breach Detection ─────────────────────────────────────────────────

async function checkSlaBreaches(): Promise<void> {
  try {
    const now = new Date();

    // Find approval steps that are still pending but past their document's SLA due date
    // We check documents that have slaDueDate < now and are still pending_approval
    const models = [
      { name: 'mirv', label: 'MIRV' },
      { name: 'jobOrder', label: 'Job Order' },
    ] as const;

    for (const model of models) {
      const delegate = (
        prisma as unknown as Record<
          string,
          {
            findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
            update: (args: unknown) => Promise<unknown>;
          }
        >
      )[model.name];

      const overdue = await delegate.findMany({
        where: {
          status: 'pending_approval',
          slaDueDate: { lt: now },
        },
        select: { id: true, slaDueDate: true },
      } as unknown);

      for (const doc of overdue) {
        // Check if we already notified (avoid duplicate notifications)
        const existingNotif = await prisma.notification.findFirst({
          where: {
            referenceTable: model.name,
            referenceId: doc.id as string,
            title: { contains: 'SLA Breached' },
            createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) }, // within last hour
          },
        });

        if (existingNotif) continue;

        // Find the current pending approval step
        const pendingStep = await prisma.approvalStep.findFirst({
          where: {
            documentType: model.name === 'jobOrder' ? 'jo' : model.name,
            documentId: doc.id as string,
            status: 'pending',
          },
          orderBy: { level: 'asc' },
        });

        if (!pendingStep) continue;

        // Notify admins and the approver role
        const admins = await prisma.employee.findMany({
          where: { systemRole: 'admin', isActive: true },
          select: { id: true },
        });

        const approvers = await prisma.employee.findMany({
          where: { systemRole: pendingStep.approverRole, isActive: true },
          select: { id: true },
        });

        const allRecipients = new Set([...admins.map(a => a.id), ...approvers.map(a => a.id)]);

        for (const recipientId of allRecipients) {
          await createNotification(
            {
              recipientId,
              title: `SLA Breached: ${model.label}`,
              body: `${model.label} ${doc.id} has exceeded its SLA deadline. Requires ${pendingStep.approverRole} approval.`,
              notificationType: 'sla_breach',
              referenceTable: model.name,
              referenceId: doc.id as string,
            },
            io ?? undefined,
          );
        }

        log('warn', `[Scheduler] SLA breach: ${model.label} ${doc.id} (approver: ${pendingStep.approverRole})`);
      }
    }
  } catch (err) {
    log('error', `[Scheduler] SLA check failed: ${(err as Error).message}`);
  }
}

// ── Email Retry ──────────────────────────────────────────────────────────

async function retryEmails(): Promise<void> {
  try {
    const sent = await processQueuedEmails();
    if (sent > 0) {
      log('info', `[Scheduler] Email retry: ${sent} sent`);
    }
  } catch (err) {
    log('error', `[Scheduler] Email retry failed: ${(err as Error).message}`);
  }
}

// ── Expired Lot Marking ──────────────────────────────────────────────────

async function markExpiredLots(): Promise<void> {
  try {
    const result = await prisma.inventoryLot.updateMany({
      where: {
        status: 'active',
        expiryDate: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      log('info', `[Scheduler] Marked ${result.count} expired lot(s)`);
    }
  } catch (err) {
    log('error', `[Scheduler] Expired lot check failed: ${(err as Error).message}`);
  }
}

// ── Low Stock Alert Check ────────────────────────────────────────────────

async function checkLowStock(): Promise<void> {
  try {
    // Find items below minimum level that haven't been alerted
    const lowStockItems = await prisma.$queryRaw<
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
      FROM inventory_levels il
      JOIN items i ON i.id = il.item_id
      JOIN warehouses w ON w.id = il.warehouse_id
      WHERE il.alert_sent = false
        AND (
          (il.min_level IS NOT NULL AND (il.qty_on_hand - il.qty_reserved) <= il.min_level)
          OR (il.reorder_point IS NOT NULL AND (il.qty_on_hand - il.qty_reserved) <= il.reorder_point)
        )
      LIMIT 100
    `;

    if (lowStockItems.length === 0) return;

    // Mark alerts as sent
    for (const item of lowStockItems) {
      await prisma.inventoryLevel.update({
        where: { itemId_warehouseId: { itemId: item.item_id, warehouseId: item.warehouse_id } },
        data: { alertSent: true },
      });
    }

    // Notify warehouse staff
    const warehouseStaff = await prisma.employee.findMany({
      where: { systemRole: { in: ['warehouse_staff', 'admin'] }, isActive: true },
      select: { id: true },
    });

    for (const staff of warehouseStaff) {
      const isCritical = lowStockItems.some(i => i.min_level !== null && i.qty_on_hand - i.qty_reserved <= i.min_level);

      await createNotification(
        {
          recipientId: staff.id,
          title: `Low Stock Alert: ${lowStockItems.length} item(s)`,
          body:
            lowStockItems
              .slice(0, 5)
              .map(
                i => `${i.item_code} at ${i.warehouse_code}: ${(i.qty_on_hand - i.qty_reserved).toFixed(0)} available`,
              )
              .join(', ') + (lowStockItems.length > 5 ? ` (+${lowStockItems.length - 5} more)` : ''),
          notificationType: isCritical ? 'alert' : 'warning',
          referenceTable: 'inventory_levels',
        },
        io ?? undefined,
      );
    }

    log('warn', `[Scheduler] Low stock: ${lowStockItems.length} item(s) below threshold`);
  } catch (err) {
    log('error', `[Scheduler] Low stock check failed: ${(err as Error).message}`);
  }
}

// ── Token Cleanup ────────────────────────────────────────────────────────

async function cleanupTokens(): Promise<void> {
  try {
    const count = await cleanupExpiredTokens();
    if (count > 0) {
      log('info', `[Scheduler] Cleaned up ${count} expired refresh token(s)`);
    }
  } catch (err) {
    log('error', `[Scheduler] Token cleanup failed: ${(err as Error).message}`);
  }
}

// ── Scheduler Lifecycle ──────────────────────────────────────────────────

export function startScheduler(socketIo?: SocketIOServer): void {
  io = socketIo ?? null;

  log('info', '[Scheduler] Starting background job scheduler');

  // SLA breach detection — every 5 minutes
  timers.push(setInterval(checkSlaBreaches, 5 * 60 * 1000));

  // Email retry — every 2 minutes
  timers.push(setInterval(retryEmails, 2 * 60 * 1000));

  // Expired lot marking — every hour
  timers.push(setInterval(markExpiredLots, 60 * 60 * 1000));

  // Low stock alert — every 30 minutes
  timers.push(setInterval(checkLowStock, 30 * 60 * 1000));

  // Token cleanup — every 6 hours
  timers.push(setInterval(cleanupTokens, 6 * 60 * 60 * 1000));

  // Run initial checks after a short delay (let server finish starting up)
  setTimeout(() => {
    checkSlaBreaches();
    retryEmails();
    markExpiredLots();
  }, 10_000);

  log('info', '[Scheduler] All jobs registered');
}

export function stopScheduler(): void {
  for (const timer of timers) {
    clearInterval(timer);
  }
  timers.length = 0;
  io = null;
  log('info', '[Scheduler] Scheduler stopped');
}
