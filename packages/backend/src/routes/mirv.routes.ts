/**
 * @deprecated V1 route — use V2 equivalent at ./mi.routes.ts
 * Kept for backward compatibility during migration period.
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { mirvCreateSchema, mirvUpdateSchema, approvalActionSchema } from '../schemas/document.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as mirvService from '../services/mirv.service.js';
import type { MirvCreateDto, MirvUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'site_engineer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mirv',
  tableName: 'mirv',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'requestedById' },

  list: mirvService.list,
  getById: mirvService.getById,

  createSchema: mirvCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MirvCreateDto;
    return mirvService.create(headerData, lines, userId);
  },

  updateSchema: mirvUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => mirvService.update(id, body as MirvUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: (id, req) => {
        const io = req.app.get('io') as SocketIOServer | undefined;
        return mirvService.submit(id, req.user!.userId, io);
      },
      socketEvent: 'mirv:submitted',
      socketData: r => {
        const res = r as { approverRole: string; slaHours: number };
        return { status: 'pending_approval', approverRole: res.approverRole, slaHours: res.slaHours };
      },
    },
    {
      path: 'approve',
      roles: ['admin', 'manager', 'warehouse_supervisor'],
      bodySchema: approvalActionSchema,
      handler: async (id, req) => {
        const { action, comments } = req.body as { action: 'approve' | 'reject'; comments?: string };
        const io = req.app.get('io') as SocketIOServer | undefined;
        const result = await mirvService.approve(id, action, req.user!.userId, comments, io);
        if (action === 'approve' && io) {
          emitToAll(io, 'inventory:reserved', { mirvId: id, warehouseId: result.warehouseId });
        }
        return result;
      },
      socketEvent: 'mirv:approval',
      socketData: r => {
        const res = r as { action: string; status: string };
        return { status: res.status, action: res.action };
      },
    },
    {
      path: 'issue',
      roles: ['admin', 'warehouse_supervisor', 'warehouse_staff'],
      handler: async (id, req) => {
        const result = await mirvService.issue(id, req.user!.userId);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.warehouseId, mirvId: id });
        return result;
      },
      socketEvent: 'mirv:issued',
      socketData: r => {
        const res = r as { totalCost: number };
        return { status: 'issued', totalCost: res.totalCost };
      },
    },
    {
      path: 'cancel',
      roles: ['admin', 'manager'],
      handler: async (id, req) => {
        const result = await mirvService.cancel(id);
        if (result.wasReserved) {
          const io = req.app.get('io') as SocketIOServer | undefined;
          if (io) emitToAll(io, 'inventory:released', { mirvId: id, warehouseId: result.warehouseId });
        }
        return result.updated;
      },
      socketEvent: 'mirv:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
