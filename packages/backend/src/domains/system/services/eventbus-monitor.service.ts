import { getEventBusStats } from '../../../events/event-bus.js';
import { getAllQueues, getDeadLetterQueue } from '../../../infrastructure/queue/bullmq.config.js';

// ── EventBus Stats ──────────────────────────────────────────────────────────

/** Returns in-memory EventBus instrumentation stats. */
export function getEventBusMonitorStats() {
  return getEventBusStats();
}

// ── Queue Stats ─────────────────────────────────────────────────────────────

export interface QueueJobCounts {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/** Iterates all registered BullMQ queues and returns job counts for each. */
export async function getQueueStats(): Promise<QueueJobCounts[]> {
  const queues = getAllQueues();
  const results: QueueJobCounts[] = [];

  for (const queue of queues) {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    results.push({
      name: queue.name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    });
  }

  return results;
}

// ── Dead Letter Queue ───────────────────────────────────────────────────────

export interface DlqJobEntry {
  id: string | undefined;
  name: string;
  data: unknown;
  failedReason: string | undefined;
  timestamp: number;
  processedOn: number | undefined;
  finishedOn: number | undefined;
}

export interface DlqPage {
  jobs: DlqJobEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Returns paginated failed/waiting jobs from the Dead Letter Queue. */
export async function getDlqJobs(page = 1, pageSize = 20): Promise<DlqPage> {
  const dlq = getDeadLetterQueue();
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const [jobs, waitingCount, failedCount] = await Promise.all([
    dlq.getJobs(['waiting', 'failed'], start, end),
    dlq.getJobCountByTypes('waiting'),
    dlq.getJobCountByTypes('failed'),
  ]);

  const total = waitingCount + failedCount;

  return {
    jobs: jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    })),
    total,
    page,
    pageSize,
  };
}

/** Retries a specific job from the Dead Letter Queue by re-adding it. */
export async function retryDlqJob(jobId: string): Promise<boolean> {
  const dlq = getDeadLetterQueue();
  const job = await dlq.getJob(jobId);

  if (!job) {
    return false;
  }

  // Retry the job (moves it back to waiting)
  await job.retry();
  return true;
}
