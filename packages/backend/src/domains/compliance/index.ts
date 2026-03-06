import type { Router } from 'express';
import complianceRoutes from './routes/compliance.routes.js';
import supplierEvaluationRoutes from './routes/supplier-evaluation.routes.js';
import visitorRoutes from './routes/visitor.routes.js';

export function registerComplianceRoutes(router: Router) {
  router.use('/compliance', complianceRoutes);
  router.use('/supplier-evaluations', supplierEvaluationRoutes);
  router.use('/visitors', visitorRoutes);
}
