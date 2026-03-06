import type { Router } from 'express';
import authRoutes from './routes/auth.routes.js';
import permissionsRoutes from './routes/permissions.routes.js';
import securityRoutes from './routes/security.routes.js';

export function registerAuthRoutes(router: Router) {
  router.use('/auth', authRoutes);
  router.use('/permissions', permissionsRoutes);
  router.use('/security', securityRoutes);
}
