/**
 * Scheduler Admin Service — Introspects BullMQ queues for admin dashboard
 *
 * Provides read/write operations on scheduled jobs:
 * - Enumerate all registered jobs and their runtime status
 * - Trigger, pause, and resume individual jobs
 * - Fetch execution history from BullMQ completed/failed lists
 * - Manage Dead Letter Queue entries
 */

import { getQueue, getAllQueues, getDeadLetterQueue } from '../../../infrastructure/queue/bullmq.config.js';
import { JOB_DEFINITIONS, type JobDefinition, type JobName } from '../../../infrastructure/queue/job-definitions.js';
import { logger } from '../../../config/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SchedulerJobInfo {
  name: string;
  legacyName: string;
  queue: string;
  schedule: string;
  scheduleMs: number | null;
  cronPattern: string | null;
  priority: number;
  maxAttempts: number;
  status: 'active' | 'paused' | 'unknown';
  lastRun: string | null;
  nextRun: string | null;
  completedCount: number;
  failedCount: number;
}

export interface JobHistoryEntry {
  id: string | undefined;
  jobName: string;
  status: 'completed' | 'failed';
  processedOn: string | null;
  finishedOn: string | null;
  duration: number | null;
  failedReason: string | null;
  attemptsMade: number;
}

export interface DlqEntry {
  id: string | undefined;
  jobName: string;
  originalQueue: string | null;
  originalJobName: string | null;
  failedAt: string | null;
  failedReason: string | null;
  retryCount: number;
  data: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSchedule(def: JobDefinition): string {
  if ('pattern' in def.repeat) return def.repeat.pattern;
  const ms = def.repeat.every;
  if (ms >= 86_400_000) return `Every ${Math.round(ms / 86_400_000)}d`;
  if (ms >= 3_600_000) return `Every ${Math.round(ms / 3_600_000)}h`;
  if (ms >= 60_000) return `Every ${Math.round(ms / 60_000)}m`;
  return `Every ${Math.round(ms / 1000)}s`;
}

function findDefinition(jobName: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find(d => d.name === jobName);
}

// ── Job Listing ──────────────────────────────────────────────────────────────

export async function getSchedulerJobs(): Promise<SchedulerJobInfo[]> {
  const results: SchedulerJobInfo[] = [];

  for (const def of JOB_DEFINITIONS) {
    const queue = getQueue(def.queue);
    let status: 'active' | 'paused' | 'unknown' = 'unknown';
    let lastRun: string | null = null;
    let nextRun: string | null = null;
    let completedCount = 0;
    let failedCount = 0;

    try {
      // Check if the queue is paused
      const isPaused = await queue.isPaused();

      // Get repeatable jobs for next-run info
      const repeatables = await queue.getRepeatableJobs();
      const thisRepeatable = repeatables.find(r => r.name === def.name);

      if (thisRepeatable) {
        status = isPaused ? 'paused' : 'active';
        if (thisRepeatable.next) {
          nextRun = new Date(thisRepeatable.next).toISOString();
        }
      } else {
        status = 'paused'; // Not registered = effectively paused
      }

      // Get most recent completed job for last-run info
      const completed = await queue.getJobs(['completed'], 0, 0);
      const lastCompleted = completed.find(j => j.name === def.name);
      if (lastCompleted?.finishedOn) {
        lastRun = new Date(lastCompleted.finishedOn).toISOString();
      }

      // Counts
      const allCompleted = await queue.getJobs(['completed'], 0, 999);
      const allFailed = await queue.getJobs(['failed'], 0, 999);
      completedCount = allCompleted.filter(j => j.name === def.name).length;
      failedCount = allFailed.filter(j => j.name === def.name).length;
    } catch (err) {
      logger.warn({ jobName: def.name, err: (err as Error).message }, 'Failed to get job status from BullMQ');
    }

    results.push({
      name: def.name,
      legacyName: def.legacyName,
      queue: def.queue,
      schedule: formatSchedule(def),
      scheduleMs: 'every' in def.repeat ? def.repeat.every : null,
      cronPattern: 'pattern' in def.repeat ? def.repeat.pattern : null,
      priority: def.priority,
      maxAttempts: def.attempts,
      status,
      lastRun,
      nextRun,
      completedCount,
      failedCount,
    });
  }

  return results;
}

// ── Trigger Immediate Run ────────────────────────────────────────────────────

export async function triggerJob(jobName: string): Promise<{ found: boolean; jobId?: string }> {
  const def = findDefinition(jobName as JobName);
  if (!def) return { found: false };

  const queue = getQueue(def.queue);
  const job = await queue.add(
    def.name,
    { legacyName: def.legacyName, triggeredManually: true },
    {
      priority: 1, // High priority for manual triggers
      attempts: def.attempts,
      backoff: def.backoff,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 200 },
    },
  );

  logger.info({ jobName: def.name, jobId: job.id }, 'Job triggered manually');
  return { found: true, jobId: job.id };
}

// ── Pause Job ────────────────────────────────────────────────────────────────

export async function pauseJob(jobName: string): Promise<{ found: boolean }> {
  const def = findDefinition(jobName as JobName);
  if (!def) return { found: false };

  const queue = getQueue(def.queue);

  // Remove the repeatable to prevent future scheduled runs
  const repeatables = await queue.getRepeatableJobs();
  for (const rep of repeatables) {
    if (rep.name === def.name) {
      await queue.removeRepeatableByKey(rep.key);
    }
  }

  logger.info({ jobName: def.name }, 'Job paused (repeatable removed)');
  return { found: true };
}

