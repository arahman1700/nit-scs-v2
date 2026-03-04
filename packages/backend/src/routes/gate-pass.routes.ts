import { createDocumentRouter } from '../utils/document-factory.js';
import { gatePassCreateSchema, gatePassUpdateSchema } from '../schemas/logistics.schema.js';
import * as gatePassService from '../services/gate-pass.service.js';
import type { GatePassCreateDto, GatePassUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff', 'gate_officer'];
const APPROVE_ROLES = ['admin', 'warehouse_supervisor'];
const GATE_ROLES = ['admin', 'warehouse_supervisor', 'gate_officer'];

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
      path: 'verify-outbound',
      roles: GATE_ROLES,
      handler: (id, req) => {
        const body = req.body as {
          securityOfficer?: string;
          verificationNotes?: string;
          itemChecks?: Array<{ itemId: string; verifiedQty: number }>;
        };
        return gatePassService.verifyOutbound(id, body, req.user?.userId);
      },
      socketEvent: 'gatepass:released',
      socketData: () => ({ status: 'released' }),
    },
    {
      path: 'release',
      roles: GATE_ROLES,
      handler: (id, req) => {
        const { securityOfficer } = req.body as { securityOfficer?: string };
        return gatePassService.release(id, securityOfficer);
      },
      socketEvent: 'gatepass:released',
      socketData: () => ({ status: 'released' }),
    },
    {
      path: 'verify-inbound',
      roles: GATE_ROLES,
      handler: (id, req) => {
        const body = req.body as {
          securityOfficer?: string;
          verificationNotes?: string;
          itemChecks?: Array<{ itemId: string; verifiedQty: number }>;
        };
        return gatePassService.verifyInbound(id, body, req.user?.userId);
      },
      socketEvent: 'gatepass:returned',
      socketData: () => ({ status: 'returned' }),
    },
    {
      path: 'return',
      roles: GATE_ROLES,
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
