/**
 * Scrap Item Routes — V2
 */
import { createDocumentRouter } from '../utils/document-factory.js';
import { scrapCreateSchema, scrapUpdateSchema } from '../schemas/document.schema.js';
import * as scrapService from '../services/scrap.service.js';
import type { ScrapCreateDto, ScrapUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor'];
const APPROVE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'scrap_committee_member'];

export default createDocumentRouter({
  docType: 'scrap',
  tableName: 'scrap_items',
  resource: 'scrap',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'createdById' },

  list: scrapService.list,
  getById: scrapService.getById,

  createSchema: scrapCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => scrapService.create(body as ScrapCreateDto, userId),

  updateSchema: scrapUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => scrapService.update(id, body as ScrapUpdateDto),

  actions: [
    {
      path: 'report',
      roles: WRITE_ROLES,
      handler: id => scrapService.report(id),
      socketEvent: 'scrap:reported',
      socketData: () => ({ status: 'reported' }),
    },
    {
      path: 'approve-site-manager',
      roles: APPROVE_ROLES,
      handler: (id, req) => scrapService.approveBySiteManager(id, req.user!.userId),
      socketEvent: 'scrap:site_manager_approved',
      socketData: () => ({ siteManagerApproval: true }),
    },
    {
      path: 'approve-qc',
      roles: APPROVE_ROLES,
      handler: (id, req) => scrapService.approveByQc(id, req.user!.userId),
      socketEvent: 'scrap:qc_approved',
      socketData: () => ({ qcApproval: true }),
    },
    {
      path: 'approve-storekeeper',
      roles: APPROVE_ROLES,
      handler: (id, req) => scrapService.approveByStorekeeper(id, req.user!.userId),
      socketEvent: 'scrap:storekeeper_approved',
      socketData: () => ({ storekeeperApproval: true }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: id => scrapService.approve(id),
      socketEvent: 'scrap:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'send-to-ssc',
      roles: APPROVE_ROLES,
      handler: id => scrapService.sendToSsc(id),
      socketEvent: 'scrap:in_ssc',
      socketData: () => ({ status: 'in_ssc' }),
    },
    {
      path: 'mark-sold',
      roles: ['admin', 'scrap_committee_member'],
      handler: (id, req) => {
        const { buyerName } = req.body as { buyerName: string };
        return scrapService.markSold(id, buyerName ?? 'Unknown');
      },
      socketEvent: 'scrap:sold',
      socketData: () => ({ status: 'sold' }),
    },
    {
      path: 'dispose',
      roles: APPROVE_ROLES,
      handler: id => scrapService.dispose(id),
      socketEvent: 'scrap:disposed',
      socketData: () => ({ status: 'disposed' }),
    },
    {
      path: 'close',
      roles: APPROVE_ROLES,
      handler: id => scrapService.close(id),
      socketEvent: 'scrap:closed',
      socketData: () => ({ status: 'closed' }),
    },
  ],
});
