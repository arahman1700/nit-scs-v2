import type { Router } from 'express';
import warehouseZoneRoutes from './routes/warehouse-zone.routes.js';
import binLocationRoutes from '../inventory/routes/bin-location.routes.js';
import putawayRulesRoutes from './routes/putaway-rules.routes.js';
import slottingRoutes from './routes/slotting.routes.js';
import stagingRoutes from './routes/staging.routes.js';
import crossDockRoutes from './routes/cross-dock.routes.js';
import yardRoutes from './routes/yard.routes.js';
import packingRoutes from './routes/packing.routes.js';
import sensorRoutes from './routes/sensor.routes.js';
import wmsTaskRoutes from './routes/wms-task.routes.js';
import lpnRoutes from './routes/lpn.routes.js';
import rfidRoutes from './routes/rfid.routes.js';
import waveRoutes from './routes/wave.routes.js';
import stockAllocationRoutes from './routes/stock-allocation.routes.js';

export function registerWarehouseOpsRoutes(router: Router) {
  router.use('/warehouse-zones', warehouseZoneRoutes);
  router.use('/bin-locations', binLocationRoutes);
  router.use('/putaway-rules', putawayRulesRoutes);
  router.use('/slotting', slottingRoutes);
  router.use('/staging', stagingRoutes);
  router.use('/cross-docks', crossDockRoutes);
  router.use('/yard', yardRoutes);
  router.use('/packing', packingRoutes);
  router.use('/sensors', sensorRoutes);
  router.use('/wms-tasks', wmsTaskRoutes);
  router.use('/lpns', lpnRoutes);
  router.use('/rfid', rfidRoutes);
  router.use('/waves', waveRoutes);
  router.use('/stock-allocations', stockAllocationRoutes);
}
