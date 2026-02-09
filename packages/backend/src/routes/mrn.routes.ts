/**
 * MRN (Material Return Note) Routes — V2 rename of MRV
 * Delegates to V1 mrv.service internally.
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { mrnCreateSchema, mrnUpdateSchema } from '../schemas/document.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as mrvService from '../services/mrv.service.js';
import type { MrnCreateDto, MrnUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'site_engineer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mrn',
  tableName: 'mrv',
  scopeMapping: { warehouseField: 'toWarehouseId', projectField: 'projectId', createdByField: 'returnedById' },

  list: mrvService.list,
  getById: mrvService.getById,

  createSchema: mrnCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MrnCreateDto;
    return mrvService.create(headerData, lines, userId);
  },

  updateSchema: mrnUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => mrvService.update(id, body as MrnUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => mrvService.submit(id),
      socketEvent: 'mrn:submitted',
      socketData: () => ({ status: 'pending' }),
    },
    {
      path: 'receive',
      roles: ['admin', 'warehouse_supervisor'],
      handler: (id, req) => mrvService.receive(id, req.user!.userId),
      socketEvent: 'mrn:received',
      socketData: () => ({ status: 'received' }),
    },
    {
      path: 'complete',
      roles: ['admin', 'warehouse_supervisor'],
      handler: async (id, req) => {
        const result = await mrvService.complete(id, req.user!.userId);
        if (result.goodLinesRestocked > 0) {
          const io = req.app.get('io') as SocketIOServer | undefined;
          if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.toWarehouseId, mrnId: id });
        }
        return result;
      },
      socketEvent: 'mrn:completed',
      socketData: r => {
        const res = r as { goodLinesRestocked: number };
        return { status: 'completed', goodLinesRestocked: res.goodLinesRestocked };
      },
    },
  ],
});