// ── Resume Job ───────────────────────────────────────────────────────────────

export async function resumeJob(jobName: string): Promise<{ found: boolean }> {
  const def = findDefinition(jobName as JobName);
  if (!def) return { found: false };

  const queue = getQueue(def.queue);

  // Re-add the repeatable job
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

  logger.info({ jobName: def.name }, 'Job resumed (repeatable re-registered)');
  return { found: true };
}

// ── Job History ──────────────────────────────────────────────────────────────

export async function getJobHistory(
  jobName: string,
  page: number,
  pageSize: number,
): Promise<{
  found: boolean;
  entries: JobHistoryEntry[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const def = findDefinition(jobName as JobName);
  if (!def) return { found: false, entries: [], page, pageSize, total: 0 };

  const queue = getQueue(def.queue);

  // Fetch both completed and failed jobs for this job name
  const [allCompleted, allFailed] = await Promise.all([
    queue.getJobs(['completed'], 0, 999),
    queue.getJobs(['failed'], 0, 999),
  ]);

  const matchingCompleted = allCompleted
    .filter(j => j.name === def.name)
    .map(j => ({
      id: j.id,
      jobName: j.name,
      status: 'completed' as const,
      processedOn: j.processedOn ? new Date(j.processedOn).toISOString() : null,
      finishedOn: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
      duration: j.processedOn && j.finishedOn ? j.finishedOn - j.processedOn : null,
      failedReason: null,
      attemptsMade: j.attemptsMade,
    }));

  const matchingFailed = allFailed
    .filter(j => j.name === def.name)
    .map(j => ({
      id: j.id,
      jobName: j.name,
      status: 'failed' as const,
      processedOn: j.processedOn ? new Date(j.processedOn).toISOString() : null,
      finishedOn: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
      duration: j.processedOn && j.finishedOn ? j.finishedOn - j.processedOn : null,
      failedReason: j.failedReason ?? null,
      attemptsMade: j.attemptsMade,
    }));

  // Merge and sort by processedOn descending
  const all = [...matchingCompleted, ...matchingFailed].sort((a, b) => {
    const ta = a.processedOn ? new Date(a.processedOn).getTime() : 0;
    const tb = b.processedOn ? new Date(b.processedOn).getTime() : 0;
    return tb - ta;
  });

  const total = all.length;
  const start = (page - 1) * pageSize;
  const entries = all.slice(start, start + pageSize);

  return { found: true, entries, page, pageSize, total };
}

// ── Dead Letter Queue ────────────────────────────────────────────────────────

export async function getDlqEntries(
  page: number,
  pageSize: number,
): Promise<{
  entries: DlqEntry[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const dlq = getDeadLetterQueue();
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const [jobs, waitingCount, failedCount] = await Promise.all([
    dlq.getJobs(['waiting', 'failed'], start, end),
    dlq.getJobCountByTypes('waiting'),
    dlq.getJobCountByTypes('failed'),
  ]);

  const total = waitingCount + failedCount;

  const entries: DlqEntry[] = jobs.map(job => {
    const jobData = job.data as Record<string, unknown> | undefined;
    return {
      id: job.id,
      jobName: job.name,
      originalQueue: (jobData?.originalQueue as string) ?? null,
      originalJobName: (jobData?.originalJobName as string) ?? null,
      failedAt: jobData?.movedAt
        ? String(jobData.movedAt)
        : job.timestamp
          ? new Date(job.timestamp).toISOString()
          : null,
      failedReason: (jobData?.failedReason as string) ?? job.failedReason ?? null,
      retryCount: (jobData?.attempts as number) ?? job.attemptsMade ?? 0,
      data: jobData?.data ?? null,
    };
  });

  return { entries, page, pageSize, total };
}

export async function retryDlqEntry(id: string): Promise<boolean> {
  const dlq = getDeadLetterQueue();
  const job = await dlq.getJob(id);
  if (!job) return false;

  const jobData = job.data as Record<string, unknown> | undefined;
  const originalQueue = (jobData?.originalQueue as string) ?? null;
  const originalJobName = (jobData?.originalJobName as string) ?? null;

  // If we know the original queue, re-add the job there
  if (originalQueue && originalJobName) {
    const def = JOB_DEFINITIONS.find(d => d.name === originalJobName || d.queue === originalQueue);
    if (def) {
      const queue = getQueue(def.queue);
      await queue.add(originalJobName, jobData?.data ?? { legacyName: def.legacyName }, {
        priority: 1,
        attempts: def.attempts,
        backoff: def.backoff,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 200 },
      });
    }
  }

  // Remove from DLQ
  await job.remove();
  logger.info({ dlqJobId: id, originalJobName }, 'DLQ entry retried and removed');
  return true;
}

export async function deleteDlqEntry(id: string): Promise<boolean> {
  const dlq = getDeadLetterQueue();
  const job = await dlq.getJob(id);
  if (!job) return false;

  await job.remove();
  logger.info({ dlqJobId: id }, 'DLQ entry deleted');
  return true;
}
