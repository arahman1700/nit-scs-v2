/**
 * Vehicle Maintenance Routes — M8
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import {
  vehicleMaintenanceCreateSchema,
  vehicleMaintenanceUpdateSchema,
  vehicleMaintenanceCompleteSchema,
} from '../schemas/document.schema.js';
import * as vmService from '../services/vehicle-maintenance.service.js';
import type {
  VehicleMaintenanceCreateDto,
  VehicleMaintenanceUpdateDto,
  VehicleMaintenanceCompleteDto,
} from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'transport_supervisor', 'logistics_coordinator'];
const ACTION_ROLES = ['admin', 'manager', 'transport_supervisor', 'logistics_coordinator'];

export default createDocumentRouter({
  docType: 'vehicle_maintenance',
  tableName: 'vehicle_maintenance',
  resource: 'vehicle_maintenance',
  scopeMapping: { createdByField: 'performedById' },

  list: vmService.list,
  getById: vmService.getById,

  createSchema: vehicleMaintenanceCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => vmService.create(body as VehicleMaintenanceCreateDto, userId),

  updateSchema: vehicleMaintenanceUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => vmService.update(id, body as VehicleMaintenanceUpdateDto),

  actions: [
    {
      path: 'complete',
      roles: ACTION_ROLES,
      bodySchema: vehicleMaintenanceCompleteSchema,
      handler: (id, req) => vmService.complete(id, req.user!.userId, req.body as VehicleMaintenanceCompleteDto),
      socketEvent: 'vehicle_maintenance:completed',
      socketData: () => ({ status: 'completed' }),
    },
    {
      path: 'cancel',
      roles: ACTION_ROLES,
      handler: (id, req) => vmService.cancel(id, req.user!.userId),
      socketEvent: 'vehicle_maintenance:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
