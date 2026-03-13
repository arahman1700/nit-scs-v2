/**
 * Background Job Scheduler — BullMQ Orchestrator
 *
 * Registers all domain jobs as BullMQ repeatable jobs with:
 * - Automatic retry with exponential backoff
 * - Dead-letter queue for permanently failed jobs
 * - Priority-based execution
 * - Redis-backed distributed coordination (no setInterval)
 * - Oracle-compatible job naming (INV_, SCM_, EAM_, ONT_, HR_)
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

import { getQueue, shutdownQueues } from '../../../infrastructure/queue/bullmq.config.js';
import { JOB_DEFINITIONS } from '../../../infrastructure/queue/job-definitions.js';
import { startWorkers } from '../../../infrastructure/queue/queue-worker.js';

// ── Import domain job modules for side-effect registration ───────────────
import '../jobs/sla-jobs.js';
import '../jobs/maintenance-jobs.js';
import '../jobs/customs-jobs.js';
import '../../notifications/jobs/notification-jobs.js';
import '../../inventory/jobs/expiry-jobs.js';

let io: SocketIOServer | null = null;
let running = false;

// ── Helpers (shared across domain job handlers via JobContext) ────────────

export function getDelegate(modelName: string): PrismaDelegate {
  return getPrismaDelegate<PrismaDelegate>(prisma, modelName);
}

export function slaHoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

let _slaConfig: Record<string, number> = { ...SLA_HOURS };

export async function refreshSlaConfig(): Promise<void> {
  try {
    _slaConfig = await getAllSlaHours();
  } catch {
    // Keep existing (falls back to hardcoded)
  }
}

export function getSlaConfig(): Record<string, number> {
  return _slaConfig;
}

export function _computeSlaDeadline(referenceDate: Date | string, slaKey: string): Date | null {
  const hours = _slaConfig[slaKey] ?? SLA_HOURS[slaKey];
  if (!hours) return null;
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  return new Date(ref.getTime() + slaHoursToMs(hours));
}

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

export async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.employee.findMany({
    where: { systemRole: 'admin', isActive: true },
    select: { id: true },
  });
  return admins.map(a => a.id);
}

export async function getEmployeeIdsByRole(role: string): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: { systemRole: role, isActive: true },
    select: { id: true },
  });
  return employees.map(e => e.id);
}

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

export async function startScheduler(socketIo?: SocketIOServer): Promise<void> {
  io = socketIo ?? null;
  running = true;

  log('info', '[Scheduler] Starting BullMQ-based job scheduler');

  const ctx = buildJobContext();

  // Ensure domain job modules are loaded (side-effect imports above)
  const legacyJobs = getAllJobs();
  log('info', `[Scheduler] ${legacyJobs.length} legacy job handlers registered`);

  // Initialize scheduled rules (runs regardless of BullMQ or fallback mode)
  initializeScheduledRules().catch(err =>
    log('error', `[Scheduler] Failed to initialize scheduled rules: ${(err as Error).message}`),
  );

  // Check if Redis is available for BullMQ
  const redis = getRedis();
  if (!redis) {
    log('warn', '[Scheduler] Redis unavailable — falling back to setInterval mode');
    startFallbackScheduler(ctx);
    return;
  }

  // Register all jobs as BullMQ repeatables
  for (const def of JOB_DEFINITIONS) {
    const queue = getQueue(def.queue);

    // Remove any existing repeatable with the same name (idempotent re-registration)
    const existing = await queue.getRepeatableJobs();
    for (const rep of existing) {
      if (rep.name === def.name) {
        await queue.removeRepeatableByKey(rep.key);
      }
    }

    // Add repeatable job
    await queue.add(
      def.name,
      { legacyName: def.legacyName },
      {
        repeat: def.repeat,
        priority: def.priority,
        attempts: def.attempts,
        backoff: def.backoff,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 200 },
      },
    );

    log('debug', `[Scheduler] Registered BullMQ job: ${def.name} (legacy: ${def.legacyName})`);
  }

  // Start workers to process jobs
  startWorkers(ctx);

  log(
    'info',
    `[Scheduler] ${JOB_DEFINITIONS.length} BullMQ jobs registered across ${new Set(JOB_DEFINITIONS.map(j => j.queue)).size} queues`,
  );
}

// ── Fallback: setInterval mode (when Redis unavailable) ──────────────────

const fallbackTimers: ReturnType<typeof setTimeout>[] = [];

function startFallbackScheduler(ctx: JobContext): void {
  const jobs = getAllJobs();

  function scheduleLoop(name: string, fn: () => Promise<void>, intervalMs: number): void {
    async function tick() {
      if (!running) return;
      await fn().catch(err => log('error', `[Scheduler:fallback] ${name} failed: ${(err as Error).message}`));
      if (running) {
        const timer = setTimeout(tick, intervalMs);
        fallbackTimers.push(timer);
      }
    }
    const timer = setTimeout(tick, intervalMs);
    fallbackTimers.push(timer);
  }

  for (const job of jobs) {
    scheduleLoop(job.name, () => job.handler(ctx), job.intervalMs);
  }

  // Initial run
  const initTimer = setTimeout(async () => {
    if (!running) return;
    const initialJobNames = ['sla_breach', 'sla_warning', 'email_retry', 'expired_lots'];
    const initialJobs = jobs.filter(j => initialJobNames.includes(j.name));
    await Promise.allSettled(initialJobs.map(j => j.handler(ctx)));
  }, 10_000);
  fallbackTimers.push(initTimer);

  log('info', `[Scheduler:fallback] ${jobs.length} jobs running with setInterval`);
}

export async function stopScheduler(): Promise<void> {
  running = false;

  // Stop fallback timers if used
  for (const timer of fallbackTimers) {
    clearTimeout(timer);
  }
  fallbackTimers.length = 0;

  // Shutdown BullMQ workers and queues
  await shutdownQueues();

  io = null;
  clearJobs();
  log('info', '[Scheduler] Scheduler stopped');
}
