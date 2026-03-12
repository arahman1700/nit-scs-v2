/**
 * Queue Infrastructure — Public API
 *
 * Re-exports everything needed to interact with the BullMQ queue system.
 */

export {
  QUEUE_NAMES,
  getQueue,
  getAllQueues,
  shutdownQueues,
  getDeadLetterQueue,
  moveToDeadLetter,
} from './bullmq.config.js';
export { JOB_NAMES, JOB_DEFINITIONS, JOB_LEGACY_MAP, getJobDefinition, getJobsForQueue } from './job-definitions.js';
export type { JobName, JobDefinition } from './job-definitions.js';
export { startWorkers } from './queue-worker.js';
export { mountQueueDashboard } from './queue-dashboard.js';
