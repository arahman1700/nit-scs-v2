/**
 * GRN (Goods Receipt Note) Routes — V2 rename of MRRV
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { grnCreateSchema, grnUpdateSchema } from '../schemas/document.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as grnService from '../services/grn.service.js';
import type { GrnCreateDto, GrnUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'warehouse_staff'];
const APPROVE_ROLES = ['admin', 'manager', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'grn',
  tableName: 'mrrv',
  resource: 'grn',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'receivedById' },

  list: grnService.list,
  getById: grnService.getById,

  createSchema: grnCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as GrnCreateDto;
    return grnService.create(headerData, lines, userId);
  },

  updateSchema: grnUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => grnService.update(id, body as GrnUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: APPROVE_ROLES,
      handler: id => grnService.submit(id),
      socketEvent: 'grn:submitted',
      socketData: r => {
        const res = r as { qciRequired: boolean };
        return { status: 'pending_qc', qciCreated: res.qciRequired };
      },
    },
    {
      path: 'approve-qc',
      roles: APPROVE_ROLES,
      handler: (id, req) => grnService.approveQc(id, req.user!.userId),
      socketEvent: 'grn:qc_approved',
      socketData: () => ({ status: 'qc_approved' }),
    },
    {
      path: 'receive',
      roles: APPROVE_ROLES,
      handler: id => grnService.receive(id),
      socketEvent: 'grn:received',
      socketData: () => ({ status: 'received' }),
    },
    {
      path: 'store',
      roles: APPROVE_ROLES,
      handler: async (id, req) => {
        const result = await grnService.store(id, req.user!.userId);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.warehouseId, grnId: id });
        return result;
      },
      socketEvent: 'grn:stored',
      socketData: () => ({ status: 'stored' }),
    },
  ],
});
