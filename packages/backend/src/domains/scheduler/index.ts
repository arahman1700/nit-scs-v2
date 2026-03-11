/**
 * Scheduler Domain — Background job orchestration.
 *
 * This domain has no HTTP routes. It exports lifecycle functions
 * (startScheduler / stopScheduler) consumed by the application entry point.
 *
 * Job modules (sla-jobs, maintenance-jobs) self-register via the job registry
 * and are imported for side-effects inside scheduler.service.ts.
 */

export { startScheduler, stopScheduler } from './services/scheduler.service.js';
