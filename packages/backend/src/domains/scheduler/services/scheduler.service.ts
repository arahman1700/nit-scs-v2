/**
 * Background Job Scheduler — Thin Orchestrator
 *
 * Runs periodic maintenance tasks using simple setInterval.
 * No external dependency required (no node-cron, no bull).
 *
 * Job handler functions are registered by domain modules via the job registry.
 * This file keeps the scheduler lifecycle (acquireLock, scheduleLoop, start/stop)
 * and all shared helper functions used by domain job handlers.
 *
 * Domain job modules (imported for side-effect registration):
 * - domains/scheduler/jobs/sla-jobs.ts
 * - domains/scheduler/jobs/maintenance-jobs.ts
 * - domains/notifications/jobs/notification-jobs.ts
 * - domains/inventory/jobs/expiry-jobs.ts
 */

import { prisma } from '../../../utils/prisma.js';
import { getPrismaDelegate } from '../../../utils/prisma-helpers.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { initializeScheduledRules } from '../../../events/scheduled-rule-runner.js';
import { log } from '../../../config/logger.js';
import { getRedis } from '../../../config/redis.js';
import { emitToRole, emitToUser } from '../../../socket/setup.js';
import { sendPushToUser } from '../../notifications/services/push-notification.service.js';
import { SLA_HOURS } from '@nit-scs-v2/shared';
import { getAllSlaHours } from '../../system/services/system-config.service.js';
import { getAllJobs, clearJobs } from '../../../utils/job-registry.js';
import type { PrismaDelegate, JobContext } from '../../../utils/job-registry.js';
import type { Server as SocketIOServer } from 'socket.io';

// ── Import domain job modules for side-effect registration ───────────────
import '../jobs/sla-jobs.js';
import '../jobs/maintenance-jobs.js';
import '../../notifications/jobs/notification-jobs.js';
import '../../inventory/jobs/expiry-jobs.js';

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

// ── Helpers (shared across domain job handlers via JobContext) ────────────

/** Prisma delegate for dynamic model access */
export function getDelegate(modelName: string): PrismaDelegate {
  return getPrismaDelegate<PrismaDelegate>(prisma, modelName);
}

/** Convert SLA hours to milliseconds */
export function slaHoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/**
 * Module-level SLA config cache. Refreshed from DB on each scheduler cycle
 * (every 5 min). Falls back to hardcoded SLA_HOURS if DB fetch fails.
 */
let _slaConfig: Record<string, number> = { ...SLA_HOURS };

/** Refresh SLA config from DB. Call once per scheduler cycle. */
export async function refreshSlaConfig(): Promise<void> {
  try {
    _slaConfig = await getAllSlaHours();
  } catch {
    // Keep existing (falls back to hardcoded)
  }
}

/** Get the current SLA config (read-only snapshot). */
export function getSlaConfig(): Record<string, number> {
  return _slaConfig;
}

/**
 * Compute the SLA deadline from a reference date and SLA key.
 * Uses DB-backed SLA config (refreshed each scheduler cycle).
 * Returns null if SLA key not found.
 */
export function _computeSlaDeadline(referenceDate: Date | string, slaKey: string): Date | null {
  const hours = _slaConfig[slaKey] ?? SLA_HOURS[slaKey];
  if (!hours) return null;
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  return new Date(ref.getTime() + slaHoursToMs(hours));
}

/**
 * Check for duplicate notification within the last hour.
 * Returns true if a notification already exists (should skip).
 */
export async function hasRecentNotification(
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
export async function getRecentNotificationRefs(
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
export async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.employee.findMany({
    where: { systemRole: 'admin', isActive: true },
    select: { id: true },
  });
  return admins.map(a => a.id);
}

/** Fetch employee IDs by role */
export async function getEmployeeIdsByRole(role: string): Promise<string[]> {
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
export async function notifySla(params: {
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
    }).catch(err => {
      log('warn', `[Scheduler] Push notification failed: ${(err as Error).message}`);
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

// ── Build JobContext ─────────────────────────────────────────────────────

function buildJobContext(): JobContext {
  return {
    prisma: prisma as JobContext['prisma'],
    io,
    log,
    notifySla,
    getAdminIds,
    getEmployeeIdsByRole,
    getRecentNotificationRefs,
    hasRecentNotification,
    refreshSlaConfig,
    getDelegate,
    slaHoursToMs,
    _computeSlaDeadline,
    getSlaConfig,
    createNotification,
  };
}

// ── Scheduler Lifecycle ──────────────────────────────────────────────────

export function startScheduler(socketIo?: SocketIOServer): void {
  io = socketIo ?? null;
  running = true;

  log('info', '[Scheduler] Starting background job scheduler');

  const ctx = buildJobContext();

  // Register all domain jobs via the job registry and start their loops
  const jobs = getAllJobs();
  for (const job of jobs) {
    scheduleLoop(job.name, () => job.handler(ctx), job.intervalMs, job.lockTtlSec);
  }

  // Initialize nextRunAt for any scheduled rules that don't have one
  initializeScheduledRules().catch(err =>
    log('error', `[Scheduler] Failed to initialize scheduled rules: ${(err as Error).message}`),
  );

  // Run initial checks after a short delay (let server finish starting up)
  const initTimer = setTimeout(async () => {
    if (!running) return;
    const hasLock = await acquireLock('initial_run', 30);
    if (hasLock) {
      // Find initial jobs by name from the registry
      const initialJobNames = ['sla_breach', 'sla_warning', 'email_retry', 'expired_lots'];
      const initialJobs = jobs.filter(j => initialJobNames.includes(j.name));
      const results = await Promise.allSettled(initialJobs.map(j => j.handler(ctx)));
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          log('error', `[Scheduler] Initial ${initialJobs[i].name} failed: ${(r.reason as Error).message}`);
        }
      });
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
  clearJobs();
  log('info', '[Scheduler] Scheduler stopped');
}
