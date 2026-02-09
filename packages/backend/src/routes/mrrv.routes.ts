import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { mrrvCreateSchema, mrrvUpdateSchema } from '../schemas/document.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as mrrvService from '../services/mrrv.service.js';
import type { MrrvCreateDto, MrrvUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'warehouse_staff'];
const APPROVE_ROLES = ['admin', 'manager', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mrrv',
  tableName: 'mrrv',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'receivedById' },

  list: mrrvService.list,
  getById: mrrvService.getById,

  createSchema: mrrvCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MrrvCreateDto;
    return mrrvService.create(headerData, lines, userId);
  },

  updateSchema: mrrvUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => mrrvService.update(id, body as MrrvUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: APPROVE_ROLES,
      handler: id => mrrvService.submit(id),
      socketEvent: 'mrrv:submitted',
      socketData: r => {
        const res = r as { rfimRequired: boolean };
        return { status: 'pending_qc', rfimCreated: res.rfimRequired };
      },
    },
    {
      path: 'approve-qc',
      roles: APPROVE_ROLES,
      handler: (id, req) => mrrvService.approveQc(id, req.user!.userId),
      socketEvent: 'mrrv:qc_approved',
      socketData: () => ({ status: 'qc_approved' }),
    },
    {
      path: 'receive',
      roles: APPROVE_ROLES,
      handler: id => mrrvService.receive(id),
      socketEvent: 'mrrv:received',
      socketData: () => ({ status: 'received' }),
    },
    {
      path: 'store',
      roles: APPROVE_ROLES,
      handler: async (id, req) => {
        const result = await mrrvService.store(id, req.user!.userId);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.warehouseId, mrrvId: id });
        return result;
      },
      socketEvent: 'mrrv:stored',
      socketData: () => ({ status: 'stored' }),
    },
  ],
});
