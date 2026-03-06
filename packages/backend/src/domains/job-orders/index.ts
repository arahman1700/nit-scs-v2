import type { Router } from 'express';
import laborRoutes from './routes/labor.routes.js';

export function registerJobOrderRoutes(router: Router) {
  // Note: job-order routes are mounted via logistics.routes.ts
  router.use('/labor', laborRoutes);
}
