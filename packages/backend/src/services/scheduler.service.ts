/**
 * Background Job Scheduler
 *
 * Runs periodic maintenance tasks using simple setInterval.
 * No external dependency required (no node-cron, no bull).
 *
 * Jobs:
 * 1. SLA breach detection — every 5 minutes
 * 2. SLA warning detection — every 5 minutes
 * 3. Email retry — every 2 minutes
 * 4. Expired lot marking — every hour
 * 5. Low-stock alert check — every 30 minutes
 * 6. Expired refresh token cleanup — every 6 hours
 * 7. ABC classification recalculation — every 7 days
 */

import { prisma } from '../utils/prisma.js';
import { processQueuedEmails } from './email.service.js';
import { createNotification } from './notification.service.js';
import { cleanupExpiredTokens } from './auth.service.js';
import { calculateABCClassification, applyABCClassification } from './abc-analysis.service.js';
import { autoCreateCycleCounts } from './cycle-count.service.js';
import { processScheduledRules, initializeScheduledRules } from '../events/scheduled-rule-runner.js';
import { log } from '../config/logger.js';
import { getRedis } from '../config/redis.js';
import { emitToRole, emitToUser } from '../socket/setup.js';
import { sendPushToUser } from './push-notification.service.js';
import { SLA_HOURS } from '@nit-scs-v2/shared';
import type { Server as SocketIOServer } from 'socket.io';

const timers: ReturnType<typeof setTimeout>[] = [];
let io: SocketIOServer | null = null;
let running = false;

// ── Distributed Lock (Redis-based) ─────────────────────────────────────────

/**
 * Attempts to acquire a Redis-based distributed lock.
 * Returns true if acquired, false otherwise.
 * Uses SET NX EX for atomic lock acquisition.
 */
async function acquireLock(lockName: string, ttlSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // No Redis = single instance, always proceed
  try {
    const result = await redis.set(`scheduler:lock:${lockName}`, process.pid.toString(), 'EX', ttlSec, 'NX');
    return result === 'OK';
  } catch {
    return true; // On Redis failure, proceed (single-instance fallback)
  }
}

/**
 * Sequential loop: run function → wait interval → repeat.
 * Prevents overlapping executions unlike setInterval.
 */
function scheduleLoop(name: string, fn: () => Promise<void>, intervalMs: number, lockTtlSec: number): void {
  async function tick() {
    if (!running) return;
    const hasLock = await acquireLock(name, lockTtlSec);
    if (hasLock) {
      await fn().catch(err => log('error', `[Scheduler] ${name} failed: ${(err as Error).message}`));
    }
    if (running) {
      const timer = setTimeout(tick, intervalMs);
      timers.push(timer);
    }
  }
  const timer = setTimeout(tick, intervalMs);
  timers.push(timer);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Prisma delegate type for dynamic model access */
type PrismaDelegate = {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
};

function getDelegate(modelName: string): PrismaDelegate {
  return (prisma as unknown as Record<string, PrismaDelegate>)[modelName];
}

/** Convert SLA hours to milliseconds */
function slaHoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/**
 * Compute the SLA deadline from a reference date and SLA key.
 * Returns null if SLA key not found.
 */
function _computeSlaDeadline(referenceDate: Date | string, slaKey: string): Date | null {
  const hours = SLA_HOURS[slaKey];
  if (!hours) return null;
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  return new Date(ref.getTime() + slaHoursToMs(hours));
}

/**
 * Check for duplicate notification within the last hour.
 * Returns true if a notification already exists (should skip).
 */
async function hasRecentNotification(
  referenceTable: string,
  referenceId: string,
  titleFragment: string,
  now: Date,
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      referenceTable,
      referenceId,
      title: { contains: titleFragment },
      createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });
  return !!existing;
}

/**
 * Batch check for recent notifications across multiple document IDs.
 * Returns a Set of referenceIds that already have a recent notification (should skip).
 */
async function getRecentNotificationRefs(
  referenceTable: string,
  referenceIds: string[],
  titleFragment: string,
  now: Date,
): Promise<Set<string>> {
  if (referenceIds.length === 0) return new Set();
  const existing = await prisma.notification.findMany({
    where: {
      referenceTable,
      referenceId: { in: referenceIds },
      title: { contains: titleFragment },
      createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
    },
    select: { referenceId: true },
  });
  return new Set(existing.map(n => n.referenceId).filter((id): id is string => id !== null));
}

/** Fetch admin employee IDs */
async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.employee.findMany({
    where: { systemRole: 'admin', isActive: true },
    select: { id: true },
  });
  return admins.map(a => a.id);
}

