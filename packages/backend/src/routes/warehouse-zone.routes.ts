/**
 * Warehouse Zone Routes — V2
 * Simple CRUD using crud-factory — no state machine.
 */
import { createCrudRouter } from '../utils/crud-factory.js';
import { warehouseZoneCreateSchema, warehouseZoneUpdateSchema } from '../schemas/document.schema.js';

export default createCrudRouter({
  modelName: 'warehouseZone',
  tableName: 'warehouse_zones',
  resource: 'warehouse_zone',
  createSchema: warehouseZoneCreateSchema,
  updateSchema: warehouseZoneUpdateSchema,
  searchFields: ['zoneName', 'zoneCode'],
  includes: {
    warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  },
  detailIncludes: {
    warehouse: true,
  },
  allowedRoles: ['admin', 'warehouse_supervisor'],
  allowedFilters: ['warehouseId', 'zoneType'],
  defaultSort: 'createdAt',
  scopeMapping: { warehouseField: 'warehouseId' },
  softDelete: false,
});
