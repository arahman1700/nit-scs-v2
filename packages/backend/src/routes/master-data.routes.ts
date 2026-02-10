import { Router } from 'express';
import { createCrudRouter } from '../utils/crud-factory.js';
import { conditionalCache } from '../middleware/cache-headers.js';
import * as s from '../schemas/master-data.schema.js';

const router = Router();

// ETag / conditional caching for master data GET requests (5 min max-age)
router.use(conditionalCache(300));

// Master data write ops restricted to admin + manager
const MASTER_DATA_ROLES = ['admin', 'manager'];

// ── Lookup Tables ────────────────────────────────────────────────────────

router.use(
  '/regions',
  createCrudRouter({
    modelName: 'region',
    tableName: 'regions',
    createSchema: s.regionSchema,
    updateSchema: s.regionSchema.partial(),
    searchFields: ['regionName', 'regionNameAr'],
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/cities',
  createCrudRouter({
    modelName: 'city',
    tableName: 'cities',
    createSchema: s.citySchema,
    updateSchema: s.citySchema.partial(),
    searchFields: ['cityName', 'cityNameAr'],
    includes: { region: true },
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/ports',
  createCrudRouter({
    modelName: 'port',
    tableName: 'ports',
    createSchema: s.portSchema,
    updateSchema: s.portSchema.partial(),
    searchFields: ['portName', 'portCode'],
    includes: { city: true },
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/uoms',
  createCrudRouter({
    modelName: 'unitOfMeasure',
    tableName: 'units_of_measure',
    createSchema: s.uomSchema,
    updateSchema: s.uomSchema.partial(),
    searchFields: ['uomCode', 'uomName'],
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/warehouse-types',
  createCrudRouter({
    modelName: 'warehouseType',
    tableName: 'warehouse_types',
    createSchema: s.warehouseTypeSchema,
    updateSchema: s.warehouseTypeSchema.partial(),
    searchFields: ['typeName'],
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/equipment-categories',
  createCrudRouter({
    modelName: 'equipmentCategory',
    tableName: 'equipment_categories',
    createSchema: s.equipmentCategorySchema,
    updateSchema: s.equipmentCategorySchema.partial(),
    searchFields: ['categoryName'],
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/equipment-types',
  createCrudRouter({
    modelName: 'equipmentType',
    tableName: 'equipment_types',
    createSchema: s.equipmentTypeSchema,
    updateSchema: s.equipmentTypeSchema.partial(),
    searchFields: ['typeName'],
    includes: { category: true },
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

// ── Core Master Tables ───────────────────────────────────────────────────

router.use(
  '/projects',
  createCrudRouter({
    modelName: 'project',
    tableName: 'projects',
    createSchema: s.projectCreateSchema,
    updateSchema: s.projectUpdateSchema,
    searchFields: ['projectCode', 'projectName', 'client'],
    includes: { region: true, city: true },
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/employees',
  createCrudRouter({
    modelName: 'employee',
    tableName: 'employees',
    createSchema: s.employeeCreateSchema,
    updateSchema: s.employeeUpdateSchema,
    searchFields: ['fullName', 'email', 'employeeIdNumber'],
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/suppliers',
  createCrudRouter({
    modelName: 'supplier',
    tableName: 'suppliers',
    createSchema: s.supplierCreateSchema,
    updateSchema: s.supplierUpdateSchema,
    searchFields: ['supplierCode', 'supplierName'],
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/warehouses',
  createCrudRouter({
    modelName: 'warehouse',
    tableName: 'warehouses',
    createSchema: s.warehouseCreateSchema,
    updateSchema: s.warehouseUpdateSchema,
    searchFields: ['warehouseCode', 'warehouseName'],
    includes: { warehouseType: true, region: true, city: true },
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/items',
  createCrudRouter({
    modelName: 'item',
    tableName: 'items',
    createSchema: s.itemCreateSchema,
    updateSchema: s.itemUpdateSchema,
    searchFields: ['itemCode', 'itemDescription'],
    includes: { uom: true },
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/generators',
  createCrudRouter({
    modelName: 'generator',
    tableName: 'generators',
    createSchema: s.generatorCreateSchema,
    updateSchema: s.generatorUpdateSchema,
    searchFields: ['generatorCode', 'generatorName'],
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/equipment-fleet',
  createCrudRouter({
    modelName: 'equipmentFleet',
    tableName: 'equipment_fleet',
    createSchema: s.equipmentFleetCreateSchema,
    updateSchema: s.equipmentFleetUpdateSchema,
    searchFields: ['vehicleCode', 'vehicleType', 'plateNumber'],
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/supplier-rates',
  createCrudRouter({
    modelName: 'supplierEquipmentRate',
    tableName: 'supplier_equipment_rates',
    createSchema: s.supplierRateCreateSchema,
    updateSchema: s.supplierRateUpdateSchema,
    includes: { supplier: true, equipmentType: true },
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/inventory',
  createCrudRouter({
    modelName: 'inventoryLevel',
    tableName: 'inventory_levels',
    createSchema: s.inventoryLevelCreateSchema,
    updateSchema: s.inventoryLevelUpdateSchema,
    searchFields: [],
    includes: { item: true, warehouse: true },
    defaultSort: 'updatedAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/customs',
  createCrudRouter({
    modelName: 'customsTracking',
    tableName: 'customs_tracking',
    createSchema: s.customsTrackingCreateSchema,
    updateSchema: s.customsTrackingUpdateSchema,
    searchFields: ['customsDeclaration', 'customsRef'],
    includes: { shipment: true },
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

export default router;
