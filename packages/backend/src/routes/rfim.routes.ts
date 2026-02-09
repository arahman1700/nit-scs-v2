import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { rfimUpdateSchema } from '../schemas/document.schema.js';
import { emitToDocument } from '../socket/setup.js';
import * as rfimService from '../services/rfim.service.js';
import type { RfimUpdateDto } from '../types/dto.js';

const ROLES = ['admin', 'manager', 'qc_officer', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'rfim',
  tableName: 'rfim',
  // RFIM scoping: list filtering is via mrrv.warehouseId (handled in service),
  // getById/action access check uses inspectorId as creator field
  scopeMapping: { warehouseField: 'warehouseId', createdByField: 'inspectorId' },

  list: rfimService.list,
  getById: rfimService.getById,

  // RFIM is auto-created from MRRV submit — no create route
  createRoles: ROLES,
  updateSchema: rfimUpdateSchema,
  updateRoles: ROLES,
  update: (id, body) => rfimService.update(id, body as RfimUpdateDto),

  actions: [
    {
      path: 'start',
      roles: ['admin', 'qc_officer'],
      handler: (id, req) => rfimService.start(id, req.user!.userId),
      socketEvent: 'rfim:started',
      socketData: r => ({ status: 'in_progress', ...(r as Record<string, unknown>) }),
    },
    {
      path: 'complete',
      roles: ['admin', 'qc_officer'],
      handler: async (id, req) => {
        const { result, comments } = req.body as { result?: string; comments?: string };
        const { updated, mrrvId } = await rfimService.complete(id, result!, comments);
        // Notify the linked MRRV
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToDocument(io, mrrvId, 'rfim:completed', { rfimId: id, result });
        return updated;
      },
      socketEvent: 'rfim:completed',
      socketData: r => ({ status: 'completed', ...(r as Record<string, unknown>) }),
    },
  ],
});
