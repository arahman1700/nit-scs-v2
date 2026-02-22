/**
 * Tool Registry Routes — V2
 * Simple CRUD using crud-factory — no state machine.
 */
import { createCrudRouter } from '../utils/crud-factory.js';
import { toolCreateSchema, toolUpdateSchema } from '../schemas/document.schema.js';

export default createCrudRouter({
  modelName: 'tool',
  tableName: 'tools',
  resource: 'tool',
  createSchema: toolCreateSchema,
  updateSchema: toolUpdateSchema,
  searchFields: ['toolCode', 'toolName', 'serialNumber'],
  includes: {
    warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
    owner: { select: { id: true, fullName: true } },
  },
  detailIncludes: {
    warehouse: true,
    owner: { select: { id: true, fullName: true, email: true } },
    toolIssues: {
      orderBy: { issuedDate: 'desc' as const },
      take: 10,
      include: {
        issuedTo: { select: { id: true, fullName: true } },
      },
    },
  },
  allowedRoles: ['admin', 'warehouse_supervisor', 'warehouse_staff'],
  allowedFilters: ['condition', 'warehouseId', 'category'],
  defaultSort: 'createdAt',
  softDelete: false,
});