/** Fetch employee IDs by role */
async function getEmployeeIdsByRole(role: string): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: { systemRole: role, isActive: true },
    select: { id: true },
  });
  return employees.map(e => e.id);
}

/**
 * Send SLA notifications to a set of recipients and emit socket events.
 * Uses createMany for batch DB insert, then emits socket + push per recipient.
 */
async function notifySla(params: {
  recipientIds: string[];
  title: string;
  body: string;
  notificationType: string;
  referenceTable: string;
  referenceId: string;
  socketEvent: string;
  socketRoles: string[];
}): Promise<void> {
  if (params.recipientIds.length === 0) return;

  // Batch insert all notifications in a single DB call
  await prisma.notification.createMany({
    data: params.recipientIds.map(recipientId => ({
      recipientId,
      title: params.title,
      body: params.body,
      notificationType: params.notificationType,
      referenceTable: params.referenceTable,
      referenceId: params.referenceId,
    })),
  });

  // Emit per-recipient socket events + push notifications (fire-and-forget)
  if (io) {
    for (const recipientId of params.recipientIds) {
      emitToUser(io, recipientId, 'notification:new', {
        recipientId,
        title: params.title,
        body: params.body,
        notificationType: params.notificationType,
        referenceTable: params.referenceTable,
        referenceId: params.referenceId,
      });
    }
  }

  // Send push notifications per recipient (fire-and-forget)
  for (const recipientId of params.recipientIds) {
    sendPushToUser(recipientId, {
      title: params.title,
      body: params.body || '',
      url:
        params.referenceTable && params.referenceId
          ? `/${params.referenceTable}/${params.referenceId}`
          : '/notifications',
      tag: params.notificationType,
    }).catch(() => {
      // Silently ignore push failures
    });
  }

  // Emit socket event to relevant roles
  if (io) {
    for (const role of params.socketRoles) {
      emitToRole(io, role, params.socketEvent, {
        entity: params.referenceTable,
        documentId: params.referenceId,
        title: params.title,
      });
    }
  }
}

// ── SLA Breach Detection ─────────────────────────────────────────────────

async function checkSlaBreaches(): Promise<void> {
  try {
    const now = new Date();

    // ── 1. MIRV & Job Order: approval-based SLA (existing logic, refactored) ──
    await checkApprovalBasedSlaBreaches(now);

    // ── 2. Material Requisition: Stock Verification SLA (4 hours) ──
    await checkMrStockVerificationBreaches(now);

    // ── 3. Job Order: Execution SLA (48 hours after quoted) ──
    await checkJoExecutionBreaches(now);

    // ── 4. Gate Pass SLA (24 hours after creation) ──
    await checkGatePassBreaches(now);

    // ── 5. Scrap Buyer Pickup SLA (10 days after sold) ──
    await checkScrapBuyerPickupBreaches(now);

    // ── 6. Surplus Timeout SLA (14 days after OU Head approval) ──
    await checkSurplusTimeoutBreaches(now);

    // ── 7. QCI Inspection SLA (14 days after creation) ──
    await checkQciInspectionBreaches(now);
  } catch (err) {
    log('error', `[Scheduler] SLA check failed: ${(err as Error).message}`);
  }
}

/**
 * Original approval-based SLA breach check for MIRV.
 * Only MIRV has a direct slaDueDate field on the model.
 * JobOrder SLA is on JoSlaTracking — handled by checkJoExecutionBreaches().
 */
async function checkApprovalBasedSlaBreaches(now: Date): Promise<void> {
  const models = [{ name: 'mirv', label: 'MIRV' }] as const;

  for (const model of models) {
    const delegate = getDelegate(model.name);

    const overdue = await delegate.findMany({
      where: {
        status: 'pending_approval',
        slaDueDate: { lt: now },
      },
      select: { id: true, slaDueDate: true },
    } as unknown);

    for (const doc of overdue) {
      const docId = doc.id as string;
      if (await hasRecentNotification(model.name, docId, 'SLA Breached', now)) continue;

      // Find the current pending approval step
      const pendingStep = await prisma.approvalStep.findFirst({
        where: {
          documentType: model.name,
          documentId: docId,
          status: 'pending',
        },
        orderBy: { level: 'asc' },
      });

      if (!pendingStep) continue;

      const adminIds = await getAdminIds();
      const approverIds = await getEmployeeIdsByRole(pendingStep.approverRole);
      const allRecipients = [...new Set([...adminIds, ...approverIds])];

      await notifySla({
        recipientIds: allRecipients,
        title: `SLA Breached: ${model.label}`,
        body: `${model.label} ${docId} has exceeded its SLA deadline. Requires ${pendingStep.approverRole} approval.`,
        notificationType: 'sla_breach',
        referenceTable: model.name,
        referenceId: docId,
        socketEvent: 'sla:breached',
        socketRoles: ['admin', pendingStep.approverRole],
      });

      log('warn', `[Scheduler] SLA breach: ${model.label} ${docId} (approver: ${pendingStep.approverRole})`);
    }
  }
}

