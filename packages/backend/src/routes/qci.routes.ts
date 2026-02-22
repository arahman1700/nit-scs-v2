/**
 * QCI (Quality Control Inspection) Routes — V2 rename of RFIM
 * Delegates to V1 rfim.service internally.
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { qciUpdateSchema } from '../schemas/document.schema.js';
import { emitToDocument } from '../socket/setup.js';
import * as rfimService from '../services/rfim.service.js';
import type { QciUpdateDto } from '../types/dto.js';

const ROLES = ['admin', 'manager', 'qc_officer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'qci',
  tableName: 'rfim',
  // QCI scoping: list filtering is via mrrv.warehouseId (handled in service),
  // getById/action access check uses inspectorId as creator field
  scopeMapping: { warehouseField: 'warehouseId', createdByField: 'inspectorId' },

  list: rfimService.list,
  getById: rfimService.getById,

  // QCI is auto-created from GRN submit — no create route
  createRoles: ROLES,
  updateSchema: qciUpdateSchema,
  updateRoles: ROLES,
  update: (id, body) => rfimService.update(id, body as QciUpdateDto),

  actions: [
    {
      path: 'start',
      roles: ['admin', 'qc_officer'],
      handler: (id, req) => rfimService.start(id, req.user!.userId),
      socketEvent: 'qci:started',
      socketData: r => ({ status: 'in_progress', ...(r as Record<string, unknown>) }),
    },
    {
      path: 'complete',
      roles: ['admin', 'qc_officer'],
      handler: async (id, req) => {
        const { result, comments } = req.body as { result?: string; comments?: string };
        const svcResult = await rfimService.complete(id, result!, comments);
        const { updated, mrrvId } = svcResult;
        // Notify the linked GRN
        const io = req.app.get('io') as SocketIOServer | undefined;
        const effectiveStatus = (svcResult as { pmApprovalRequired?: boolean }).pmApprovalRequired
          ? 'completed_conditional'
          : 'completed';
        if (io) emitToDocument(io, mrrvId, 'qci:completed', { qciId: id, result, status: effectiveStatus });
        return updated;
      },
      socketEvent: 'qci:completed',
      socketData: r => ({ status: 'completed', ...(r as Record<string, unknown>) }),
    },
    {
      path: 'pm-approve',
      roles: ['admin', 'manager'],
      handler: async (id, req) => {
        const { comments } = req.body as { comments?: string };
        const { updated, mrrvId } = await rfimService.pmApprove(id, req.user!.userId, comments);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToDocument(io, mrrvId, 'qci:pm_approved', { qciId: id });
        return updated;
      },
      socketEvent: 'qci:pm_approved',
      socketData: r => ({ status: 'completed', ...(r as Record<string, unknown>) }),
    },
  ],
});
