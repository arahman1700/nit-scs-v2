import type { Router } from 'express';
import miRoutes from '../../routes/mi.routes.js';
import mrnRoutes from '../../routes/mrn.routes.js';
import mrRoutes from '../../routes/mr.routes.js';
import pickOptimizerRoutes from '../../routes/pick-optimizer.routes.js';
// V1 backward-compatible aliases
import mirvRoutes from '../../routes/mirv.routes.js';
import mrvRoutes from '../../routes/mrv.routes.js';

export function registerOutboundRoutes(router: Router) {
  // V2 primary routes
  router.use('/mi', miRoutes);
  router.use('/mrn', mrnRoutes);
  router.use('/mr', mrRoutes);
  router.use('/pick-optimizer', pickOptimizerRoutes);
  // V1 aliases
  router.use('/mirv', mirvRoutes);
  router.use('/mrv', mrvRoutes);
}