/**
 * Stock Verification SLA (4 hours).
 * MR has stockVerificationSla (DateTime) and slaBreached (Boolean) fields.
 * When MR status = 'approved' and stockVerificationSla < now, it's breached.
 * Also handles date-based fallback: if stockVerificationSla is not set,
 * compute from approvalDate + SLA_HOURS.stock_verification.
 */
async function checkMrStockVerificationBreaches(now: Date): Promise<void> {
  const delegate = getDelegate('materialRequisition');

  // Case 1: MRs with explicit stockVerificationSla that has passed
  const overdueExplicit = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: { lt: now },
    },
    select: { id: true, mrfNumber: true, stockVerificationSla: true },
  } as unknown);

  // Case 2: MRs without explicit SLA — compute from approvalDate
  const cutoff = new Date(now.getTime() - slaHoursToMs(SLA_HOURS.stock_verification));
  const overdueComputed = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: null,
      approvalDate: { lt: cutoff },
    },
    select: { id: true, mrfNumber: true, approvalDate: true },
  } as unknown);

  const allOverdue = [...overdueExplicit, ...overdueComputed];

  for (const doc of allOverdue) {
    const docId = doc.id as string;
    const docNumber = (doc.mrfNumber as string) || docId;

    if (await hasRecentNotification('materialRequisition', docId, 'SLA Breached', now)) continue;

    // Mark as breached
    await delegate.update({
      where: { id: docId },
      data: { slaBreached: true },
    } as unknown);

    const adminIds = await getAdminIds();
    const warehouseIds = await getEmployeeIdsByRole('warehouse_staff');
    const allRecipients = [...new Set([...adminIds, ...warehouseIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Material Requisition',
      body: `MR ${docNumber} has exceeded its stock verification SLA (${SLA_HOURS.stock_verification}h). Warehouse must respond.`,
      notificationType: 'sla_breach',
      referenceTable: 'materialRequisition',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'warehouse_staff', 'warehouse_supervisor'],
    });

    log('warn', `[Scheduler] SLA breach: MR Stock Verification ${docNumber}`);
  }
}

/**
 * JO Execution SLA (48 hours after quotation accepted).
 * Uses JoSlaTracking relation: slaDueDate set when status = 'quoted'.
 * Falls back to date-based: updatedAt when status changed to 'quoted' + SLA_HOURS.
 */
async function checkJoExecutionBreaches(now: Date): Promise<void> {
  // Check via JoSlaTracking for JOs with explicit slaDueDate
  const overdueTracked = await prisma.joSlaTracking.findMany({
    where: {
      slaDueDate: { lt: now },
      slaMet: null, // not yet resolved
      jobOrder: {
        status: { in: ['quoted', 'approved', 'assigned', 'in_progress'] },
      },
    },
    select: {
      id: true,
      jobOrderId: true,
      slaDueDate: true,
      jobOrder: { select: { id: true, joNumber: true, status: true } },
    },
  });

  for (const tracking of overdueTracked) {
    const jo = tracking.jobOrder as { id: string; joNumber: string; status: string };
    const docId = jo.id;

    if (await hasRecentNotification('jobOrder', docId, 'Execution SLA Breached', now)) continue;

    // Mark SLA as not met
    await prisma.joSlaTracking.update({
      where: { id: tracking.id },
      data: { slaMet: false },
    });

    const adminIds = await getAdminIds();
    const logisticsIds = await getEmployeeIdsByRole('logistics_coordinator');
    const allRecipients = [...new Set([...adminIds, ...logisticsIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'Execution SLA Breached: Job Order',
      body: `JO ${jo.joNumber} has exceeded its execution SLA (${SLA_HOURS.jo_execution}h). Status: ${jo.status}.`,
      notificationType: 'sla_breach',
      referenceTable: 'jobOrder',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'logistics_coordinator', 'manager'],
    });

    log('warn', `[Scheduler] SLA breach: JO Execution ${jo.joNumber}`);
  }

  // Fallback: JOs in 'quoted' status without SlaTracking record, past the deadline
  const cutoff = new Date(now.getTime() - slaHoursToMs(SLA_HOURS.jo_execution));
  const overdueNoTracking = await getDelegate('jobOrder').findMany({
    where: {
      status: 'quoted',
      updatedAt: { lt: cutoff },
      slaTracking: null,
    },
    select: { id: true, joNumber: true },
  } as unknown);

  for (const doc of overdueNoTracking) {
    const docId = doc.id as string;
    const docNumber = (doc.joNumber as string) || docId;

    if (await hasRecentNotification('jobOrder', docId, 'Execution SLA Breached', now)) continue;

    const adminIds = await getAdminIds();
    const logisticsIds = await getEmployeeIdsByRole('logistics_coordinator');
    const allRecipients = [...new Set([...adminIds, ...logisticsIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'Execution SLA Breached: Job Order',
      body: `JO ${docNumber} has exceeded its execution SLA (${SLA_HOURS.jo_execution}h) since quotation.`,
      notificationType: 'sla_breach',
      referenceTable: 'jobOrder',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'logistics_coordinator', 'manager'],
    });

    log('warn', `[Scheduler] SLA breach: JO Execution (no tracking) ${docNumber}`);
  }
}

