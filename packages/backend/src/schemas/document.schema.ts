import { z } from 'zod';

const uuid = z.string().uuid();
const decimalPositive = z.number().positive();
const decimalNonNegative = z.number().min(0);

// ── GRN (Goods Receipt Note) — was MRRV ──────────────────────────────────

const grnLineSchema = z.object({
  itemId: uuid,
  qtyOrdered: z.number().optional(),
  qtyReceived: decimalPositive,
  qtyDamaged: decimalNonNegative.optional(),
  uomId: uuid,
  unitCost: z.number().optional(),
  condition: z.enum(['good', 'damaged', 'mixed']).optional(),
  storageLocation: z.string().max(255).optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const grnCreateSchema = z.object({
  supplierId: uuid,
  poNumber: z.string().max(50).optional(),
  warehouseId: uuid,
  projectId: uuid.optional(),
  receiveDate: z.string().datetime(),
  invoiceNumber: z.string().max(50).optional(),
  deliveryNote: z.string().max(255).optional(),
  qciRequired: z.boolean().optional(),
  binLocation: z.string().max(100).optional(),
  receivingDock: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(grnLineSchema).min(1, 'At least one line item is required'),
});

export const grnUpdateSchema = z.object({
  supplierId: uuid.optional(),
  poNumber: z.string().max(50).optional(),
  warehouseId: uuid.optional(),
  projectId: uuid.optional(),
  receiveDate: z.string().datetime().optional(),
  invoiceNumber: z.string().max(50).optional(),
  deliveryNote: z.string().max(255).optional(),
  qciRequired: z.boolean().optional(),
  binLocation: z.string().max(100).optional(),
  receivingDock: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(0).optional(),
});

// V1 compatibility aliases
export const mrrvCreateSchema = grnCreateSchema;
export const mrrvUpdateSchema = grnUpdateSchema;

// ── MI (Material Issuance) — was MIRV ─────────────────────────────────────

const miLineSchema = z.object({
  itemId: uuid,
  qtyRequested: decimalPositive,
  notes: z.string().max(2000).optional(),
});

export const miCreateSchema = z.object({
  projectId: uuid,
  warehouseId: uuid,
  locationOfWork: z.string().max(255).optional(),
  requestDate: z.string().datetime(),
  requiredDate: z.string().datetime().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(miLineSchema).min(1, 'At least one line item is required'),
});

export const miUpdateSchema = z.object({
  projectId: uuid.optional(),
  warehouseId: uuid.optional(),
  locationOfWork: z.string().max(255).optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().datetime().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(0).optional(),
});

// V1 compatibility aliases
export const mirvCreateSchema = miCreateSchema;
export const mirvUpdateSchema = miUpdateSchema;

// ── MRN (Material Return Note) — was MRV ──────────────────────────────────

const mrnLineSchema = z.object({
  itemId: uuid,
  qtyReturned: decimalPositive,
  uomId: uuid,
  condition: z.enum(['good', 'used', 'damaged']),
  notes: z.string().max(2000).optional(),
});

export const mrnCreateSchema = z.object({
  returnType: z.enum(['return_to_warehouse', 'return_to_supplier', 'scrap', 'transfer_to_project', 'surplus']),
  projectId: uuid,
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid,
  returnDate: z.string().datetime(),
  reason: z.string().min(1, 'Return reason is required').max(1000),
  originalMiId: uuid.optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(mrnLineSchema).min(1, 'At least one line item is required'),
});

export const mrnUpdateSchema = z.object({
  returnType: z
    .enum(['return_to_warehouse', 'return_to_supplier', 'scrap', 'transfer_to_project', 'surplus'])
    .optional(),
  projectId: uuid.optional(),
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid.optional(),
  returnDate: z.string().datetime().optional(),
  reason: z.string().max(1000).optional(),
  originalMiId: uuid.optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(0).optional(),
});

// V1 compatibility aliases
export const mrvCreateSchema = mrnCreateSchema;
export const mrvUpdateSchema = mrnUpdateSchema;

// ── QCI (Quality Control Inspection) — was RFIM ──────────────────────────

export const qciUpdateSchema = z.object({
  inspectorId: uuid.optional(),
  result: z.enum(['pass', 'fail', 'conditional']).optional(),
  comments: z.string().max(2000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  version: z.number().int().min(0).optional(),
});

// V1 compatibility alias
export const rfimUpdateSchema = qciUpdateSchema;

// ── DR (Discrepancy Report) — was OSD ─────────────────────────────────────

const drLineSchema = z.object({
  itemId: uuid,
  uomId: uuid,
  grnLineId: uuid.optional(),
  qtyInvoice: decimalNonNegative,
  qtyReceived: decimalNonNegative,
  qtyDamaged: decimalNonNegative.optional(),
  damageType: z.enum(['physical', 'water', 'missing_parts', 'wrong_item', 'expired', 'other']).optional(),
  unitCost: z.number().optional(),
  notes: z.string().max(2000).optional(),
});

export const drCreateSchema = z.object({
  grnId: uuid,
  poNumber: z.string().max(50).optional(),
  supplierId: uuid.optional(),
  warehouseId: uuid.optional(),
  reportDate: z.string().datetime(),
  reportTypes: z.array(z.string().max(100)).min(1, 'At least one report type is required'),
  notes: z.string().max(2000).optional(),
  lines: z.array(drLineSchema).min(1, 'At least one line item is required'),
});

export const drUpdateSchema = z.object({
  poNumber: z.string().max(50).optional(),
  supplierId: uuid.optional(),
  warehouseId: uuid.optional(),
  reportDate: z.string().datetime().optional(),
  reportTypes: z.array(z.string().max(100)).optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(0).optional(),
});

// V1 compatibility aliases
export const osdCreateSchema = drCreateSchema;
export const osdUpdateSchema = drUpdateSchema;

// ── IMSF (Internal Material Shifting Form) — NEW ──────────────────────────

const imsfLineSchema = z.object({
  itemId: uuid,
  description: z.string().max(500).optional(),
  qty: decimalPositive,
  uomId: uuid,
  poNumber: z.string().max(50).optional(),
  mrfNumber: z.string().max(50).optional(),
});

export const imsfCreateSchema = z.object({
  senderProjectId: uuid,
  receiverProjectId: uuid,
  materialType: z.enum(['normal', 'hazardous']).optional(),
  requiredDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(imsfLineSchema).min(1, 'At least one line item is required'),
});

export const imsfUpdateSchema = z.object({
  receiverProjectId: uuid.optional(),
  materialType: z.enum(['normal', 'hazardous']).optional(),
  requiredDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

// ── WT (Warehouse Transfer) — was Stock Transfer ──────────────────────────

export {
  stockTransferCreateSchema as wtCreateSchema,
  stockTransferUpdateSchema as wtUpdateSchema,
} from '../domains/logistics/schemas/logistics.schema.js';

// ── Surplus ────────────────────────────────────────────────────────────────

export const surplusCreateSchema = z.object({
  itemId: uuid,
  warehouseId: uuid,
  projectId: uuid.optional(),
  qty: decimalPositive,
  condition: z.string().min(1, 'Condition is required').max(255),
  estimatedValue: z.number().optional(),
  disposition: z.enum(['transfer', 'return', 'retain', 'sell']).optional(),
  notes: z.string().max(2000).optional(),
});

export const surplusUpdateSchema = z.object({
  qty: decimalPositive.optional(),
  condition: z.string().max(255).optional(),
  estimatedValue: z.number().optional(),
  disposition: z.enum(['transfer', 'return', 'retain', 'sell']).optional(),
  notes: z.string().max(2000).optional(),
});

// ── Scrap ──────────────────────────────────────────────────────────────────

export const scrapCreateSchema = z.object({
  projectId: uuid,
  warehouseId: uuid.optional(),
  materialType: z.enum(['cable', 'mv_cable', 'hv_cable', 'aluminum', 'copper', 'steel', 'cable_tray', 'wood', 'other']),
  description: z.string().min(1, 'Description is required').max(500),
  qty: decimalPositive,
  packaging: z.string().max(255).optional(),
  condition: z.string().max(255).optional(),
  estimatedValue: z.number().optional(),
  photos: z.array(z.string().max(500)).optional(),
  notes: z.string().max(2000).optional(),
});

export const scrapUpdateSchema = z.object({
  materialType: z
    .enum(['cable', 'mv_cable', 'hv_cable', 'aluminum', 'copper', 'steel', 'cable_tray', 'wood', 'other'])
    .optional(),
  description: z.string().max(500).optional(),
  qty: decimalPositive.optional(),
  packaging: z.string().max(255).optional(),
  condition: z.string().max(255).optional(),
  estimatedValue: z.number().optional(),
  photos: z.array(z.string().max(500)).optional(),
  notes: z.string().max(2000).optional(),
});

// ── SSC Bid ────────────────────────────────────────────────────────────────

export const sscBidCreateSchema = z.object({
  scrapItemId: uuid,
  bidderName: z.string().min(1, 'Bidder name is required').max(255),
  bidderContact: z.string().max(255).optional(),
  bidAmount: decimalPositive,
  bidDate: z.string().datetime().optional(),
});

export const sscBidUpdateSchema = z.object({
  bidAmount: decimalPositive.optional(),
  bidderContact: z.string().max(255).optional(),
});

// ── Rental Contract ────────────────────────────────────────────────────────

const rentalLineSchema = z.object({
  equipmentDescription: z.string().min(1).max(500),
  qty: z.number().int().positive(),
  unitRate: decimalPositive,
  totalRate: decimalPositive,
});

export const rentalContractCreateSchema = z.object({
  supplierId: uuid,
  equipmentType: z.string().min(1, 'Equipment type is required').max(255),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  monthlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  insuranceValue: z.number().optional(),
  insuranceExpiry: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(rentalLineSchema).min(1, 'At least one line item is required'),
});

export const rentalContractUpdateSchema = z.object({
  endDate: z.string().datetime().optional(),
  monthlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  insuranceValue: z.number().optional(),
  insuranceExpiry: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

// ── Tool ───────────────────────────────────────────────────────────────────

export const toolCreateSchema = z.object({
  toolCode: z.string().min(1, 'Tool code is required').max(50),
  toolName: z.string().min(1, 'Tool name is required').max(255),
  category: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  condition: z.enum(['good', 'under_maintenance', 'damaged', 'decommissioned']).optional(),
  warehouseId: uuid.optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
});

export const toolUpdateSchema = z.object({
  toolName: z.string().max(255).optional(),
  category: z.string().max(100).optional(),
  condition: z.enum(['good', 'under_maintenance', 'damaged', 'decommissioned']).optional(),
  warehouseId: uuid.optional(),
});

// ── Tool Issue ─────────────────────────────────────────────────────────────

export const toolIssueCreateSchema = z.object({
  toolId: uuid,
  issuedToId: uuid,
  expectedReturnDate: z.string().datetime().optional(),
});

export const toolIssueReturnSchema = z.object({
  returnCondition: z.enum(['good', 'used', 'damaged']),
});

// ── Generator Fuel Log ─────────────────────────────────────────────────────

export const generatorFuelLogCreateSchema = z.object({
  generatorId: uuid,
  fuelDate: z.string().datetime(),
  fuelQtyLiters: decimalPositive,
  meterReading: z.number().optional(),
  fuelSupplier: z.string().max(255).optional(),
  costPerLiter: z.number().optional(),
  totalCost: z.number().optional(),
});

// ── Generator Maintenance ──────────────────────────────────────────────────

export const generatorMaintenanceCreateSchema = z.object({
  generatorId: uuid,
  maintenanceType: z.enum(['daily', 'weekly', 'monthly', 'annual']),
  scheduledDate: z.string().datetime(),
  findings: z.string().max(2000).optional(),
  partsReplaced: z.string().max(2000).optional(),
  cost: z.number().optional(),
});

export const generatorMaintenanceUpdateSchema = z.object({
  completedDate: z.string().datetime().optional(),
  findings: z.string().max(2000).optional(),
  partsReplaced: z.string().max(2000).optional(),
  cost: z.number().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'overdue']).optional(),
});

// ── Warehouse Zone ─────────────────────────────────────────────────────────

export const warehouseZoneCreateSchema = z.object({
  warehouseId: uuid,
  zoneName: z.string().min(1, 'Zone name is required').max(255),
  zoneCode: z.string().min(1, 'Zone code is required').max(50),
  zoneType: z.enum(['civil', 'mechanical', 'electrical', 'scrap', 'container', 'open_yard', 'hazardous']),
  capacity: z.number().int().optional(),
});

export const warehouseZoneUpdateSchema = z.object({
  zoneName: z.string().max(255).optional(),
  zoneType: z.enum(['civil', 'mechanical', 'electrical', 'scrap', 'container', 'open_yard', 'hazardous']).optional(),
  capacity: z.number().int().optional(),
  currentOccupancy: z.number().int().optional(),
});

// ── Bin Location ──────────────────────────────────────────────────────────

const binLocationTypes = ['picking', 'bulk', 'staging', 'quarantine', 'returns', 'overflow'] as const;

export const binLocationCreateSchema = z.object({
  zoneId: uuid,
  locationCode: z.string().min(1, 'Location code is required').max(30),
  aisle: z.string().max(10).optional(),
  rack: z.string().max(10).optional(),
  shelf: z.string().max(10).optional(),
  bin: z.string().max(10).optional(),
  locationType: z.enum(binLocationTypes).optional(),
  maxCapacity: z.number().positive().optional(),
  currentOccupancy: decimalNonNegative.optional(),
  isActive: z.boolean().optional(),
});

export const binLocationUpdateSchema = z.object({
  locationCode: z.string().min(1).max(30).optional(),
  aisle: z.string().max(10).nullable().optional(),
  rack: z.string().max(10).nullable().optional(),
  shelf: z.string().max(10).nullable().optional(),
  bin: z.string().max(10).nullable().optional(),
  locationType: z.enum(binLocationTypes).optional(),
  maxCapacity: z.number().positive().nullable().optional(),
  currentOccupancy: decimalNonNegative.nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Bin Card ──────────────────────────────────────────────────────────────

export const binCardCreateSchema = z.object({
  itemId: uuid,
  warehouseId: uuid,
  binNumber: z.string().min(1, 'Bin number is required').max(30),
  currentQty: decimalNonNegative.optional(),
});

export const binCardUpdateSchema = z.object({
  binNumber: z.string().max(30).optional(),
  currentQty: decimalNonNegative.optional(),
});

export const binCardTransactionCreateSchema = z.object({
  binCardId: uuid,
  transactionType: z.enum(['receipt', 'issue', 'adjustment', 'transfer']),
  referenceType: z.enum(['grn', 'mi', 'wt', 'adjustment']),
  referenceId: uuid,
  referenceNumber: z.string().max(50).optional(),
  qtyIn: decimalNonNegative.optional(),
  qtyOut: decimalNonNegative.optional(),
  runningBalance: z.number(),
});

// ── Storekeeper Handover ──────────────────────────────────────────────────

export const handoverCreateSchema = z.object({
  warehouseId: uuid,
  outgoingEmployeeId: uuid,
  incomingEmployeeId: uuid,
  handoverDate: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export const handoverUpdateSchema = z.object({
  status: z.enum(['initiated', 'in_progress', 'completed']).optional(),
  inventoryVerified: z.boolean().optional(),
  discrepanciesFound: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

// ── Put-Away Rules ──────────────────────────────────────────────────────

export const putAwayRuleCreateSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(200),
  priority: z.number().int().min(1).max(9999).optional(),
  warehouseId: uuid,
  targetZoneId: uuid.optional(),
  itemCategory: z.string().max(50).optional(),
  isHazardous: z.boolean().optional(),
  maxWeight: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export const putAwayRuleUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  priority: z.number().int().min(1).max(9999).optional(),
  targetZoneId: uuid.nullable().optional(),
  itemCategory: z.string().max(50).nullable().optional(),
  isHazardous: z.boolean().optional(),
  maxWeight: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Equipment Delivery Note ──────────────────────────────────────────────

const conditionEnum = z.enum(['excellent', 'good', 'fair', 'poor']);
const fuelLevelEnum = z.enum(['full', 'three_quarter', 'half', 'quarter', 'empty']);

export const equipmentDeliveryNoteCreateSchema = z.object({
  jobOrderId: uuid,
  rentalContractId: uuid.optional(),
  deliveryDate: z.string().datetime(),
  receivedById: uuid,
  equipmentDescription: z.string().min(1, 'Equipment description is required').max(500),
  serialNumber: z.string().max(100).optional(),
  hoursOnDelivery: z.number().min(0).optional(),
  mileageOnDelivery: z.number().min(0).optional(),
  conditionOnDelivery: conditionEnum,
  conditionNotes: z.string().max(2000).optional(),
  safetyCertificateVerified: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export const equipmentDeliveryNoteUpdateSchema = z.object({
  deliveryDate: z.string().datetime().optional(),
  equipmentDescription: z.string().min(1).max(500).optional(),
  serialNumber: z.string().max(100).optional(),
  hoursOnDelivery: z.number().min(0).optional(),
  mileageOnDelivery: z.number().min(0).optional(),
  conditionOnDelivery: conditionEnum.optional(),
  conditionNotes: z.string().max(2000).optional(),
  safetyCertificateVerified: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

// ── Equipment Return Note ───────────────────────────────────────────────

export const equipmentReturnNoteCreateSchema = z.object({
  jobOrderId: uuid,
  deliveryNoteId: uuid,
  returnDate: z.string().datetime(),
  returnedById: uuid,
  hoursOnReturn: z.number().min(0).optional(),
  mileageOnReturn: z.number().min(0).optional(),
  conditionOnReturn: conditionEnum,
  conditionNotes: z.string().max(2000).optional(),
  damageDescription: z.string().max(2000).optional(),
  damageEstimatedCost: z.number().min(0).optional(),
  fuelLevel: fuelLevelEnum.optional(),
  notes: z.string().max(2000).optional(),
});

export const equipmentReturnNoteUpdateSchema = z.object({
  returnDate: z.string().datetime().optional(),
  hoursOnReturn: z.number().min(0).optional(),
  mileageOnReturn: z.number().min(0).optional(),
  conditionOnReturn: conditionEnum.optional(),
  conditionNotes: z.string().max(2000).optional(),
  damageDescription: z.string().max(2000).optional(),
  damageEstimatedCost: z.number().min(0).optional(),
  fuelLevel: fuelLevelEnum.optional(),
  notes: z.string().max(2000).optional(),
});

// ── Rate Card (Supplier Equipment Rate) ──────────────────────────────────

export const rateCardCreateSchema = z.object({
  supplierId: uuid,
  equipmentTypeId: uuid,
  capacity: z.string().max(100).optional(),
  dailyRate: decimalNonNegative.optional(),
  weeklyRate: decimalNonNegative.optional(),
  monthlyRate: decimalNonNegative.optional(),
  withOperatorSurcharge: decimalNonNegative.optional(),
  operatorIncluded: z.boolean().optional(),
  fuelIncluded: z.boolean().optional(),
  insuranceIncluded: z.boolean().optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  notes: z.string().max(2000).optional(),
});

export const rateCardUpdateSchema = z.object({
  capacity: z.string().max(100).optional(),
  dailyRate: decimalNonNegative.optional(),
  weeklyRate: decimalNonNegative.optional(),
  monthlyRate: decimalNonNegative.optional(),
  withOperatorSurcharge: decimalNonNegative.optional(),
  operatorIncluded: z.boolean().optional(),
  fuelIncluded: z.boolean().optional(),
  insuranceIncluded: z.boolean().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  notes: z.string().max(2000).optional(),
});

// ── Visitor Pass (SOW M5-F03) ────────────────────────────────────────────

export const visitorPassCreateSchema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required').max(200),
  visitorCompany: z.string().max(200).optional(),
  visitorIdNumber: z.string().min(1, 'Visitor ID number is required').max(50),
  visitorPhone: z.string().max(30).optional(),
  visitorEmail: z.string().email().max(200).optional(),
  hostEmployeeId: uuid,
  warehouseId: uuid,
  purpose: z.string().min(1, 'Visit purpose is required').max(500),
  visitDate: z.string().datetime(),
  expectedDuration: z.number().int().min(1, 'Expected duration must be at least 1 minute'),
  vehicleNumber: z.string().max(30).optional(),
  vehicleType: z.string().max(30).optional(),
  badgeNumber: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export const visitorPassUpdateSchema = z.object({
  visitorName: z.string().min(1).max(200).optional(),
  visitorCompany: z.string().max(200).nullable().optional(),
  visitorIdNumber: z.string().min(1).max(50).optional(),
  visitorPhone: z.string().max(30).nullable().optional(),
  visitorEmail: z.string().email().max(200).nullable().optional(),
  hostEmployeeId: uuid.optional(),
  warehouseId: uuid.optional(),
  purpose: z.string().min(1).max(500).optional(),
  visitDate: z.string().datetime().optional(),
  expectedDuration: z.number().int().min(1).optional(),
  vehicleNumber: z.string().max(30).nullable().optional(),
  vehicleType: z.string().max(30).nullable().optional(),
  badgeNumber: z.string().max(30).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const visitorCheckInSchema = z.object({
  badgeNumber: z.string().max(30).optional(),
});

// ── AMC (Annual Maintenance Contract) — SOW M1 ─────────────────────────

export const amcCreateSchema = z.object({
  supplierId: uuid,
  equipmentTypeId: uuid,
  startDate: z.string().min(1, 'Start date is required').max(50),
  endDate: z.string().min(1, 'End date is required').max(50),
  contractValue: decimalPositive,
  coverageType: z.enum(['comprehensive', 'parts_only', 'labor_only']),
  responseTimeSlaHours: z.number().int().min(1, 'Response time SLA must be at least 1 hour'),
  preventiveMaintenanceFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  includesSpares: z.boolean().optional(),
  maxCallouts: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const amcUpdateSchema = z.object({
  supplierId: uuid.optional(),
  equipmentTypeId: uuid.optional(),
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
  contractValue: decimalPositive.optional(),
  coverageType: z.enum(['comprehensive', 'parts_only', 'labor_only']).optional(),
  responseTimeSlaHours: z.number().int().min(1).optional(),
  preventiveMaintenanceFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  includesSpares: z.boolean().optional(),
  maxCallouts: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const amcTerminateSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// ── Customs Document (SOW M9) ────────────────────────────────────────────

const customsDocumentTypes = [
  'bill_of_lading',
  'commercial_invoice',
  'packing_list',
  'certificate_of_origin',
  'insurance_certificate',
  'customs_declaration',
  'import_permit',
  'phytosanitary',
  'conformity_certificate',
  'other',
] as const;

export const customsDocumentCreateSchema = z.object({
  shipmentId: uuid,
  documentType: z.enum(customsDocumentTypes),
  documentNumber: z.string().max(100).optional(),
  issueDate: z.string().max(50).optional(),
  expiryDate: z.string().max(50).optional(),
  filePath: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const customsDocumentUpdateSchema = z.object({
  documentType: z.enum(customsDocumentTypes).optional(),
  documentNumber: z.string().max(100).nullable().optional(),
  issueDate: z.string().max(50).nullable().optional(),
  expiryDate: z.string().max(50).nullable().optional(),
  status: z.enum(['pending', 'received', 'verified', 'rejected']).optional(),
  filePath: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const customsDocumentRejectSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// ── Vehicle Maintenance (M8) ─────────────────────────────────────────────

export const vehicleMaintenanceCreateSchema = z.object({
  vehicleId: uuid,
  maintenanceType: z.enum(['preventive', 'corrective', 'emergency', 'inspection']),
  scheduledDate: z.string().min(1, 'Scheduled date is required').max(50),
  description: z.string().min(1, 'Description is required').max(2000),
  currentHoursAtService: z.number().optional(),
  currentMileageAtService: z.number().optional(),
  vendorName: z.string().max(200).optional(),
  performedById: uuid.optional(),
  nextServiceHours: z.number().optional(),
  nextServiceMileage: z.number().optional(),
  nextServiceDate: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const vehicleMaintenanceUpdateSchema = z.object({
  maintenanceType: z.enum(['preventive', 'corrective', 'emergency', 'inspection']).optional(),
  scheduledDate: z.string().max(50).optional(),
  description: z.string().min(1).max(2000).optional(),
  currentHoursAtService: z.number().nullable().optional(),
  currentMileageAtService: z.number().nullable().optional(),
  vendorName: z.string().max(200).nullable().optional(),
  performedById: uuid.nullable().optional(),
  nextServiceHours: z.number().nullable().optional(),
  nextServiceMileage: z.number().nullable().optional(),
  nextServiceDate: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const vehicleMaintenanceCompleteSchema = z.object({
  workPerformed: z.string().min(1, 'Work performed is required').max(2000),
  partsUsed: z.string().max(2000).optional(),
  cost: z.number().optional(),
});

// ── Asset Register (M10) ─────────────────────────────────────────────────

export const assetCreateSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  category: z.enum(['equipment', 'vehicle', 'furniture', 'it_hardware', 'tools', 'other']),
  serialNumber: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  model: z.string().max(200).optional(),
  purchaseDate: z.string().datetime().optional(),
  purchaseCost: decimalNonNegative.optional(),
  currentValue: decimalNonNegative.optional(),
  depreciationMethod: z.enum(['straight_line', 'declining_balance', 'none']).optional(),
  usefulLifeYears: z.number().int().min(1).optional(),
  salvageValue: decimalNonNegative.optional(),
  status: z.enum(['active', 'maintenance', 'retired', 'disposed', 'lost']).optional(),
  locationWarehouseId: uuid.optional(),
  assignedToId: uuid.optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor']).optional(),
  notes: z.string().max(2000).optional(),
});

export const assetUpdateSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  category: z.enum(['equipment', 'vehicle', 'furniture', 'it_hardware', 'tools', 'other']).optional(),
  serialNumber: z.string().max(100).nullable().optional(),
  manufacturer: z.string().max(200).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  purchaseDate: z.string().datetime().nullable().optional(),
  purchaseCost: decimalNonNegative.nullable().optional(),
  currentValue: decimalNonNegative.nullable().optional(),
  depreciationMethod: z.enum(['straight_line', 'declining_balance', 'none']).nullable().optional(),
  usefulLifeYears: z.number().int().min(1).nullable().optional(),
  salvageValue: decimalNonNegative.nullable().optional(),
  locationWarehouseId: uuid.nullable().optional(),
  assignedToId: uuid.nullable().optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor']).nullable().optional(),
  lastAuditDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const assetTransferSchema = z.object({
  toWarehouseId: uuid.optional(),
  toEmployeeId: uuid.optional(),
  reason: z.string().max(1000).optional(),
});

export const assetDisposeSchema = z.object({
  disposalValue: decimalNonNegative.optional(),
});

// ── Approval Action ─────────────────────────────────────────────────────

export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().max(2000).optional(),
});
