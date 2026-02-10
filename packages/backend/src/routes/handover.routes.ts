/**
 * Storekeeper Handover Routes — V2
 * Simple CRUD using crud-factory with status transitions.
 */
import { createCrudRouter } from '../utils/crud-factory.js';
import { handoverCreateSchema, handoverUpdateSchema } from '../schemas/document.schema.js';

export default createCrudRouter({
  modelName: 'storekeeperHandover',
  tableName: 'storekeeper_handovers',
  createSchema: handoverCreateSchema,
  updateSchema: handoverUpdateSchema,
  searchFields: [],
  includes: {
    warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
    outgoingEmployee: { select: { id: true, fullName: true } },
    incomingEmployee: { select: { id: true, fullName: true } },
  },
  detailIncludes: {
    warehouse: true,
    outgoingEmployee: { select: { id: true, fullName: true, email: true } },
    incomingEmployee: { select: { id: true, fullName: true, email: true } },
  },
  allowedRoles: ['admin', 'warehouse_supervisor'],
  allowedFilters: ['warehouseId', 'status'],
  defaultSort: 'createdAt',
  scopeMapping: { warehouseField: 'warehouseId' },
  softDelete: false,
});
