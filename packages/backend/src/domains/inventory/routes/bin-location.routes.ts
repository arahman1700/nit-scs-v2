/**
 * Bin Location Routes — V2
 * CRUD for physical storage positions within warehouse zones (rack/shelf/bin).
 */
import { createCrudRouter } from '../../../utils/crud-factory.js';
import { binLocationCreateSchema, binLocationUpdateSchema } from '../../../schemas/document.schema.js';

export default createCrudRouter({
  modelName: 'binLocation',
  tableName: 'bin_locations',
  resource: 'warehouse_zone',
  createSchema: binLocationCreateSchema,
  updateSchema: binLocationUpdateSchema,
  searchFields: ['locationCode', 'aisle', 'rack', 'shelf', 'bin'],
  includes: {
    zone: { select: { id: true, zoneName: true, zoneCode: true, warehouseId: true } },
  },
  allowedFilters: ['zoneId', 'locationType', 'isActive'],
  defaultSort: 'locationCode',
  softDelete: false,
});