/**
 * Gate Pass SLA (24 hours).
 * No SLA-specific fields on GatePass model — use date-based approach.
 * After GP is created (status = 'pending' or 'approved'), it must be released within 24h.
 */
async function checkGatePassBreaches(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - slaHoursToMs(SLA_HOURS.gate_pass));
  const delegate = getDelegate('gatePass');

  const overdue = await delegate.findMany({
    where: {
      status: { in: ['pending', 'approved'] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, gatePassNumber: true, status: true, createdAt: true },
  } as unknown);

  for (const doc of overdue) {
    const docId = doc.id as string;
    const docNumber = (doc.gatePassNumber as string) || docId;

    if (await hasRecentNotification('gatePass', docId, 'SLA Breached', now)) continue;

    const adminIds = await getAdminIds();
    const warehouseIds = await getEmployeeIdsByRole('warehouse_staff');
    const supervisorIds = await getEmployeeIdsByRole('warehouse_supervisor');
    const allRecipients = [...new Set([...adminIds, ...warehouseIds, ...supervisorIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Gate Pass',
      body: `Gate Pass ${docNumber} has exceeded its SLA (${SLA_HOURS.gate_pass}h). Status: ${doc.status}. Must be released.`,
      notificationType: 'sla_breach',
      referenceTable: 'gatePass',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'warehouse_staff', 'warehouse_supervisor'],
    });

    log('warn', `[Scheduler] SLA breach: Gate Pass ${docNumber}`);
  }
}

/**
 * Scrap Buyer Pickup SLA (10 days).
 * ScrapItem has buyerPickupDeadline (DateTime?) — set when status = 'sold'.
 * Falls back to date-based: updatedAt when status is 'sold' + SLA_HOURS.
 */
async function checkScrapBuyerPickupBreaches(now: Date): Promise<void> {
  const delegate = getDelegate('scrapItem');

  // Case 1: Scrap items with explicit buyerPickupDeadline that has passed
  const overdueExplicit = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: { lt: now },
    },
    select: { id: true, scrapNumber: true, buyerName: true, buyerPickupDeadline: true },
  } as unknown);

  // Case 2: Scrap items without deadline — use date-based approach
  const cutoff = new Date(now.getTime() - slaHoursToMs(SLA_HOURS.scrap_buyer_pickup));
  const overdueComputed = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: null,
      updatedAt: { lt: cutoff },
    },
    select: { id: true, scrapNumber: true, buyerName: true, updatedAt: true },
  } as unknown);

  const allOverdue = [...overdueExplicit, ...overdueComputed];

  for (const doc of allOverdue) {
    const docId = doc.id as string;
    const docNumber = (doc.scrapNumber as string) || docId;
    const buyerName = (doc.buyerName as string) || 'Unknown buyer';

    if (await hasRecentNotification('scrapItem', docId, 'SLA Breached', now)) continue;

    const adminIds = await getAdminIds();
    const scrapCommitteeIds = await getEmployeeIdsByRole('scrap_committee_member');
    const allRecipients = [...new Set([...adminIds, ...scrapCommitteeIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Scrap Buyer Pickup',
      body: `Scrap ${docNumber} — buyer "${buyerName}" has not picked up within ${SLA_HOURS.scrap_buyer_pickup / 24} days.`,
      notificationType: 'sla_breach',
      referenceTable: 'scrapItem',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'scrap_committee_member', 'manager'],
    });

    log('warn', `[Scheduler] SLA breach: Scrap Buyer Pickup ${docNumber}`);
  }
}

/**
 * Surplus Timeout SLA (14 days).
 * After OU Head approval (ouHeadApprovalDate set), SCM can approve after 14 days.
 * Status must still be in a pre-closed state and ouHeadApprovalDate + 14 days < now.
 */
