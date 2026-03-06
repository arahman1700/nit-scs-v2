import type { Router } from 'express';
import wtRoutes from './routes/wt.routes.js';
import handoverRoutes from './routes/handover.routes.js';
import imsfRoutes from './routes/imsf.routes.js';

export function registerTransferRoutes(router: Router) {
  router.use('/wt', wtRoutes);
  router.use('/handovers', handoverRoutes);
  router.use('/imsf', imsfRoutes);
}
