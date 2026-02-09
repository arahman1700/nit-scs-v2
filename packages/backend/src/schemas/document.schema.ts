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
  storageLocation: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const grnCreateSchema = z.object({
  supplierId: uuid,
  poNumber: z.string().optional(),
  warehouseId: uuid,
  projectId: uuid.optional(),
  receiveDate: z.string().datetime(),
  invoiceNumber: z.string().optional(),
  deliveryNote: z.string().optional(),
  qciRequired: z.boolean().optional(),
  binLocation: z.string().optional(),
  receivingDock: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(grnLineSchema).min(1, 'At least one line item is required'),
});

export const grnUpdateSchema = z.object({
  supplierId: uuid.optional(),
  poNumber: z.string().optional(),
  warehouseId: uuid.optional(),
  projectId: uuid.optional(),
  receiveDate: z.string().datetime().optional(),
  invoiceNumber: z.string().optional(),
  deliveryNote: z.string().optional(),
  qciRequired: z.boolean().optional(),
  binLocation: z.string().optional(),
  receivingDock: z.string().optional(),
  notes: z.string().optional(),
});

// V1 compatibility aliases
export const mrrvCreateSchema = grnCreateSchema;
export const mrrvUpdateSchema = grnUpdateSchema;

// ── MI (Material Issuance) — was MIRV ─────────────────────────────────────

const miLineSchema = z.object({
  itemId: uuid,
  qtyRequested: decimalPositive,
  notes: z.string().optional(),
});

export const miCreateSchema = z.object({
  projectId: uuid,
  warehouseId: uuid,
  locationOfWork: z.string().optional(),
  requestDate: z.string().datetime(),
  requiredDate: z.string().datetime().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  notes: z.string().optional(),
  lines: z.array(miLineSchema).min(1, 'At least one line item is required'),
});

export const miUpdateSchema = z.object({
  projectId: uuid.optional(),
  warehouseId: uuid.optional(),
  locationOfWork: z.string().optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().datetime().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  notes: z.string().optional(),
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
  notes: z.string().optional(),
});

export const mrnCreateSchema = z.object({
  returnType: z.enum(['return_to_warehouse', 'return_to_supplier', 'scrap', 'transfer_to_project', 'surplus']),
  projectId: uuid,
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid,
  returnDate: z.string().datetime(),
  reason: z.string().min(1, 'Return reason is required'),
  originalMiId: uuid.optional(),
  notes: z.string().optional(),
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
  reason: z.string().optional(),
  originalMiId: uuid.optional(),
  notes: z.string().optional(),
});

// V1 compatibility aliases
export const mrvCreateSchema = mrnCreateSchema;
export const mrvUpdateSchema = mrnUpdateSchema;

// ── QCI (Quality Control Inspection) — was RFIM ──────────────────────────

export const qciUpdateSchema = z.object({
  inspectorId: uuid.optional(),
  result: z.enum(['pass', 'fail', 'conditional']).optional(),
  comments: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
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
  notes: z.string().optional(),
});

export const drCreateSchema = z.object({
  grnId: uuid,
  poNumber: z.string().optional(),
  supplierId: uuid.optional(),
  warehouseId: uuid.optional(),
  reportDate: z.string().datetime(),
  reportTypes: z.array(z.string()).min(1, 'At least one report type is required'),
  notes: z.string().optional(),
  lines: z.array(drLineSchema).min(1, 'At least one line item is required'),
});

