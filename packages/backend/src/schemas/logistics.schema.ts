import { z } from 'zod';

const uuid = z.string().uuid();
const decimalPositive = z.number().positive();
const decimalNonNegative = z.number().min(0);

// ── Gate Pass ─────────────────────────────────────────────────────────

const gatePassItemSchema = z.object({
  itemId: uuid,
  quantity: decimalPositive,
  uomId: uuid,
  description: z.string().optional(),
});

export const gatePassCreateSchema = z.object({
  passType: z.enum(['inbound', 'outbound', 'transfer']),
  mirvId: uuid.optional(),
  projectId: uuid.optional(),
  warehouseId: uuid,
  vehicleNumber: z.string().min(1),
  driverName: z.string().min(1),
  driverIdNumber: z.string().optional(),
  destination: z.string().min(1),
  purpose: z.string().optional(),
  issueDate: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(gatePassItemSchema).min(1, 'At least one item is required'),
});

export const gatePassUpdateSchema = z.object({
  passType: z.enum(['inbound', 'outbound', 'transfer']).optional(),
  mirvId: uuid.optional(),
  projectId: uuid.optional(),
  warehouseId: uuid.optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverIdNumber: z.string().optional(),
  destination: z.string().optional(),
  purpose: z.string().optional(),
  issueDate: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ── MRF ───────────────────────────────────────────────────────────────

const mrfLineSchema = z.object({
  itemId: uuid.optional(),
  itemDescription: z.string().optional(),
  category: z.string().optional(),
  qtyRequested: decimalPositive,
  uomId: uuid.optional(),
  source: z.enum(['from_stock', 'purchase_required', 'both', 'tbd']).optional(),
  notes: z.string().optional(),
});

export const mrfCreateSchema = z.object({
  requestDate: z.string().datetime(),
  requiredDate: z.string().optional(),
  projectId: uuid,
  department: z.enum(['electrical', 'mechanical', 'civil', 'safety', 'general']).optional(),
  deliveryPoint: z.string().optional(),
  workOrder: z.string().optional(),
  drawingReference: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  notes: z.string().optional(),
  lines: z.array(mrfLineSchema).min(1, 'At least one line item is required'),
});

export const mrfUpdateSchema = z.object({
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().optional(),
  projectId: uuid.optional(),
  department: z.enum(['electrical', 'mechanical', 'civil', 'safety', 'general']).optional(),
  deliveryPoint: z.string().optional(),
  workOrder: z.string().optional(),
  drawingReference: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  notes: z.string().optional(),
});

// ── Stock Transfer ────────────────────────────────────────────────────

const stockTransferLineSchema = z.object({
  itemId: uuid,
  quantity: decimalPositive,
  uomId: uuid,
  condition: z.enum(['good', 'used', 'damaged']).optional(),
});

export const stockTransferCreateSchema = z.object({
  transferType: z.enum([
    'warehouse_to_warehouse',
    'project_to_project',
    'warehouse_to_project',
    'project_to_warehouse',
  ]),
  fromWarehouseId: uuid,
  toWarehouseId: uuid,
  fromProjectId: uuid.optional(),
  toProjectId: uuid.optional(),
  transferDate: z.string().datetime(),
  notes: z.string().optional(),
  lines: z.array(stockTransferLineSchema).min(1, 'At least one line item is required'),
});

export const stockTransferUpdateSchema = z.object({
  transferType: z.enum([
    'warehouse_to_warehouse',
    'project_to_project',
    'warehouse_to_project',
    'project_to_warehouse',
  ]).optional(),
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid.optional(),
  fromProjectId: uuid.optional(),
  toProjectId: uuid.optional(),
  transferDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ── Shipment ──────────────────────────────────────────────────────────

const shipmentLineSchema = z.object({
  itemId: uuid.optional(),
  description: z.string().min(1),
  quantity: decimalPositive,
  uomId: uuid.optional(),
  unitValue: decimalNonNegative.optional(),
  hsCode: z.string().optional(),
});

export const shipmentCreateSchema = z.object({
  poNumber: z.string().optional(),
  supplierId: uuid,
  freightForwarderId: uuid.optional(),
  projectId: uuid.optional(),
  originCountry: z.string().optional(),
  modeOfShipment: z.enum(['sea_fcl', 'sea_lcl', 'air', 'land', 'courier']),
  portOfLoading: z.string().optional(),
  portOfEntryId: uuid.optional(),
  destinationWarehouseId: uuid.optional(),
  orderDate: z.string().optional(),
  expectedShipDate: z.string().optional(),
  awbBlNumber: z.string().optional(),
  containerNumber: z.string().optional(),
  vesselFlight: z.string().optional(),
  trackingUrl: z.string().optional(),
  commercialValue: decimalNonNegative.optional(),
  freightCost: decimalNonNegative.optional(),
  insuranceCost: decimalNonNegative.optional(),
  dutiesEstimated: decimalNonNegative.optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(shipmentLineSchema).min(1, 'At least one line item is required'),
});

export const shipmentUpdateSchema = z.object({
  poNumber: z.string().optional(),
  supplierId: uuid.optional(),
  freightForwarderId: uuid.optional(),
  projectId: uuid.optional(),
  originCountry: z.string().optional(),
  modeOfShipment: z.enum(['sea_fcl', 'sea_lcl', 'air', 'land', 'courier']).optional(),
  portOfLoading: z.string().optional(),
  portOfEntryId: uuid.optional(),
  destinationWarehouseId: uuid.optional(),
  orderDate: z.string().optional(),
  expectedShipDate: z.string().optional(),
  actualShipDate: z.string().optional(),
  etaPort: z.string().optional(),
  actualArrivalDate: z.string().optional(),
  awbBlNumber: z.string().optional(),
  containerNumber: z.string().optional(),
  vesselFlight: z.string().optional(),
  trackingUrl: z.string().optional(),
  commercialValue: decimalNonNegative.optional(),
  freightCost: decimalNonNegative.optional(),
  insuranceCost: decimalNonNegative.optional(),
  dutiesEstimated: decimalNonNegative.optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

// ── Shipment Status ───────────────────────────────────────────────────

export const shipmentStatusSchema = z.object({
  status: z.enum([
    'draft', 'po_issued', 'in_production', 'ready_to_ship', 'in_transit',
    'at_port', 'customs_clearing', 'cleared', 'in_delivery', 'delivered', 'cancelled',
  ]),
  actualShipDate: z.string().optional(),
  etaPort: z.string().optional(),
  actualArrivalDate: z.string().optional(),
});

// ── Customs Tracking ──────────────────────────────────────────────────

export const customsStageSchema = z.object({
  stage: z.enum([
    'docs_submitted',
    'declaration_filed',
    'under_inspection',
    'awaiting_payment',
    'duties_paid',
    'ready_for_release',
    'released',
    'on_hold',
    'rejected',
  ]),
  stageDate: z.string().datetime(),
  customsDeclaration: z.string().optional(),
  customsRef: z.string().optional(),
  inspectorName: z.string().optional(),
  inspectionType: z.enum([
    'document_review',
    'xray_scan',
    'physical_inspection',
    'lab_testing',
    'green_channel',
  ]).optional(),
  dutiesAmount: decimalNonNegative.optional(),
  vatAmount: decimalNonNegative.optional(),
  otherFees: decimalNonNegative.optional(),
  paymentStatus: z.enum([
    'pending_calculation',
    'awaiting_payment',
    'paid',
    'refund_pending',
  ]).optional(),
  issues: z.string().optional(),
  resolution: z.string().optional(),
});

export const customsStageUpdateSchema = customsStageSchema.partial();
