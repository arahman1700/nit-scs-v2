/**
 * BullMQ Configuration — Oracle-Compatible Queue Infrastructure
 *
 * Queue naming follows Oracle WMS/SCM module conventions:
 * - WMS_QUEUE: Warehouse Management System jobs (cycle counts, putaway, slotting)
 * - INV_QUEUE: Inventory Management jobs (ABC, stock alerts, expiry)
 * - SCM_QUEUE: Supply Chain jobs (SLA, reconciliation, reports)
 * - HR_QUEUE:  Human Resources jobs (security, tokens, visitors)
 * - EAM_QUEUE: Enterprise Asset Management jobs (depreciation, AMC, vehicles)
 * - ONT_QUEUE: Order & Notification Transport jobs (email, push, notifications)
 */

import { Queue, Worker, type ConnectionOptions, type Processor } from 'bullmq';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../config/logger.js';

// ── Connection ──────────────────────────────────────────────────────────────

/**
 * Build BullMQ-compatible connection options from the existing Redis client.
 * Reuses REDIS_URL for consistency across the application.
 */
export function getQueueConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const useTls = url.startsWith('rediss://');

  return {
    host: new URL(url.replace('rediss://', 'https://')).hostname,
    port: Number(new URL(url.replace('rediss://', 'https://')).port) || 6379,
    password: new URL(url.replace('rediss://', 'https://')).password || undefined,
    username: new URL(url.replace('rediss://', 'https://')).username || undefined,
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null, // Required by BullMQ
  };
}

// ── Queue Names (Oracle Module Alignment) ───────────────────────────────────

export const QUEUE_NAMES = {
  /** Oracle INV — Inventory Management */
  INV_QUEUE: 'INV_QUEUE',
  /** Oracle WMS — Warehouse Management */
  WMS_QUEUE: 'WMS_QUEUE',
  /** Oracle SCM — Supply Chain Management */
  SCM_QUEUE: 'SCM_QUEUE',
  /** Oracle HR — Human Resources / Security */
  HR_QUEUE: 'HR_QUEUE',
  /** Oracle EAM — Enterprise Asset Management */
  EAM_QUEUE: 'EAM_QUEUE',
  /** Oracle ONT — Order & Notification Transport */
  ONT_QUEUE: 'ONT_QUEUE',
  /** Dead Letter Queue — Failed jobs after max retries */
  DLQ: 'DEAD_LETTER_QUEUE',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ── Queue Factory ───────────────────────────────────────────────────────────

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    });
    queues.set(name, queue);
  }
  return queue;
}

/** Get all active queues (for dashboard and shutdown). */
export function getAllQueues(): Queue[] {
  return Array.from(queues.values());
}

// ── Worker Factory ──────────────────────────────────────────────────────────

const workers: Worker[] = [];

export function createWorker(queueName: QueueName, processor: Processor, opts?: { concurrency?: number }): Worker {
  const worker = new Worker(queueName, processor, {
    connection: getQueueConnection(),
    concurrency: opts?.concurrency ?? 1,
  });

  worker.on('completed', job => {
    logger.debug({ jobId: job.id, jobName: job.name, queue: queueName }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, queue: queueName, err: err.message, attempts: job?.attemptsMade },
      'Job failed',
    );
  });

  worker.on('error', err => {
    logger.error({ queue: queueName, err: err.message }, 'Worker error');
  });

  workers.push(worker);
  return worker;
}

// ── Dead Letter Queue ───────────────────────────────────────────────────────

let dlq: Queue | null = null;

export function getDeadLetterQueue(): Queue {
  if (!dlq) {
    dlq = new Queue(QUEUE_NAMES.DLQ, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
  return dlq;
}

/**
 * Move a permanently failed job to the dead-letter queue.
 * Called by worker 'failed' handlers when job.attemptsMade >= maxAttempts.
 */
export async function moveToDeadLetter(job: {
  id?: string;
  name: string;
  data: unknown;
  failedReason?: string;
  attemptsMade: number;
  queueName: string;
}): Promise<void> {
  const dead = getDeadLetterQueue();
  await dead.add('DLQ_ENTRY', {
    originalQueue: job.queueName,
    originalJobName: job.name,
    originalJobId: job.id,
    data: job.data,
    failedReason: job.failedReason,
    attempts: job.attemptsMade,
    movedAt: new Date().toISOString(),
  });
  logger.warn(
    { jobId: job.id, jobName: job.name, queue: job.queueName, reason: job.failedReason },
    'Job moved to dead-letter queue',
  );
}

// ── Graceful Shutdown ───────────────────────────────────────────────────────

export async function shutdownQueues(): Promise<void> {
  logger.info({ workerCount: workers.length, queueCount: queues.size }, 'Shutting down BullMQ queues and workers');

  // Close workers first (stop processing)
  await Promise.allSettled(workers.map(w => w.close()));

  // Close queues
  await Promise.allSettled(getAllQueues().map(q => q.close()));

  // Close DLQ
  if (dlq) await dlq.close().catch(() => {});

  workers.length = 0;
  queues.clear();
  dlq = null;

  logger.info('BullMQ shutdown complete');
}
