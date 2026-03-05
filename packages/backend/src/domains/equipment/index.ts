import type { Router } from 'express';
import toolRoutes from '../../routes/tool.routes.js';
import toolIssueRoutes from '../../routes/tool-issue.routes.js';
import generatorFuelRoutes from '../../routes/generator-fuel.routes.js';
import generatorMaintenanceRoutes from '../../routes/generator-maintenance.routes.js';
import vehicleMaintenanceRoutes from '../../routes/vehicle-maintenance.routes.js';
import assetRoutes from '../../routes/asset.routes.js';
import amcRoutes from '../../routes/amc.routes.js';
import rentalContractRoutes from '../../routes/rental-contract.routes.js';
import equipmentNoteRoutes from '../../routes/equipment-note.routes.js';

export function registerEquipmentRoutes(router: Router) {
  router.use('/tools', toolRoutes);
  router.use('/tool-issues', toolIssueRoutes);
  router.use('/generator-fuel', generatorFuelRoutes);
  router.use('/generator-maintenance', generatorMaintenanceRoutes);
  router.use('/vehicle-maintenance', vehicleMaintenanceRoutes);
  router.use('/assets', assetRoutes);
  router.use('/amc', amcRoutes);
  router.use('/rental-contracts', rentalContractRoutes);
  router.use('/equipment-notes', equipmentNoteRoutes);
}
