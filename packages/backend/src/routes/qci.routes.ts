/**
 * QCI (Quality Control Inspection) Routes — V2 rename of RFIM
 * Now delegates to V2 qci.service which has EventBus events, transactions,
 * conditional completion flow, and auto-advance GRN/auto-create DR.
 */
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { qciUpdateSchema } from '../schemas/document.schema.js';
import { emitToDocument } from '../socket/setup.js';
import * as qciService from '../services/qci.service.js';
import type { QciUpdateDto } from '../types/dto.js';

const ROLES = ['admin', 'manager', 'qc_officer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'qci',
  tableName: 'rfim',
  resource: 'qci',
  scopeMapping: { warehouseField: 'warehouseId', createdByField: 'inspectorId' },

  list: qciService.list,
  getById: qciService.getById,

  // QCI is auto-created from GRN submit — no create route
  createRoles: ROLES,
  updateSchema: qciUpdateSchema,
  updateRoles: ROLES,
  update: (id, body) => qciService.update(id, body as QciUpdateDto),

  actions: [
    {
      path: 'start',
      roles: ['admin', 'qc_officer'],
      handler: (id, req) => qciService.start(id, req.user!.userId),
      socketEvent: 'qci:started',
      socketData: r => ({ status: 'in_progress', ...(r as Record<string, unknown>) }),
    },
    {
      path: 'complete',
      roles: ['admin', 'qc_officer'],
      handler: async (id, req) => {
        const { result, comments } = req.body as { result?: string; comments?: string };
        const svcResult = await qciService.complete(id, result!, comments);
        const { updated, mrrvId } = svcResult;
        // Notify the linked GRN
        const io = req.app.get('io') as SocketIOServer | undefined;
        const effectiveStatus = (svcResult as { pmApprovalRequired?: boolean }).pmApprovalRequired
          ? 'completed_conditional'
          : 'completed';
        if (io && mrrvId) emitToDocument(io, mrrvId, 'qci:completed', { qciId: id, result, status: effectiveStatus });
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
        const svcResult = await qciService.pmApprove(id, req.user!.userId, comments);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io && svcResult.mrrvId) emitToDocument(io, svcResult.mrrvId, 'qci:pm_approved', { qciId: id });
        return svcResult.updated;
      },
      socketEvent: 'qci:pm_approved',
      socketData: r => ({ status: 'completed', ...(r as Record<string, unknown>) }),
    },
  ],
});
