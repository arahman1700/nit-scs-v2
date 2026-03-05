import type { Router } from 'express';
import warehouseZoneRoutes from '../../routes/warehouse-zone.routes.js';

export function registerWarehouseOpsRoutes(router: Router) {
  router.use('/warehouse-zones', warehouseZoneRoutes);
  // MVP DEFERRED: putaway-rules, slotting, staging, cross-dock, yard, packing
}
