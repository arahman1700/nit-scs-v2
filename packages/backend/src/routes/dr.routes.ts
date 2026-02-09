/**
 * DR (Discrepancy Report) Routes — V2 rename of OSD
 * Delegates to V1 osd.service internally.
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { drCreateSchema, drUpdateSchema } from '../schemas/document.schema.js';
import * as osdService from '../services/osd.service.js';
import type { DrCreateDto, DrUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'qc_officer'];
const RESOLVE_ROLES = ['admin', 'warehouse_supervisor', 'qc_officer'];

export default createDocumentRouter({
  docType: 'dr',
  tableName: 'osd_reports',
  scopeMapping: { warehouseField: 'warehouseId' },

  list: osdService.list,
  getById: osdService.getById,

  createSchema: drCreateSchema,
  createRoles: WRITE_ROLES,
  create: body => {
    const { lines, ...headerData } = body as DrCreateDto;
    return osdService.create(headerData, lines);
  },

  updateSchema: drUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => osdService.update(id, body as DrUpdateDto),

  actions: [
    {
      path: 'send-claim',
      roles: RESOLVE_ROLES,
      handler: (id, req) => {
        const { claimReference } = req.body as { claimReference?: string };
        return osdService.sendClaim(id, claimReference);
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
        return osdService.resolve(id, req.user!.userId, { resolutionType, resolutionAmount, supplierResponse });
      },
      socketEvent: 'dr:resolved',
      socketData: () => ({ status: 'resolved' }),
    },
  ],
});
