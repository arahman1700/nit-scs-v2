/**
 * Queue Worker — Processes BullMQ Jobs
 *
 * Bridges BullMQ jobs to the existing job registry handlers.
 * Each job carries its legacyName, which maps to the handler in the job registry.
 */

import type { Job } from 'bullmq';
import { QUEUE_NAMES, createWorker, moveToDeadLetter, type QueueName } from './bullmq.config.js';
import { JOB_DEFINITIONS, JOB_LEGACY_MAP, type JobName } from './job-definitions.js';
import { getAllJobs, type JobContext } from '../../utils/job-registry.js';
import { logger } from '../../config/logger.js';

// ── Worker Processor ────────────────────────────────────────────────────────

/**
 * Create a unified processor for a given queue.
 * Looks up the legacy job handler by the BullMQ job name.
 */
function createProcessor(ctx: JobContext) {
  return async (job: Job) => {
    const legacyName = JOB_LEGACY_MAP[job.name as JobName];
    if (!legacyName) {
      logger.warn({ jobName: job.name }, 'No legacy handler mapping found for BullMQ job');
      return;
    }

    const allJobs = getAllJobs();
    const handler = allJobs.find(j => j.name === legacyName);
    if (!handler) {
      logger.warn({ jobName: job.name, legacyName }, 'Legacy job handler not registered');
      return;
    }

    logger.info({ jobName: job.name, legacyName, attempt: job.attemptsMade + 1 }, 'Processing job');

    await handler.handler(ctx);

    logger.info({ jobName: job.name, legacyName }, 'Job completed successfully');
  };
}

// ── Start Workers ───────────────────────────────────────────────────────────

/**
 * Start BullMQ workers for all queues.
 * Each queue gets one worker with concurrency=1 (matches the old sequential model).
 */
export function startWorkers(ctx: JobContext): void {
  const queueNames = new Set(JOB_DEFINITIONS.map(j => j.queue));

  for (const queueName of queueNames) {
    const worker = createWorker(queueName, createProcessor(ctx), {
      concurrency: 1, // Sequential execution per queue (same as old scheduler)
    });

    // Dead-letter handling: move permanently failed jobs
    worker.on('failed', (job, err) => {
      if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
        moveToDeadLetter({
          id: job.id,
          name: job.name,
          data: job.data,
          failedReason: err.message,
          attemptsMade: job.attemptsMade,
          queueName,
        }).catch(dlqErr => {
          logger.error({ err: dlqErr }, 'Failed to move job to dead-letter queue');
        });
      }
    });

    logger.info({ queue: queueName }, 'Worker started');
  }
}
