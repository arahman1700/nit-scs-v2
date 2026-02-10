/**
 * Surplus Item Routes — V2
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { surplusCreateSchema, surplusUpdateSchema } from '../schemas/document.schema.js';
import * as surplusService from '../services/surplus.service.js';
import type { SurplusCreateDto, SurplusUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor'];
const APPROVE_ROLES = ['admin', 'manager'];

export default createDocumentRouter({
  docType: 'surplus',
  tableName: 'surplus_items',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'createdById' },

  list: surplusService.list,
  getById: surplusService.getById,

  createSchema: surplusCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => surplusService.create(body as SurplusCreateDto, userId),

  updateSchema: surplusUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => surplusService.update(id, body as SurplusUpdateDto),

  actions: [
    {
      path: 'evaluate',
      roles: WRITE_ROLES,
      handler: id => surplusService.evaluate(id),
      socketEvent: 'surplus:evaluated',
      socketData: () => ({ status: 'evaluated' }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: id => surplusService.approve(id),
      socketEvent: 'surplus:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'action',
      roles: APPROVE_ROLES,
      handler: (id, req) => surplusService.action(id, req.user!.userId),
      socketEvent: 'surplus:actioned',
      socketData: () => ({ status: 'actioned' }),
    },
    {
      path: 'scm-approve',
      roles: APPROVE_ROLES,
      handler: (id, req) => surplusService.scmApprove(id, req.user!.userId),
      socketEvent: 'surplus:scm_approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'close',
      roles: APPROVE_ROLES,
      handler: id => surplusService.close(id),
      socketEvent: 'surplus:closed',
      socketData: () => ({ status: 'closed' }),
    },
  ],
});
