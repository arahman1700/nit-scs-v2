/**
 * MI (Material Issuance) Routes — V2 rename of MIRV
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../../../utils/document-factory.js';
import { miCreateSchema, miUpdateSchema, approvalActionSchema } from '../../../schemas/document.schema.js';
import { emitToAll } from '../../../socket/setup.js';
import * as miService from '../services/mi.service.js';
import type { MiCreateDto, MiUpdateDto } from '../../../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'site_engineer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mi',
  tableName: 'mirv',
  resource: 'mi',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'requestedById' },

  list: miService.list,
  getById: miService.getById,

  createSchema: miCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MiCreateDto;
    return miService.create(headerData, lines, userId);
  },

  updateSchema: miUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => miService.update(id, body as MiUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: (id, req) => {
        const io = req.app.get('io') as SocketIOServer | undefined;
        return miService.submit(id, req.user!.userId, io);
      },
      socketEvent: 'mi:submitted',
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
        const result = await miService.approve(id, action, req.user!.userId, comments, io);
        if (action === 'approve' && io) {
          emitToAll(io, 'inventory:reserved', { miId: id, warehouseId: result.warehouseId });
        }
        return result;
      },
      socketEvent: 'mi:approval',
      socketData: r => {
        const res = r as { action: string; status: string };
        return { status: res.status, action: res.action };
      },
    },
    {
      path: 'sign-qc',
      roles: ['admin', 'qc_officer'],
      handler: (id, req) => miService.signQc(id, req.user!.userId),
      socketEvent: 'mi:qc_signed',
      socketData: () => ({ status: 'approved', qcSigned: true }),
    },
    {
      path: 'issue',
      roles: ['admin', 'warehouse_supervisor', 'warehouse_staff'],
      handler: async (id, req) => {
        const result = await miService.issue(id, req.user!.userId);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.warehouseId, miId: id });
        return result;
      },
      socketEvent: 'mi:issued',
      socketData: r => {
        const res = r as { totalCost: number };
        return { status: 'issued', totalCost: res.totalCost };
      },
    },
    {
      path: 'cancel',
      roles: ['admin', 'manager'],
      handler: async (id, req) => {
        const result = await miService.cancel(id);
        if (result.wasReserved) {
          const io = req.app.get('io') as SocketIOServer | undefined;
          if (io) emitToAll(io, 'inventory:released', { miId: id, warehouseId: result.warehouseId });
        }
        return result.updated;
      },
      socketEvent: 'mi:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
