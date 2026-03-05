import type { Router } from 'express';
import logisticsRoutes from '../../routes/logistics.routes.js';
import shipmentRoutes from '../../routes/shipment.routes.js';
import routeOptimizerRoutes from '../../routes/route-optimizer.routes.js';
import transportOrderRoutes from '../../routes/transport-order.routes.js';
import customsDocumentRoutes from '../../routes/customs-document.routes.js';
import tariffRoutes from '../../routes/tariff.routes.js';

export function registerLogisticsRoutes(router: Router) {
  // logistics.routes.ts mounts job-orders, gate-passes, stock-transfers, mrf, shipments
  router.use('/', logisticsRoutes);
  router.use('/route-optimizer', routeOptimizerRoutes);
  router.use('/transport-orders', transportOrderRoutes);
  router.use('/customs-documents', customsDocumentRoutes);
  router.use('/tariffs', tariffRoutes);
}
