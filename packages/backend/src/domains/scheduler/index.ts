/**
 * Scheduler Domain — Background job orchestration + admin routes.
 *
 * Exports:
 * - Lifecycle functions (startScheduler / stopScheduler) consumed by app entry
 * - Route registration for scheduler admin API (/api/v1/scheduler/*)
 *
 * Job modules (sla-jobs, maintenance-jobs) self-register via the job registry
 * and are imported for side-effects inside scheduler.service.ts.
 */

import type { Router } from 'express';
import schedulerRoutes from './routes/scheduler.routes.js';

export { startScheduler, stopScheduler } from './services/scheduler.service.js';

export function registerSchedulerRoutes(router: Router) {
  router.use('/scheduler', schedulerRoutes);
}
