/**
 * DR (Discrepancy Report) Routes — V2 rename of OSD
 * Now delegates to V2 dr.service with assertTransition & EventBus events.
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { drCreateSchema, drUpdateSchema } from '../schemas/document.schema.js';
import * as drService from '../services/dr.service.js';
import type { DrCreateDto, DrUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'qc_officer'];
const RESOLVE_ROLES = ['admin', 'warehouse_supervisor', 'qc_officer'];

export default createDocumentRouter({
  docType: 'dr',
  tableName: 'osd_reports',
  resource: 'dr',
  scopeMapping: { warehouseField: 'warehouseId' },

  list: drService.list,
  getById: drService.getById,

  createSchema: drCreateSchema,
  createRoles: WRITE_ROLES,
  create: body => {
    const { lines, ...headerData } = body as DrCreateDto;
    return drService.create(headerData, lines);
  },

  updateSchema: drUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => drService.update(id, body as DrUpdateDto),

  actions: [
    {
      path: 'send-claim',
      roles: RESOLVE_ROLES,
      handler: (id, req) => {
        const { claimReference } = req.body as { claimReference?: string };
        return drService.sendClaim(id, claimReference);
      },
      socketEvent: 'dr:claim_sent',
      socketData: () => ({ status: 'claim_sent' }),
    },
    {
      path: 'resolve',
      roles: RESOLVE_ROLES,
      handler: (id, req) => {
        const { resolutionType, resolutionAmount, supplierResponse } = req.body as {
          resolutionType?: string;
          resolutionAmount?: number;
          supplierResponse?: string;
        };
        return drService.resolve(id, req.user!.userId, { resolutionType, resolutionAmount, supplierResponse });
      },
      socketEvent: 'dr:resolved',
      socketData: () => ({ status: 'resolved' }),
    },
  ],
});
