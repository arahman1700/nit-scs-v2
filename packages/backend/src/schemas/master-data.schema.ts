import { z } from 'zod';

// ── Lookup Tables ────────────────────────────────────────────────────────

export const regionSchema = z.object({
  regionName: z.string().min(1).max(100),
});

export const citySchema = z.object({
  cityName: z.string().min(1).max(100),

  regionId: z.string().uuid(),
});

export const portSchema = z.object({
  portName: z.string().min(1).max(200),
  portCode: z.string().max(20).optional(),
  cityId: z.string().uuid().optional(),
  portType: z.enum(['sea', 'air', 'land']).optional(),
});

export const uomSchema = z.object({
  uomCode: z.string().min(1).max(20),
  uomName: z.string().min(1).max(50),

  category: z.string().max(30).optional(),
});

export const warehouseTypeSchema = z.object({
  typeName: z.string().min(1).max(50),
  description: z.string().optional(),
});

export const equipmentCategorySchema = z.object({
  categoryName: z.string().min(1).max(100),
});

export const equipmentTypeSchema = z.object({
  typeName: z.string().min(1).max(100),
  categoryId: z.string().uuid().optional(),
});

// ── Core Master Tables ───────────────────────────────────────────────────

export const projectCreateSchema = z.object({
  projectCode: z.string().min(1).max(50),
  projectName: z.string().min(1).max(300),

  client: z.string().min(1).max(200),
  entityId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  projectManagerId: z.string().uuid().optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'cancelled']).default('active'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().positive().optional(),
  description: z.string().optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const employeeCreateSchema = z.object({
  employeeIdNumber: z.string().min(1).max(20),
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  department: z.enum(['logistics', 'warehouse', 'transport', 'projects', 'quality', 'finance', 'admin']),
  role: z.string().min(1).max(50),
  systemRole: z.enum([
    'admin',
    'manager',
    'warehouse_supervisor',
    'warehouse_staff',
    'logistics_coordinator',
    'site_engineer',
    'qc_officer',
    'freight_forwarder',
  ]),
  assignedProjectId: z.string().uuid().optional(),
  assignedWarehouseId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  hireDate: z.string().datetime().optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const supplierCreateSchema = z.object({
  supplierCode: z.string().min(1).max(50),
  supplierName: z.string().min(1).max(300),

  types: z.array(z.string()),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  cityId: z.string().uuid().optional(),
  crNumber: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  paymentTerms: z.string().max(50).optional(),
});

export const supplierUpdateSchema = supplierCreateSchema.partial();

export const warehouseCreateSchema = z.object({
  warehouseCode: z.string().min(1).max(50),
  warehouseName: z.string().min(1).max(200),

  warehouseTypeId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  regionId: z.string().uuid(),
  cityId: z.string().uuid().optional(),
  address: z.string().optional(),
  managerId: z.string().uuid().optional(),
  contactPhone: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive', 'closed']).default('active'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const itemCreateSchema = z.object({
  itemCode: z.string().min(1).max(50),
  itemDescription: z.string().min(1).max(500),

  category: z.enum(['construction', 'electrical', 'mechanical', 'safety', 'tools', 'consumables', 'spare_parts']),
  subCategory: z.string().max(100).optional(),
  uomId: z.string().uuid(),
  minStock: z.number().min(0).default(0),
  reorderPoint: z.number().min(0).optional(),
  standardCost: z.number().min(0).optional(),
  barcode: z.string().max(100).optional(),
  isSerialized: z.boolean().default(false),
  isExpirable: z.boolean().default(false),
  status: z.enum(['active', 'inactive', 'discontinued']).default('active'),
});

export const itemUpdateSchema = itemCreateSchema.partial();

export const generatorCreateSchema = z.object({
  generatorCode: z.string().min(1).max(50),
  generatorName: z.string().min(1).max(200),
  capacityKva: z.number().int().positive(),
  equipmentTypeId: z.string().uuid().optional(),
  currentProjectId: z.string().uuid().optional(),
  currentWarehouseId: z.string().uuid().optional(),
  status: z.enum(['available', 'assigned', 'maintenance', 'decommissioned']).default('available'),
  purchaseDate: z.string().datetime().optional(),
  purchaseValue: z.number().min(0).optional(),
  salvageValue: z.number().min(0).optional(),
  usefulLifeMonths: z.number().int().optional(),
  depreciationMethod: z.enum(['straight_line', 'usage_based']).optional(),
});

export const generatorUpdateSchema = generatorCreateSchema.partial();

export const equipmentFleetCreateSchema = z.object({
  vehicleCode: z.string().min(1).max(50),
  vehicleType: z.string().min(1).max(100),
  plateNumber: z.string().max(30).optional(),
  equipmentTypeId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  status: z.enum(['available', 'assigned', 'maintenance', 'decommissioned']).default('available'),
  mileageKm: z.number().int().default(0),
  nextMaintenanceDate: z.string().datetime().optional(),
  insuranceExpiry: z.string().datetime().optional(),
  registrationExpiry: z.string().datetime().optional(),
});

export const equipmentFleetUpdateSchema = equipmentFleetCreateSchema.partial();

export const supplierRateCreateSchema = z.object({
  supplierId: z.string().uuid(),
  equipmentTypeId: z.string().uuid(),
  dailyRate: z.number().min(0).optional(),
  monthlyRate: z.number().min(0).optional(),
  withOperatorSurcharge: z.number().min(0).default(0),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const supplierRateUpdateSchema = supplierRateCreateSchema.partial();

export const inventoryLevelCreateSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  qtyOnHand: z.number().min(0).default(0),
  qtyReserved: z.number().min(0).default(0),
  minLevel: z.number().min(0).optional(),
  reorderPoint: z.number().min(0).optional(),
});

export const inventoryLevelUpdateSchema = inventoryLevelCreateSchema.partial();

export const customsTrackingCreateSchema = z.object({
  shipmentId: z.string().uuid(),
  stage: z.string().min(1).max(30),
  stageDate: z.string().datetime(),
  stageEndDate: z.string().datetime().optional(),
  customsDeclaration: z.string().max(50).optional(),
  customsRef: z.string().max(50).optional(),
  inspectorName: z.string().max(200).optional(),
  inspectionType: z.string().max(30).optional(),
  dutiesAmount: z.number().min(0).optional(),
  vatAmount: z.number().min(0).optional(),
  otherFees: z.number().min(0).optional(),
  paymentStatus: z.string().max(20).optional(),
  issues: z.string().optional(),
  resolution: z.string().optional(),
});

export const customsTrackingUpdateSchema = customsTrackingCreateSchema.partial();
