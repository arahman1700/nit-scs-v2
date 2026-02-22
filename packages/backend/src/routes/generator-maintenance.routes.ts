/**
 * Generator Maintenance Routes — V2
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { generatorMaintenanceCreateSchema, generatorMaintenanceUpdateSchema } from '../schemas/document.schema.js';
import * as genMaintService from '../services/generator-maintenance.service.js';
import type { GeneratorMaintenanceCreateDto, GeneratorMaintenanceUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'logistics_coordinator', 'transport_supervisor'];
const APPROVE_ROLES = ['admin', 'logistics_coordinator', 'transport_supervisor'];

export default createDocumentRouter({
  docType: 'generator_maintenance',
  tableName: 'generator_maintenance',
  resource: 'generator_maintenance',
  scopeMapping: { createdByField: 'performedById' },

  list: genMaintService.list,
  getById: genMaintService.getById,

  createSchema: generatorMaintenanceCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => genMaintService.create(body as GeneratorMaintenanceCreateDto, userId),

  updateSchema: generatorMaintenanceUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => genMaintService.update(id, body as GeneratorMaintenanceUpdateDto),

  actions: [
    {
      path: 'start',
      roles: WRITE_ROLES,
      handler: (id, req) => genMaintService.startProgress(id, req.user!.userId),
      socketEvent: 'generator_maintenance:started',
      socketData: () => ({ status: 'in_progress' }),
    },
    {
      path: 'complete',
      roles: APPROVE_ROLES,
      handler: (id, req) => genMaintService.complete(id, req.user!.userId),
      socketEvent: 'generator_maintenance:completed',
      socketData: () => ({ status: 'completed' }),
    },
    {
      path: 'mark-overdue',
      roles: APPROVE_ROLES,
      handler: id => genMaintService.markOverdue(id),
      socketEvent: 'generator_maintenance:overdue',
      socketData: () => ({ status: 'overdue' }),
    },
  ],
});
