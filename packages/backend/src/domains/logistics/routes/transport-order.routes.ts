import { createDocumentRouter } from '../../../utils/document-factory.js';
import { transportOrderCreateSchema, transportOrderUpdateSchema } from '../schemas/logistics.schema.js';
import * as transportOrderService from '../services/transport-order.service.js';
import type { TransportOrderCreateInput, TransportOrderUpdateInput } from '../services/transport-order.service.js';

const WRITE_ROLES = ['admin', 'manager', 'logistics_coordinator', 'transport_supervisor', 'warehouse_supervisor'];
const APPROVE_ROLES = ['admin', 'manager', 'logistics_coordinator', 'transport_supervisor'];

export default createDocumentRouter({
  docType: 'transport-orders',
  tableName: 'transport_orders',
  resource: 'transport_order',
  scopeMapping: { warehouseField: 'originWarehouseId', projectField: 'projectId', createdByField: 'requestedById' },

  list: transportOrderService.list,
  getById: transportOrderService.getById,

  createSchema: transportOrderCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    // Body is Zod-validated upstream by createSchema; cast to specific input type
    return transportOrderService.create(body as unknown as TransportOrderCreateInput, userId);
  },

  updateSchema: transportOrderUpdateSchema,
  updateRoles: WRITE_ROLES,
  // Body is Zod-validated upstream by updateSchema; cast to specific input type
  update: (id, body) => transportOrderService.update(id, body as unknown as TransportOrderUpdateInput),

  actions: [
    {
      path: 'schedule',
      roles: WRITE_ROLES,
      handler: id => transportOrderService.schedule(id),
      socketEvent: 'transport-order:scheduled',
      socketData: () => ({ status: 'scheduled' }),
    },
    {
      path: 'dispatch',
      roles: APPROVE_ROLES,
      handler: id => transportOrderService.dispatch(id),
      socketEvent: 'transport-order:dispatched',
      socketData: () => ({ status: 'in_transit' }),
    },
    {
      path: 'deliver',
      roles: APPROVE_ROLES,
      handler: id => transportOrderService.deliver(id),
      socketEvent: 'transport-order:delivered',
      socketData: () => ({ status: 'delivered' }),
    },
    {
      path: 'cancel',
      roles: APPROVE_ROLES,
      handler: id => transportOrderService.cancel(id),
      socketEvent: 'transport-order:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});
