import { Router, type Request, type Response, type NextFunction } from 'express';
import { createCrudRouter } from '../../../utils/crud-factory.js';
import { conditionalCache } from '../../../middleware/cache-headers.js';
import { prisma } from '../../../utils/prisma.js';
import { BusinessRuleError } from '@nit-scs-v2/shared';
import * as s from '../../../schemas/master-data.schema.js';
import { invalidateCachePattern, CacheTTL } from '../../../utils/cache.js';
import { getRedis, isRedisAvailable } from '../../../config/redis.js';

const router = Router();

// ETag / conditional caching for master data GET requests (5 min max-age)
router.use(conditionalCache(300));

// ── Redis Cache Layer ─────────────────────────────────────────────────

const CACHE_PREFIX = 'nit-scs:cache:';

/**
 * Express middleware that caches GET list responses in Redis.
 * On cache HIT, returns the cached JSON immediately with X-Cache: HIT header.
 * On cache MISS, intercepts res.json to capture and cache the response.
 * Only applies to GET requests without an :id param (list endpoints).
 */
function masterDataCacheMiddleware(resourceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache list GETs (not detail GETs with /:id)
    if (req.method !== 'GET' || req.params.id) {
      return next();
    }

    if (!isRedisAvailable()) return next();
    const redis = getRedis();
    if (!redis) return next();

    const cacheKey = `${CACHE_PREFIX}master-data:${resourceName}:${req.url}`;

    try {
      const hit = await redis.get(cacheKey);
      if (hit) {
        res.setHeader('X-Cache', 'HIT');
        res.json(JSON.parse(hit));
        return;
      }
    } catch { /* fall through to DB on Redis read error */ }

    // Cache MISS — intercept res.json to capture and cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Cache the response asynchronously (fire-and-forget)
      if (redis && res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(cacheKey, CacheTTL.MASTER_DATA, JSON.stringify(body)).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    } as typeof res.json;

    next();
  };
}

/** Invalidate all master data caches — call on any master data mutation. */
export async function invalidateMasterDataCache(): Promise<void> {
  await invalidateCachePattern('master-data:*');
}

// Invalidate master-data Redis cache on any successful mutation (POST/PUT/PATCH/DELETE)
router.use((req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateCachePattern('master-data:*').catch(() => {});
      }
    });
  }
  next();
});

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
    defaultSort: 'regionName',
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
    defaultSort: 'cityName',
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
    defaultSort: 'portName',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

// Redis cache layer for UOMs (high-traffic reference data)
router.use('/uoms', masterDataCacheMiddleware('uoms'));
router.use(
  '/uoms',
  createCrudRouter({
    modelName: 'unitOfMeasure',
    tableName: 'units_of_measure',
    createSchema: s.uomSchema,
    updateSchema: s.uomSchema.partial(),
    searchFields: ['uomCode', 'uomName'],
    defaultSort: 'uomCode',
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
    defaultSort: 'typeName',
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
    defaultSort: 'categoryName',
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
    defaultSort: 'typeName',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

// ── Core Master Tables ───────────────────────────────────────────────────

router.use(
  '/projects',
  createCrudRouter({
    modelName: 'project',
    tableName: 'projects',
    resource: 'projects',
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
    resource: 'employees',
    createSchema: s.employeeCreateSchema,
    updateSchema: s.employeeUpdateSchema,
    searchFields: ['fullName', 'email', 'employeeIdNumber'],
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
    omitFields: ['passwordHash'],
  }),
);

// Redis cache layer for suppliers (high-traffic reference data)
router.use('/suppliers', masterDataCacheMiddleware('suppliers'));
router.use(
  '/suppliers',
  createCrudRouter({
    modelName: 'supplier',
    tableName: 'suppliers',
    resource: 'suppliers',
    createSchema: s.supplierCreateSchema,
    updateSchema: s.supplierUpdateSchema,
    searchFields: ['supplierCode', 'supplierName'],
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

// Redis cache layer for warehouses (high-traffic reference data)
router.use('/warehouses', masterDataCacheMiddleware('warehouses'));
router.use(
  '/warehouses',
  createCrudRouter({
    modelName: 'warehouse',
    tableName: 'warehouses',
    resource: 'warehouses',
    createSchema: s.warehouseCreateSchema,
    updateSchema: s.warehouseUpdateSchema,
    searchFields: ['warehouseCode', 'warehouseName'],
    includes: { warehouseType: true, region: true, city: true },
    defaultSort: 'createdAt',
    allowedRoles: MASTER_DATA_ROLES,
    beforeDelete: async (id: string) => {
      // Guard: prevent deletion of warehouses with operational data
      const [zones, gatePasses, employees] = await Promise.all([
        prisma.warehouseZone.count({ where: { warehouseId: id } }),
        prisma.gatePass.count({ where: { warehouseId: id } }),
        prisma.employee.count({ where: { assignedWarehouseId: id, isActive: true } }),
      ]);
      if (zones > 0 || gatePasses > 0 || employees > 0) {
        const reasons: string[] = [];
        if (zones > 0) reasons.push(`${zones} zone(s)`);
        if (gatePasses > 0) reasons.push(`${gatePasses} gate pass(es)`);
        if (employees > 0) reasons.push(`${employees} active employee(s)`);
        throw new BusinessRuleError(
          `Cannot delete warehouse: it has ${reasons.join(', ')} linked. Remove or reassign them first.`,
        );
      }
    },
  }),
);

// Redis cache layer for items (most frequently queried master data)
router.use('/items', masterDataCacheMiddleware('items'));
router.use(
  '/items',
  createCrudRouter({
    modelName: 'item',
    tableName: 'items',
    resource: 'items',
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
    resource: 'generators',
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
    resource: 'fleet',
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
    defaultSort: 'validFrom',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

router.use(
  '/inventory',
  createCrudRouter({
    modelName: 'inventoryLevel',
    tableName: 'inventory_levels',
    resource: 'inventory',
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
    resource: 'customs',
    createSchema: s.customsTrackingCreateSchema,
    updateSchema: s.customsTrackingUpdateSchema,
    searchFields: ['customsDeclaration', 'customsRef'],
    includes: { shipment: true },
    defaultSort: 'stageDate',
    allowedRoles: MASTER_DATA_ROLES,
  }),
);

export default router;
