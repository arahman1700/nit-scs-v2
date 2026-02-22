/**
 * IMSF (Internal Material Shifting Form) Routes — V2
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { imsfCreateSchema, imsfUpdateSchema } from '../schemas/document.schema.js';
import * as imsfService from '../services/imsf.service.js';
import type { ImsfCreateDto, ImsfUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'warehouse_supervisor', 'logistics_coordinator'];
const APPROVE_ROLES = ['admin', 'warehouse_supervisor', 'logistics_coordinator'];

export default createDocumentRouter({
  docType: 'imsf',
  tableName: 'imsf',
  resource: 'imsf',
  scopeMapping: { projectField: 'senderProjectId', createdByField: 'createdById' },

  list: imsfService.list,
  getById: imsfService.getById,

  createSchema: imsfCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as ImsfCreateDto;
    return imsfService.create(headerData, lines, userId);
  },

  updateSchema: imsfUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => imsfService.update(id, body as ImsfUpdateDto),

  actions: [
    {
      path: 'send',
      roles: WRITE_ROLES,
      handler: id => imsfService.send(id),
      socketEvent: 'imsf:sent',
      socketData: () => ({ status: 'sent' }),
    },
    {
      path: 'confirm',
      roles: APPROVE_ROLES,
      handler: (id, req) => imsfService.confirm(id, req.user!.userId),
      socketEvent: 'imsf:confirmed',
      socketData: r => {
        const res = r as { imsf: unknown; wt: { id: string; transferNumber: string } };
        return { status: 'confirmed', wt: res.wt };
      },
    },
    {
      path: 'ship',
      roles: APPROVE_ROLES,
      handler: id => imsfService.ship(id),
      socketEvent: 'imsf:shipped',
      socketData: () => ({ status: 'in_transit' }),
    },
    {
      path: 'deliver',
      roles: APPROVE_ROLES,
      handler: id => imsfService.deliver(id),
      socketEvent: 'imsf:delivered',
      socketData: () => ({ status: 'delivered' }),
    },
    {
      path: 'complete',
      roles: APPROVE_ROLES,
      handler: id => imsfService.complete(id),
      socketEvent: 'imsf:completed',
      socketData: () => ({ status: 'completed' }),
    },
  ],
});
