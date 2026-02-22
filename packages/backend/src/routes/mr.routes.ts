/**
 * MR (Material Request) Routes — V2 rename of MRF
 * Now delegates to V2 mr.service with EventBus events & assertTransition.
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { mrfCreateSchema, mrfUpdateSchema } from '../schemas/logistics.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as mrService from '../services/mr.service.js';
import type { MrCreateDto, MrUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'site_engineer', 'warehouse_supervisor'];
const APPROVE_ROLES = ['admin', 'manager', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'mr',
  tableName: 'material_requisitions',
  resource: 'mr',
  scopeMapping: { projectField: 'projectId', createdByField: 'requestedById' },

  list: mrService.list,
  getById: mrService.getById,

  createSchema: mrfCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as MrCreateDto;
    return mrService.create(headerData, lines, userId);
  },

  updateSchema: mrfUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => mrService.update(id, body as MrUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => mrService.submit(id),
      socketEvent: 'mr:submitted',
      socketData: () => ({ status: 'submitted' }),
    },
    {
      path: 'review',
      roles: APPROVE_ROLES,
      handler: (id, req) => mrService.review(id, req.user!.userId),
      socketEvent: 'mr:under_review',
      socketData: () => ({ status: 'under_review' }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: (id, req) => mrService.approve(id, req.user!.userId),
      socketEvent: 'mr:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'check-stock',
      roles: APPROVE_ROLES,
      handler: id => mrService.checkStock(id),
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
        const result = await mrService.convertToMirv(id, req.user!.userId, warehouseId);
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
      path: 'convert-to-imsf',
      roles: APPROVE_ROLES,
      handler: async (id, req) => {
        const { receiverProjectId } = req.body as { receiverProjectId: string };
        const result = await mrService.convertToImsf(id, req.user!.userId, receiverProjectId);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) {
          emitToAll(io, 'imsf:created', { id: result.id, imsfNumber: result.imsfNumber });
          emitToAll(io, 'entity:created', { entity: 'imsf' });
        }
        return result;
      },
      socketEvent: 'mr:imsf_created',
      socketData: r => {
        const res = r as { id: string; imsfNumber: string };
        return { status: 'not_available_locally', imsf: { id: res.id, imsfNumber: res.imsfNumber } };
      },
    },
    {
      path: 'convert-to-jo',
      roles: APPROVE_ROLES,
      handler: async (id, req) => {
        const { joType } = req.body as { joType?: string };
        const result = await mrService.convertToJo(id, req.user!.userId, joType);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) {
          emitToAll(io, 'jo:created', { id: result.jo.id, joNumber: result.jo.joNumber });
          emitToAll(io, 'entity:created', { entity: 'jo' });
        }
        return result;
      },
      socketEvent: 'mr:jo_created',
      socketData: r => {
        const res = r as { id: string; jo: { id: string; joNumber: string; joType: string } };
        return { jo: res.jo };
      },
    },
    {
      path: 'fulfill',
      roles: APPROVE_ROLES,
      handler: id => mrService.fulfill(id),
      socketEvent: 'mr:fulfilled',
      socketData: () => ({ status: 'fulfilled' }),
    },
    {
      path: 'reject',
      roles: APPROVE_ROLES,
      handler: id => mrService.reject(id),
      socketEvent: 'mr:rejected',
      socketData: () => ({ status: 'rejected' }),
    },
    {
      path: 'cancel',
      roles: ['admin', 'manager'],
      handler: id => mrService.cancel(id),
      socketEvent: 'mr:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