async function checkSurplusTimeoutBreaches(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - slaHoursToMs(SLA_HOURS.surplus_timeout));
  const delegate = getDelegate('surplusItem');

  const overdue = await delegate.findMany({
    where: {
      status: { in: ['identified', 'evaluated'] },
      ouHeadApprovalDate: { lt: cutoff },
    },
    select: { id: true, surplusNumber: true, ouHeadApprovalDate: true, status: true },
  } as unknown);

  for (const doc of overdue) {
    const docId = doc.id as string;
    const docNumber = (doc.surplusNumber as string) || docId;

    if (await hasRecentNotification('surplusItem', docId, 'SLA Breached', now)) continue;

    const adminIds = await getAdminIds();
    const managerIds = await getEmployeeIdsByRole('manager');
    const allRecipients = [...new Set([...adminIds, ...managerIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: Surplus Timeout',
      body: `Surplus ${docNumber} has exceeded the ${SLA_HOURS.surplus_timeout / 24}-day timeout since OU Head approval. SCM can now approve.`,
      notificationType: 'sla_breach',
      referenceTable: 'surplusItem',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'manager'],
    });

    log('warn', `[Scheduler] SLA breach: Surplus Timeout ${docNumber}`);
  }
}

/**
 * QCI Inspection SLA (14 days).
 * Rfim model (QCI) has status 'pending' or 'in_progress'.
 * No SLA-specific fields — use createdAt + SLA_HOURS.qc_inspection.
 */
async function checkQciInspectionBreaches(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - slaHoursToMs(SLA_HOURS.qc_inspection));
  const delegate = getDelegate('rfim');

  const overdue = await delegate.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, rfimNumber: true, status: true, createdAt: true },
  } as unknown);

  for (const doc of overdue) {
    const docId = doc.id as string;
    const docNumber = (doc.rfimNumber as string) || docId;

    if (await hasRecentNotification('rfim', docId, 'SLA Breached', now)) continue;

    const adminIds = await getAdminIds();
    const qcIds = await getEmployeeIdsByRole('qc_officer');
    const allRecipients = [...new Set([...adminIds, ...qcIds])];

    await notifySla({
      recipientIds: allRecipients,
      title: 'SLA Breached: QC Inspection',
      body: `QCI ${docNumber} has exceeded its inspection SLA (${SLA_HOURS.qc_inspection / 24} days). Status: ${doc.status}.`,
      notificationType: 'sla_breach',
      referenceTable: 'rfim',
      referenceId: docId,
      socketEvent: 'sla:breached',
      socketRoles: ['admin', 'qc_officer'],
    });

    log('warn', `[Scheduler] SLA breach: QCI Inspection ${docNumber}`);
  }
}

// ── SLA Warning Detection ────────────────────────────────────────────────

/**
 * Checks for documents whose SLA deadline is within the next hour.
 * Emits sla:warning events and creates warning notifications.
 */
async function checkSlaWarnings(): Promise<void> {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // ── 1. MIRV & JobOrder: approval SLA warnings ──
    await checkApprovalBasedSlaWarnings(now, oneHourFromNow);

    // ── 2. MR: stock verification SLA warning ──
    await checkMrStockVerificationWarnings(now, oneHourFromNow);

    // ── 3. JO: execution SLA warning (via JoSlaTracking) ──
    await checkJoExecutionWarnings(now, oneHourFromNow);

    // ── 4. Gate Pass: SLA warning ──
    await checkGatePassWarnings(now, oneHourFromNow);

    // ── 5. Scrap Buyer Pickup: SLA warning ──
    await checkScrapBuyerPickupWarnings(now, oneHourFromNow);

    // ── 6. Surplus Timeout: SLA warning ──
    await checkSurplusTimeoutWarnings(now, oneHourFromNow);

    // ── 7. QCI Inspection: SLA warning ──
    await checkQciInspectionWarnings(now, oneHourFromNow);
  } catch (err) {
    log('error', `[Scheduler] SLA warning check failed: ${(err as Error).message}`);
  }
}

/**
 * Approval-based SLA warnings for MIRV.
 * Deadline is within the next hour and status is still pending_approval.
 * JobOrder SLA warnings handled separately via JoSlaTracking.
 */
async function checkApprovalBasedSlaWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  const models = [{ name: 'mirv', label: 'MIRV' }] as const;

  for (const model of models) {
    const delegate = getDelegate(model.name);

    const atRisk = await delegate.findMany({
      where: {
        status: 'pending_approval',
        slaDueDate: { gt: now, lt: oneHourFromNow },
      },
      select: { id: true, slaDueDate: true },
    } as unknown);

    for (const doc of atRisk) {
      const docId = doc.id as string;
      if (await hasRecentNotification(model.name, docId, 'SLA Warning', now)) continue;

      const pendingStep = await prisma.approvalStep.findFirst({
        where: {
          documentType: model.name,
          documentId: docId,
          status: 'pending',
        },
        orderBy: { level: 'asc' },
      });

      if (!pendingStep) continue;

      const approverIds = await getEmployeeIdsByRole(pendingStep.approverRole);

      await notifySla({
        recipientIds: approverIds,
        title: `SLA Warning: ${model.label}`,
        body: `${model.label} ${docId} SLA deadline is within the next hour. Requires ${pendingStep.approverRole} approval.`,
        notificationType: 'sla_warning',
        referenceTable: model.name,
        referenceId: docId,
        socketEvent: 'sla:warning',
        socketRoles: [pendingStep.approverRole, 'admin'],
      });

      log('info', `[Scheduler] SLA warning: ${model.label} ${docId}`);
    }
  }
}

/**
 * MR stock verification SLA warning.
 * Deadline is within the next hour.
 */
async function checkMrStockVerificationWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  const delegate = getDelegate('materialRequisition');

  // Explicit SLA deadline within next hour
  const atRiskExplicit = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: { gt: now, lt: oneHourFromNow },
    },
    select: { id: true, mrfNumber: true },
  } as unknown);

  // Date-based: approvalDate + SLA_HOURS is within next hour
  const slaMs = slaHoursToMs(SLA_HOURS.stock_verification);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);
  const atRiskComputed = await delegate.findMany({
    where: {
      status: { in: ['approved', 'checking_stock'] },
      slaBreached: false,
      stockVerificationSla: null,
      approvalDate: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, mrfNumber: true },
  } as unknown);

  const allAtRisk = [...atRiskExplicit, ...atRiskComputed];

  // Hoist role lookup before the loop
  const warehouseIds = await getEmployeeIdsByRole('warehouse_staff');

  // Batch check recent notifications
  const atRiskIds = allAtRisk.map(d => d.id as string);
  const recentlyNotified = await getRecentNotificationRefs('materialRequisition', atRiskIds, 'SLA Warning', now);

  for (const doc of allAtRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.mrfNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await notifySla({
      recipientIds: warehouseIds,
      title: 'SLA Warning: Material Requisition',
      body: `MR ${docNumber} stock verification SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'materialRequisition',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['warehouse_staff', 'warehouse_supervisor', 'admin'],
    });

    log('info', `[Scheduler] SLA warning: MR Stock Verification ${docNumber}`);
  }
}

/**
 * JO Execution SLA warning via JoSlaTracking.
 */
async function checkJoExecutionWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  // Hoist role lookup before the loop
  const logisticsIds = await getEmployeeIdsByRole('logistics_coordinator');

  const atRisk = await prisma.joSlaTracking.findMany({
    where: {
      slaDueDate: { gt: now, lt: oneHourFromNow },
      slaMet: null,
      jobOrder: {
        status: { in: ['quoted', 'approved', 'assigned', 'in_progress'] },
      },
    },
    select: {
      id: true,
      jobOrderId: true,
      jobOrder: { select: { id: true, joNumber: true } },
    },
  });

  // Batch check recent notifications
  const atRiskDocIds = atRisk.map(t => (t.jobOrder as { id: string }).id);
  const recentlyNotified = await getRecentNotificationRefs('jobOrder', atRiskDocIds, 'Execution SLA Warning', now);

  for (const tracking of atRisk) {
    const jo = tracking.jobOrder as { id: string; joNumber: string };
    const docId = jo.id;

    if (recentlyNotified.has(docId)) continue;

    await notifySla({
      recipientIds: logisticsIds,
      title: 'Execution SLA Warning: Job Order',
      body: `JO ${jo.joNumber} execution SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'jobOrder',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['logistics_coordinator', 'admin'],
    });

    log('info', `[Scheduler] SLA warning: JO Execution ${jo.joNumber}`);
  }
}

/**
 * Gate Pass SLA warning.
 * Date-based: createdAt + 24h deadline is within the next hour.
 */
