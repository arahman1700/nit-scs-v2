/**
 * Generator Fuel Log Routes — V2
 * Simple CRUD using crud-factory — log entries, no state machine.
 */
import { createCrudRouter } from '../utils/crud-factory.js';
import { generatorFuelLogCreateSchema } from '../schemas/document.schema.js';

export default createCrudRouter({
  modelName: 'generatorFuelLog',
  tableName: 'generator_fuel_logs',
  createSchema: generatorFuelLogCreateSchema,
  updateSchema: generatorFuelLogCreateSchema.partial(),
  searchFields: ['fuelSupplier'],
  includes: {
    generator: { select: { id: true, generatorCode: true, generatorName: true } },
    loggedBy: { select: { id: true, fullName: true } },
  },
  detailIncludes: {
    generator: true,
    loggedBy: { select: { id: true, fullName: true, email: true } },
  },
  allowedRoles: ['admin', 'logistics_coordinator', 'transport_supervisor'],
  allowedFilters: ['generatorId'],
  defaultSort: 'createdAt',
  softDelete: false,
});
