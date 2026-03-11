import type { Router } from 'express';
import auditRoutes from './routes/audit.routes.js';

export function registerAuditRoutes(router: Router) {
  router.use('/audit', auditRoutes);
}