async function checkGatePassWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  const slaMs = slaHoursToMs(SLA_HOURS.gate_pass);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);

  const delegate = getDelegate('gatePass');

  const atRisk = await delegate.findMany({
    where: {
      status: { in: ['pending', 'approved'] },
      createdAt: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, gatePassNumber: true },
  } as unknown);

  // Hoist role lookup before the loop
  const warehouseIds = await getEmployeeIdsByRole('warehouse_staff');

  // Batch check recent notifications
  const atRiskIds = atRisk.map(d => d.id as string);
  const recentlyNotified = await getRecentNotificationRefs('gatePass', atRiskIds, 'SLA Warning', now);

  for (const doc of atRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.gatePassNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await notifySla({
      recipientIds: warehouseIds,
      title: 'SLA Warning: Gate Pass',
      body: `Gate Pass ${docNumber} SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'gatePass',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['warehouse_staff', 'warehouse_supervisor', 'admin'],
    });

    log('info', `[Scheduler] SLA warning: Gate Pass ${docNumber}`);
  }
}

/**
 * Scrap Buyer Pickup SLA warning.
 * buyerPickupDeadline within the next hour or date-based approach.
 */
async function checkScrapBuyerPickupWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  const delegate = getDelegate('scrapItem');

  // Explicit deadline
  const atRiskExplicit = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: { gt: now, lt: oneHourFromNow },
    },
    select: { id: true, scrapNumber: true, buyerName: true },
  } as unknown);

  // Date-based fallback
  const slaMs = slaHoursToMs(SLA_HOURS.scrap_buyer_pickup);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);
  const atRiskComputed = await delegate.findMany({
    where: {
      status: 'sold',
      buyerPickupDeadline: null,
      updatedAt: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, scrapNumber: true, buyerName: true },
  } as unknown);

  const allAtRisk = [...atRiskExplicit, ...atRiskComputed];

  // Hoist role lookup before the loop
  const scrapCommitteeIds = await getEmployeeIdsByRole('scrap_committee_member');

  // Batch check recent notifications
  const atRiskIds = allAtRisk.map(d => d.id as string);
  const recentlyNotified = await getRecentNotificationRefs('scrapItem', atRiskIds, 'SLA Warning', now);

  for (const doc of allAtRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.scrapNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await notifySla({
      recipientIds: scrapCommitteeIds,
      title: 'SLA Warning: Scrap Buyer Pickup',
      body: `Scrap ${docNumber} buyer pickup SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'scrapItem',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['scrap_committee_member', 'admin'],
    });

    log('info', `[Scheduler] SLA warning: Scrap Buyer Pickup ${docNumber}`);
  }
}

/**
 * Surplus Timeout SLA warning.
 * ouHeadApprovalDate + 14 days is within the next hour.
 */
async function checkSurplusTimeoutWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  const slaMs = slaHoursToMs(SLA_HOURS.surplus_timeout);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);

  const delegate = getDelegate('surplusItem');

  const atRisk = await delegate.findMany({
    where: {
      status: { in: ['identified', 'evaluated'] },
      ouHeadApprovalDate: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, surplusNumber: true },
  } as unknown);

  // Hoist role lookup before the loop
  const managerIds = await getEmployeeIdsByRole('manager');

  // Batch check recent notifications
  const atRiskIds = atRisk.map(d => d.id as string);
  const recentlyNotified = await getRecentNotificationRefs('surplusItem', atRiskIds, 'SLA Warning', now);

  for (const doc of atRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.surplusNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await notifySla({
      recipientIds: managerIds,
      title: 'SLA Warning: Surplus Timeout',
      body: `Surplus ${docNumber} timeout SLA deadline is within the next hour. SCM approval will be available.`,
      notificationType: 'sla_warning',
      referenceTable: 'surplusItem',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['manager', 'admin'],
    });

    log('info', `[Scheduler] SLA warning: Surplus Timeout ${docNumber}`);
  }
}

/**
 * QCI Inspection SLA warning.
 * createdAt + 14 days deadline is within the next hour.
 */