export const drUpdateSchema = z.object({
  poNumber: z.string().optional(),
  supplierId: uuid.optional(),
  warehouseId: uuid.optional(),
  reportDate: z.string().datetime().optional(),
  reportTypes: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// V1 compatibility aliases
export const osdCreateSchema = drCreateSchema;
export const osdUpdateSchema = drUpdateSchema;

// ── IMSF (Internal Material Shifting Form) — NEW ──────────────────────────

const imsfLineSchema = z.object({
  itemId: uuid,
  description: z.string().optional(),
  qty: decimalPositive,
  uomId: uuid,
  poNumber: z.string().optional(),
  mrfNumber: z.string().optional(),
});

export const imsfCreateSchema = z.object({
  senderProjectId: uuid,
  receiverProjectId: uuid,
  materialType: z.enum(['normal', 'hazardous']).optional(),
  requiredDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(imsfLineSchema).min(1, 'At least one line item is required'),
});

export const imsfUpdateSchema = z.object({
  receiverProjectId: uuid.optional(),
  materialType: z.enum(['normal', 'hazardous']).optional(),
  requiredDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ── WT (Warehouse Transfer) — was Stock Transfer ──────────────────────────

export {
  stockTransferCreateSchema as wtCreateSchema,
  stockTransferUpdateSchema as wtUpdateSchema,
} from './logistics.schema.js';

// ── Surplus ────────────────────────────────────────────────────────────────

export const surplusCreateSchema = z.object({
  itemId: uuid,
  warehouseId: uuid,
  projectId: uuid.optional(),
  qty: decimalPositive,
  condition: z.string().min(1, 'Condition is required'),
  estimatedValue: z.number().optional(),
  disposition: z.enum(['transfer', 'return', 'retain', 'sell']).optional(),
  notes: z.string().optional(),
});

export const surplusUpdateSchema = z.object({
  qty: decimalPositive.optional(),
  condition: z.string().optional(),
  estimatedValue: z.number().optional(),
  disposition: z.enum(['transfer', 'return', 'retain', 'sell']).optional(),
  notes: z.string().optional(),
});

// ── Scrap ──────────────────────────────────────────────────────────────────

export const scrapCreateSchema = z.object({
  projectId: uuid,
  warehouseId: uuid.optional(),
  materialType: z.enum(['cable', 'mv_cable', 'hv_cable', 'aluminum', 'copper', 'steel', 'cable_tray', 'wood', 'other']),
  description: z.string().min(1, 'Description is required'),
  qty: decimalPositive,
  packaging: z.string().optional(),
  condition: z.string().optional(),
  estimatedValue: z.number().optional(),
  photos: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const scrapUpdateSchema = z.object({
  materialType: z
    .enum(['cable', 'mv_cable', 'hv_cable', 'aluminum', 'copper', 'steel', 'cable_tray', 'wood', 'other'])
    .optional(),
  description: z.string().optional(),
  qty: decimalPositive.optional(),
  packaging: z.string().optional(),
  condition: z.string().optional(),
  estimatedValue: z.number().optional(),
  photos: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ── SSC Bid ────────────────────────────────────────────────────────────────

export const sscBidCreateSchema = z.object({
  scrapItemId: uuid,
  bidderName: z.string().min(1, 'Bidder name is required'),
  bidderContact: z.string().optional(),
  bidAmount: decimalPositive,
  bidDate: z.string().datetime(),
});

export const sscBidUpdateSchema = z.object({
  bidAmount: decimalPositive.optional(),
  bidderContact: z.string().optional(),
});

// ── Rental Contract ────────────────────────────────────────────────────────

const rentalLineSchema = z.object({
  equipmentDescription: z.string().min(1),
  qty: z.number().int().positive(),
  unitRate: decimalPositive,
  totalRate: decimalPositive,
});

export const rentalContractCreateSchema = z.object({
  supplierId: uuid,
  equipmentType: z.string().min(1, 'Equipment type is required'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  monthlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  insuranceValue: z.number().optional(),
  insuranceExpiry: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(rentalLineSchema).min(1, 'At least one line item is required'),
});

export const rentalContractUpdateSchema = z.object({
  endDate: z.string().datetime().optional(),
  monthlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  insuranceValue: z.number().optional(),
  insuranceExpiry: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ── Tool ───────────────────────────────────────────────────────────────────

export const toolCreateSchema = z.object({
  toolCode: z.string().min(1, 'Tool code is required'),
  toolName: z.string().min(1, 'Tool name is required'),
  category: z.string().optional(),
  serialNumber: z.string().optional(),
  condition: z.enum(['good', 'under_maintenance', 'damaged', 'decommissioned']).optional(),
  warehouseId: uuid.optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
});

export const toolUpdateSchema = z.object({
  toolName: z.string().optional(),
  category: z.string().optional(),
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
  fuelSupplier: z.string().optional(),
  costPerLiter: z.number().optional(),
  totalCost: z.number().optional(),
});

// ── Generator Maintenance ──────────────────────────────────────────────────

export const generatorMaintenanceCreateSchema = z.object({
  generatorId: uuid,
  maintenanceType: z.enum(['daily', 'weekly', 'monthly', 'annual']),
  scheduledDate: z.string().datetime(),
  findings: z.string().optional(),
  partsReplaced: z.string().optional(),
  cost: z.number().optional(),
});

export const generatorMaintenanceUpdateSchema = z.object({
  completedDate: z.string().datetime().optional(),
  findings: z.string().optional(),
  partsReplaced: z.string().optional(),
  cost: z.number().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'overdue']).optional(),
});

// ── Warehouse Zone ─────────────────────────────────────────────────────────

export const warehouseZoneCreateSchema = z.object({
  warehouseId: uuid,
  zoneName: z.string().min(1, 'Zone name is required'),
  zoneCode: z.string().min(1, 'Zone code is required'),
  zoneType: z.enum(['civil', 'mechanical', 'electrical', 'scrap', 'container', 'open_yard', 'hazardous']),
  capacity: z.number().int().optional(),
});

export const warehouseZoneUpdateSchema = z.object({
  zoneName: z.string().optional(),
  zoneType: z.enum(['civil', 'mechanical', 'electrical', 'scrap', 'container', 'open_yard', 'hazardous']).optional(),
  capacity: z.number().int().optional(),
  currentOccupancy: z.number().int().optional(),
});

// ── Approval Action ─────────────────────────────────────────────────────

export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
});
