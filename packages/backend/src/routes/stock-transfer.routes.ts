import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { stockTransferCreateSchema, stockTransferUpdateSchema } from '../schemas/logistics.schema.js';
import { emitToAll } from '../socket/setup.js';
import * as stService from '../services/stock-transfer.service.js';
import type { StockTransferCreateDto, StockTransferUpdateDto } from '../types/dto.js';

const ROLES = ['admin', 'manager', 'warehouse_supervisor'];

export default createDocumentRouter({
  docType: 'stock-transfers',
  tableName: 'stock_transfers',
  // StockTransfer uses fromWarehouseId/toWarehouseId — the service handles OR logic
  scopeMapping: { warehouseField: 'fromWarehouseId', createdByField: 'requestedById' },

  list: stService.list,
  getById: stService.getById,

  createSchema: stockTransferCreateSchema,
  createRoles: ROLES,
  create: (body, userId) => {
    const { lines, ...headerData } = body as StockTransferCreateDto;
    return stService.create(headerData, lines, userId);
  },

  updateSchema: stockTransferUpdateSchema,
  updateRoles: ROLES,
  update: (id, body) => stService.update(id, body as StockTransferUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: ROLES,
      handler: id => stService.submit(id),
      socketEvent: 'stock_transfer:submitted',
      socketData: () => ({ status: 'pending' }),
    },
    {
      path: 'approve',
      roles: ROLES,
      handler: id => stService.approve(id),
      socketEvent: 'stock_transfer:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'ship',
      roles: ROLES,
      handler: async (id, req) => {
        const result = await stService.ship(id);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.fromWarehouseId, transferId: id });
        return result.updated;
      },
      socketEvent: 'stock_transfer:shipped',
      socketData: () => ({ status: 'shipped' }),
    },
    {
      path: 'receive',
      roles: ROLES,
      handler: async (id, req) => {
        const result = await stService.receive(id, req.user!.userId);
        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitToAll(io, 'inventory:updated', { warehouseId: result.toWarehouseId, transferId: id });
        return result.updated;
      },
      socketEvent: 'stock_transfer:received',
      socketData: () => ({ status: 'received' }),
    },
    {
      path: 'complete',
      roles: ROLES,
      handler: id => stService.complete(id),
      socketEvent: 'stock_transfer:completed',
      socketData: () => ({ status: 'completed' }),
    },
    {
      path: 'cancel',
      roles: ROLES,
      handler: id => stService.cancel(id),
      socketEvent: 'stock_transfer:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
