/**
 * MR (Material Request) Routes — V2 rename of MRF
 * Delegates to V1 mrf.service internally.
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { mrfCreateSchema, mrfUpdateSchema } from '../schemas/logistics.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as mrfService from '../services/mrf.service.js';
import type { MrCreateDto, MrUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'site_engineer', 'warehouse_supervisor'];
const APPROVE_ROLES = ['admin', 'manager', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mr',
  tableName: 'material_requisitions',
  scopeMapping: { projectField: 'projectId', createdByField: 'requestedById' },

  list: mrfService.list,
  getById: mrfService.getById,

  createSchema: mrfCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MrCreateDto;
    return mrfService.create(headerData, lines, userId);
  },

  updateSchema: mrfUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => mrfService.update(id, body as MrUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => mrfService.submit(id),
      socketEvent: 'mr:submitted',
      socketData: () => ({ status: 'submitted' }),
    },
    {
      path: 'review',
      roles: APPROVE_ROLES,
      handler: (id, req) => mrfService.review(id, req.user!.userId),
      socketEvent: 'mr:under_review',
      socketData: () => ({ status: 'under_review' }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: (id, req) => mrfService.approve(id, req.user!.userId),
      socketEvent: 'mr:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'check-stock',
      roles: APPROVE_ROLES,
      handler: id => mrfService.checkStock(id),
      socketEvent: 'mr:stock_checked',
      socketData: r => {
        const res = r as { stockResults: unknown };
        return { status: 'checking_stock', stockResults: res.stockResults };
      },
    },
    {
      path: 'convert-mi',
      roles: APPROVE_ROLES,
      handler: async (id, req) => {
        const { warehouseId } = req.body as { warehouseId?: string };
        const result = await mrfService.convertToMirv(id, req.user!.userId, warehouseId);
        if (result.mirv) {
          const io = req.app.get('io') as SocketIOServer | undefined;
          if (io) {
            emitToAll(io, 'mi:created', { id: result.mirv.id, miNumber: result.mirv.mirvNumber });
            emitToAll(io, 'entity:created', { entity: 'mi' });
          }
        }
        return result;
      },
      socketEvent: 'mr:mi_created',
      socketData: r => {
        const res = r as { status: string; mirv: { id: string; mirvNumber: string } | null };
        return { status: res.status, mi: res.mirv };
      },
    },
    {
      path: 'fulfill',
      roles: APPROVE_ROLES,
      handler: id => mrfService.fulfill(id),
      socketEvent: 'mr:fulfilled',
      socketData: () => ({ status: 'fulfilled' }),
    },
    {
      path: 'reject',
      roles: APPROVE_ROLES,
      handler: id => mrfService.reject(id),
      socketEvent: 'mr:rejected',
      socketData: () => ({ status: 'rejected' }),
    },
    {
      path: 'cancel',
      roles: ['admin', 'manager'],
      handler: id => mrfService.cancel(id),
      socketEvent: 'mr:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
