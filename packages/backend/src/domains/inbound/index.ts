import type { Router } from 'express';
import grnRoutes from './routes/grn.routes.js';
import qciRoutes from './routes/qci.routes.js';
import drRoutes from './routes/dr.routes.js';
import inspectionRoutes from './routes/inspection.routes.js';
import asnRoutes from './routes/asn.routes.js';
// V1 backward-compatible aliases
import mrrvRoutes from './routes/mrrv.routes.js';
import rfimRoutes from './routes/rfim.routes.js';
import osdRoutes from './routes/osd.routes.js';
import receivingAutomationRoutes from './routes/receiving-automation.routes.js';

export function registerInboundRoutes(router: Router) {
  // V2 primary routes
  router.use('/grn', grnRoutes);
  router.use('/qci', qciRoutes);
  router.use('/dr', drRoutes);
  router.use('/inspections', inspectionRoutes);
  router.use('/asn', asnRoutes);
  router.use('/receiving-automation', receivingAutomationRoutes);
  // V1 aliases
  router.use('/mrrv', mrrvRoutes);
  router.use('/rfim', rfimRoutes);
  router.use('/osd', osdRoutes);
}
