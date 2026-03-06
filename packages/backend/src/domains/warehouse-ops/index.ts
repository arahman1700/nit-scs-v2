import type { Router } from 'express';
import warehouseZoneRoutes from '../../routes/warehouse-zone.routes.js';
import binLocationRoutes from '../inventory/routes/bin-location.routes.js';

export function registerWarehouseOpsRoutes(router: Router) {
  router.use('/warehouse-zones', warehouseZoneRoutes);
  router.use('/bin-locations', binLocationRoutes);
  // MVP DEFERRED: putaway-rules, slotting, staging, cross-dock, yard, packing
}