async function checkQciInspectionWarnings(now: Date, oneHourFromNow: Date): Promise<void> {
  const slaMs = slaHoursToMs(SLA_HOURS.qc_inspection);
  const windowStart = new Date(now.getTime() - slaMs);
  const windowEnd = new Date(oneHourFromNow.getTime() - slaMs);

  const delegate = getDelegate('rfim');

  const atRisk = await delegate.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      createdAt: { gt: windowStart, lt: windowEnd },
    },
    select: { id: true, rfimNumber: true },
  } as unknown);

  // Hoist role lookup before the loop
  const qcIds = await getEmployeeIdsByRole('qc_officer');

  // Batch check recent notifications
  const atRiskIds = atRisk.map(d => d.id as string);
  const recentlyNotified = await getRecentNotificationRefs('rfim', atRiskIds, 'SLA Warning', now);

  for (const doc of atRisk) {
    const docId = doc.id as string;
    const docNumber = (doc.rfimNumber as string) || docId;

    if (recentlyNotified.has(docId)) continue;

    await notifySla({
      recipientIds: qcIds,
      title: 'SLA Warning: QC Inspection',
      body: `QCI ${docNumber} inspection SLA deadline is within the next hour.`,
      notificationType: 'sla_warning',
      referenceTable: 'rfim',
      referenceId: docId,
      socketEvent: 'sla:warning',
      socketRoles: ['qc_officer', 'admin'],
    });

    log('info', `[Scheduler] SLA warning: QCI Inspection ${docNumber}`);
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

    // Mark alerts as sent — batch update using Prisma query builder
    await prisma.inventoryLevel.updateMany({
      where: {
        OR: lowStockItems.map(i => ({
          itemId: i.item_id,
          warehouseId: i.warehouse_id,
        })),
      },
      data: { alertSent: true },
    });

    // Notify warehouse staff
    const warehouseStaff = await prisma.employee.findMany({
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
        createNotification(
          {
            recipientId: staff.id,
            title: `Low Stock Alert: ${lowStockItems.length} item(s)`,
            body: notificationBody,
            notificationType: isCritical ? 'alert' : 'warning',
            referenceTable: 'inventory_levels',
          },
          io ?? undefined,
        ),
      ),
    );

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

// ── ABC Classification Recalculation ─────────────────────────────────────

async function recalculateAbcClassification(): Promise<void> {
  try {
    const results = await calculateABCClassification();
    if (results.length > 0) {
      await applyABCClassification(results);
      log(
        'info',
        `[Scheduler] ABC classification: ${results.length} items updated (A: ${results.filter(r => r.abcClass === 'A').length}, B: ${results.filter(r => r.abcClass === 'B').length}, C: ${results.filter(r => r.abcClass === 'C').length})`,
      );
    }
  } catch (err) {
    log('error', `[Scheduler] ABC classification failed: ${(err as Error).message}`);
  }
}

// ── Cycle Count Auto-Create ───────────────────────────────────────────────

async function runCycleCountAutoCreate(): Promise<void> {
  try {
    await autoCreateCycleCounts();
    log('info', '[Scheduler] Cycle count auto-creation completed');
  } catch (err) {
    log('error', `[Scheduler] Cycle count auto-creation failed: ${(err as Error).message}`);
  }
}

// ── Scheduler Lifecycle ──────────────────────────────────────────────────

export function startScheduler(socketIo?: SocketIOServer): void {
  io = socketIo ?? null;
  running = true;

  log('info', '[Scheduler] Starting background job scheduler');

  // Sequential loops with distributed locks (lock TTL slightly less than interval)
  // SLA breach detection — every 5 minutes (lock: 4 min)
  scheduleLoop('sla_breach', checkSlaBreaches, 5 * 60 * 1000, 240);

  // SLA warning detection — every 5 minutes (lock: 4 min)
  scheduleLoop('sla_warning', checkSlaWarnings, 5 * 60 * 1000, 240);

  // Email retry — every 2 minutes (lock: 90 sec)
  scheduleLoop('email_retry', retryEmails, 2 * 60 * 1000, 90);

  // Expired lot marking — every hour (lock: 50 min)
  scheduleLoop('expired_lots', markExpiredLots, 60 * 60 * 1000, 3000);

  // Low stock alert — every 30 minutes (lock: 25 min)
  scheduleLoop('low_stock', checkLowStock, 30 * 60 * 1000, 1500);

  // Token cleanup — every 6 hours (lock: 5 hours)
  scheduleLoop('token_cleanup', cleanupTokens, 6 * 60 * 60 * 1000, 18000);

  // ABC classification — every 7 days (lock: 6 days)
  scheduleLoop('abc_classification', recalculateAbcClassification, 7 * 24 * 60 * 60 * 1000, 518400);

  // Cycle count auto-creation — daily (lock: 23 hours)
  scheduleLoop('cycle_count_auto', runCycleCountAutoCreate, 24 * 60 * 60 * 1000, 82800);

  // Scheduled workflow rules — every 60 seconds (lock: 50 sec)
  scheduleLoop('scheduled_rules', processScheduledRules, 60 * 1000, 50);

  // Initialize nextRunAt for any scheduled rules that don't have one
  initializeScheduledRules().catch(err =>
    log('error', `[Scheduler] Failed to initialize scheduled rules: ${(err as Error).message}`),
  );

  // Run initial checks after a short delay (let server finish starting up)
  const initTimer = setTimeout(async () => {
    if (!running) return;
    const hasLock = await acquireLock('initial_run', 30);
    if (hasLock) {
      checkSlaBreaches();
      checkSlaWarnings();
      retryEmails();
      markExpiredLots();
    }
  }, 10_000);
  timers.push(initTimer);

  log('info', '[Scheduler] All jobs registered');
}

export function stopScheduler(): void {
  running = false;
  for (const timer of timers) {
    clearTimeout(timer);
  }
  timers.length = 0;
  io = null;
  log('info', '[Scheduler] Scheduler stopped');
}
