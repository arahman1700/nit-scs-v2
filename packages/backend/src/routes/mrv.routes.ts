import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { mrvCreateSchema, mrvUpdateSchema } from '../schemas/document.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as mrvService from '../services/mrv.service.js';
import type { MrvCreateDto, MrvUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'site_engineer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mrv',
  tableName: 'mrv',
  scopeMapping: { warehouseField: 'toWarehouseId', projectField: 'projectId', createdByField: 'returnedById' },

  list: mrvService.list,
  getById: mrvService.getById,

  createSchema: mrvCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MrvCreateDto;
    return mrvService.create(headerData, lines, userId);
  },

  updateSchema: mrvUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => mrvService.update(id, body as MrvUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => mrvService.submit(id),
      socketEvent: 'mrv:submitted',
      socketData: () => ({ status: 'pending' }),
    },
    {
      path: 'receive',
      roles: ['admin', 'warehouse_supervisor'],
      handler: (id, req) => mrvService.receive(id, req.user!.userId),
      socketEvent: 'mrv:received',
      socketData: () => ({ status: 'received' }),
    },
    {
      path: 'complete',
      roles: ['admin', 'warehouse_supervisor'],
      handler: async (id, req) => {
        const result = await mrvService.complete(id, req.user!.userId);
        if (result.goodLinesRestocked > 0) {
          const io = req.app.get('io') as SocketIOServer | undefined;
          if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.toWarehouseId, mrvId: id });
        }
        return result;
      },
      socketEvent: 'mrv:completed',
      socketData: r => {
        const res = r as { goodLinesRestocked: number };
        return { status: 'completed', goodLinesRestocked: res.goodLinesRestocked };
      },
    },
  ],
});
