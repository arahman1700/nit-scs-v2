import { z } from 'zod';

const uuid = z.string().uuid();
const decimalPositive = z.number().positive();
const decimalNonNegative = z.number().min(0);

// ── Gate Pass ─────────────────────────────────────────────────────────

const gatePassItemSchema = z.object({
  itemId: uuid,
  quantity: decimalPositive,
  uomId: uuid,
  description: z.string().max(500).optional(),
});

export const gatePassCreateSchema = z.object({
  passType: z.enum(['inbound', 'outbound', 'transfer']),
  mirvId: uuid.optional(),
  projectId: uuid.optional(),
  warehouseId: uuid,
  vehicleNumber: z.string().min(1).max(30),
  driverName: z.string().min(1).max(255),
  driverIdNumber: z.string().max(50).optional(),
  destination: z.string().min(1).max(500),
  purpose: z.string().max(500).optional(),
  issueDate: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(gatePassItemSchema).min(1, 'At least one item is required'),
});

export const gatePassUpdateSchema = z.object({
  passType: z.enum(['inbound', 'outbound', 'transfer']).optional(),
  mirvId: uuid.optional(),
  projectId: uuid.optional(),
  warehouseId: uuid.optional(),
  vehicleNumber: z.string().max(30).optional(),
  driverName: z.string().max(255).optional(),
  driverIdNumber: z.string().max(50).optional(),
  destination: z.string().max(500).optional(),
  purpose: z.string().max(500).optional(),
  issueDate: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

// ── MRF ───────────────────────────────────────────────────────────────

const mrfLineSchema = z.object({
  itemId: uuid.optional(),
  itemDescription: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  qtyRequested: decimalPositive,
  uomId: uuid.optional(),
  source: z.enum(['from_stock', 'purchase_required', 'both', 'tbd']).optional(),
  notes: z.string().max(2000).optional(),
});

export const mrfCreateSchema = z.object({
  requestDate: z.string().datetime(),
  requiredDate: z.string().max(50).optional(),
  projectId: uuid,
  department: z.enum(['electrical', 'mechanical', 'civil', 'safety', 'general']).optional(),
  deliveryPoint: z.string().max(255).optional(),
  workOrder: z.string().max(50).optional(),
  drawingReference: z.string().max(100).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(mrfLineSchema).min(1, 'At least one line item is required'),
});

export const mrfUpdateSchema = z.object({
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().max(50).optional(),
  projectId: uuid.optional(),
  department: z.enum(['electrical', 'mechanical', 'civil', 'safety', 'general']).optional(),
  deliveryPoint: z.string().max(255).optional(),
  workOrder: z.string().max(50).optional(),
  drawingReference: z.string().max(100).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(0).optional(),
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
  notes: z.string().max(2000).optional(),
  lines: z.array(stockTransferLineSchema).min(1, 'At least one line item is required'),
});

export const stockTransferUpdateSchema = z.object({
  transferType: z
    .enum(['warehouse_to_warehouse', 'project_to_project', 'warehouse_to_project', 'project_to_warehouse'])
    .optional(),
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid.optional(),
  fromProjectId: uuid.optional(),
  toProjectId: uuid.optional(),
  transferDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(0).optional(),
});

// ── Shipment ──────────────────────────────────────────────────────────

const shipmentLineSchema = z.object({
  itemId: uuid.optional(),
  description: z.string().min(1).max(500),
  quantity: decimalPositive,
  uomId: uuid.optional(),
  unitValue: decimalNonNegative.optional(),
  hsCode: z.string().max(20).optional(),
});

export const shipmentCreateSchema = z.object({
  poNumber: z.string().max(50).optional(),
  supplierId: uuid,
  freightForwarderId: uuid.optional(),
  projectId: uuid.optional(),
  originCountry: z.string().max(100).optional(),
  modeOfShipment: z.enum(['sea_fcl', 'sea_lcl', 'air', 'land', 'courier']),
  portOfLoading: z.string().max(255).optional(),
  portOfEntryId: uuid.optional(),
  destinationWarehouseId: uuid.optional(),
  orderDate: z.string().max(50).optional(),
  expectedShipDate: z.string().max(50).optional(),
  awbBlNumber: z.string().max(100).optional(),
  containerNumber: z.string().max(100).optional(),
  vesselFlight: z.string().max(255).optional(),
  trackingUrl: z.string().max(2000).optional(),
  commercialValue: decimalNonNegative.optional(),
  freightCost: decimalNonNegative.optional(),
  insuranceCost: decimalNonNegative.optional(),
  dutiesEstimated: decimalNonNegative.optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(shipmentLineSchema).min(1, 'At least one line item is required'),
});

export const shipmentUpdateSchema = z.object({
  poNumber: z.string().max(50).optional(),
  supplierId: uuid.optional(),
  freightForwarderId: uuid.optional(),
  projectId: uuid.optional(),
  originCountry: z.string().max(100).optional(),
  modeOfShipment: z.enum(['sea_fcl', 'sea_lcl', 'air', 'land', 'courier']).optional(),
  portOfLoading: z.string().max(255).optional(),
  portOfEntryId: uuid.optional(),
  destinationWarehouseId: uuid.optional(),
  orderDate: z.string().max(50).optional(),
  expectedShipDate: z.string().max(50).optional(),
  actualShipDate: z.string().max(50).optional(),
  etaPort: z.string().max(50).optional(),
  actualArrivalDate: z.string().max(50).optional(),
  awbBlNumber: z.string().max(100).optional(),
  containerNumber: z.string().max(100).optional(),
  vesselFlight: z.string().max(255).optional(),
  trackingUrl: z.string().max(2000).optional(),
  commercialValue: decimalNonNegative.optional(),
  freightCost: decimalNonNegative.optional(),
  insuranceCost: decimalNonNegative.optional(),
  dutiesEstimated: decimalNonNegative.optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

// ── Shipment Status ───────────────────────────────────────────────────

export const shipmentStatusSchema = z.object({
  status: z.enum([
    'draft',
    'po_issued',
    'in_production',
    'ready_to_ship',
    'in_transit',
    'at_port',
    'customs_clearing',
    'cleared',
    'in_delivery',
    'delivered',
    'cancelled',
  ]),
  actualShipDate: z.string().max(50).optional(),
  etaPort: z.string().max(50).optional(),
  actualArrivalDate: z.string().max(50).optional(),
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
  customsDeclaration: z.string().max(50).optional(),
  customsRef: z.string().max(50).optional(),
  inspectorName: z.string().max(255).optional(),
  inspectionType: z
    .enum(['document_review', 'xray_scan', 'physical_inspection', 'lab_testing', 'green_channel'])
    .optional(),
  dutiesAmount: decimalNonNegative.optional(),
  vatAmount: decimalNonNegative.optional(),
  otherFees: decimalNonNegative.optional(),
  paymentStatus: z.enum(['pending_calculation', 'awaiting_payment', 'paid', 'refund_pending']).optional(),
  issues: z.string().max(2000).optional(),
  resolution: z.string().max(1000).optional(),
});

export const customsStageUpdateSchema = customsStageSchema.partial();

// ── Transport Order (SOW M2-F03 — H9) ───────────────────────────────

const transportOrderItemSchema = z.object({
  itemId: uuid.optional(),
  description: z.string().min(1).max(500),
  quantity: decimalPositive,
  uomId: uuid.optional(),
  weight: decimalNonNegative.optional(),
});

export const transportOrderCreateSchema = z.object({
  jobOrderId: uuid.optional(),
  originWarehouseId: uuid,
  destinationWarehouseId: uuid.optional(),
  destinationAddress: z.string().max(500).optional(),
  projectId: uuid.optional(),
  loadDescription: z.string().min(1).max(2000),
  vehicleType: z.string().max(100).optional(),
  vehicleNumber: z.string().max(30).optional(),
  driverName: z.string().max(255).optional(),
  driverPhone: z.string().max(100).optional(),
  driverIdNumber: z.string().max(50).optional(),
  scheduledDate: z.string().datetime(),
  estimatedWeight: decimalNonNegative.optional(),
  gatePassId: uuid.optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(transportOrderItemSchema).min(1, 'At least one item is required'),
});

export const transportOrderUpdateSchema = z.object({
  jobOrderId: uuid.optional(),
  originWarehouseId: uuid.optional(),
  destinationWarehouseId: uuid.optional(),
  destinationAddress: z.string().max(500).optional(),
  projectId: uuid.optional(),
  loadDescription: z.string().max(2000).optional(),
  vehicleType: z.string().max(100).optional(),
  vehicleNumber: z.string().max(30).optional(),
  driverName: z.string().max(255).optional(),
  driverPhone: z.string().max(100).optional(),
  driverIdNumber: z.string().max(50).optional(),
  scheduledDate: z.string().datetime().optional(),
  estimatedWeight: decimalNonNegative.optional(),
  gatePassId: uuid.optional(),
  notes: z.string().max(2000).optional(),
});
