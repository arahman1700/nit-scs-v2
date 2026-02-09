import { createDocumentRouter } from '../utils/document-factory.js';
import { osdCreateSchema, osdUpdateSchema } from '../schemas/document.schema.js';
import * as osdService from '../services/osd.service.js';
import type { OsdCreateDto, OsdUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'qc_officer'];
const RESOLVE_ROLES = ['admin', 'warehouse_supervisor', 'qc_officer'];

export default createDocumentRouter({
  docType: 'osd',
  tableName: 'osd_reports',
  scopeMapping: { warehouseField: 'warehouseId' },

  list: osdService.list,
  getById: osdService.getById,

  createSchema: osdCreateSchema,
  createRoles: WRITE_ROLES,
  create: body => {
    const { lines, ...headerData } = body as OsdCreateDto;
    return osdService.create(headerData, lines);
  },

  updateSchema: osdUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => osdService.update(id, body as OsdUpdateDto),

  actions: [
    {
      path: 'send-claim',
      roles: RESOLVE_ROLES,
      handler: (id, req) => {
        const { claimReference } = req.body as { claimReference?: string };
        return osdService.sendClaim(id, claimReference);
      },
      socketEvent: 'osd:claim_sent',
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
      socketEvent: 'osd:resolved',
      socketData: () => ({ status: 'resolved' }),
    },
  ],
});
