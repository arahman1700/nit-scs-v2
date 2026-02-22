import { createDocumentRouter } from '../utils/document-factory.js';
import { gatePassCreateSchema, gatePassUpdateSchema } from '../schemas/logistics.schema.js';
import * as gatePassService from '../services/gate-pass.service.js';
import type { GatePassCreateDto, GatePassUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff'];
const APPROVE_ROLES = ['admin', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'gate-passes',
  tableName: 'gate_passes',
  resource: 'gatepass',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'issuedById' },

  list: gatePassService.list,
  getById: gatePassService.getById,

  createSchema: gatePassCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { items, ...headerData } = body as GatePassCreateDto;
    return gatePassService.create(headerData, items, userId);
  },

  updateSchema: gatePassUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => gatePassService.update(id, body as GatePassUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => gatePassService.submit(id),
      socketEvent: 'gatepass:submitted',
      socketData: () => ({ status: 'pending' }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: id => gatePassService.approve(id),
      socketEvent: 'gatepass:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'release',
      roles: WRITE_ROLES,
      handler: (id, req) => {
        const { securityOfficer } = req.body as { securityOfficer?: string };
        return gatePassService.release(id, securityOfficer);
      },
      socketEvent: 'gatepass:released',
      socketData: () => ({ status: 'released' }),
    },
    {
      path: 'return',
      roles: WRITE_ROLES,
      handler: id => gatePassService.returnPass(id),
      socketEvent: 'gatepass:returned',
      socketData: () => ({ status: 'returned' }),
    },
    {
      path: 'cancel',
      roles: APPROVE_ROLES,
      handler: id => gatePassService.cancel(id),
      socketEvent: 'gatepass:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
