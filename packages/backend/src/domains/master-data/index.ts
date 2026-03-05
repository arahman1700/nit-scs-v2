import type { Router } from 'express';
import masterDataRoutes from '../../routes/master-data.routes.js';

export function registerMasterDataRoutes(router: Router) {
  router.use('/', masterDataRoutes);
}
