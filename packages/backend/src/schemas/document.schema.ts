import { z } from 'zod';

const uuid = z.string().uuid();
const decimalPositive = z.number().positive();
const decimalNonNegative = z.number().min(0);

// ── MRRV ────────────────────────────────────────────────────────────────

const mrrvLineSchema = z.object({
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

export const mrrvCreateSchema = z.object({
  supplierId: uuid,
  poNumber: z.string().optional(),
  warehouseId: uuid,
  projectId: uuid.optional(),
  receiveDate: z.string().datetime(),
  invoiceNumber: z.string().optional(),
  deliveryNote: z.string().optional(),
  rfimRequired: z.boolean().optional(),
  notes: z.string().optional(),
  lines: z.array(mrrvLineSchema).min(1, 'At least one line item is required'),
});

export const mrrvUpdateSchema = z.object({
  supplierId: uuid.optional(),
  poNumber: z.string().optional(),
  warehouseId: uuid.optional(),
  projectId: uuid.optional(),
  receiveDate: z.string().datetime().optional(),
  invoiceNumber: z.string().optional(),
  deliveryNote: z.string().optional(),
  rfimRequired: z.boolean().optional(),
  notes: z.string().optional(),
});

// ── MIRV ────────────────────────────────────────────────────────────────

const mirvLineSchema = z.object({
  itemId: uuid,
  qtyRequested: decimalPositive,
  notes: z.string().optional(),
});

export const mirvCreateSchema = z.object({
  projectId: uuid,
  warehouseId: uuid,
  locationOfWork: z.string().optional(),
  requestDate: z.string().datetime(),
  requiredDate: z.string().datetime().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  notes: z.string().optional(),
  lines: z.array(mirvLineSchema).min(1, 'At least one line item is required'),
});

export const mirvUpdateSchema = z.object({
  projectId: uuid.optional(),
  warehouseId: uuid.optional(),
  locationOfWork: z.string().optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().datetime().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).optional(),
  notes: z.string().optional(),
});

// ── MRV ─────────────────────────────────────────────────────────────────

const mrvLineSchema = z.object({
  itemId: uuid,
  qtyReturned: decimalPositive,
  uomId: uuid,
  condition: z.enum(['good', 'used', 'damaged']),
  notes: z.string().optional(),
});

export const mrvCreateSchema = z.object({
  returnType: z.enum(['return_to_warehouse', 'return_to_supplier', 'scrap', 'transfer_to_project']),
  projectId: uuid,
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid,
  returnDate: z.string().datetime(),
  reason: z.string().min(1, 'Return reason is required'),
  originalMirvId: uuid.optional(),
  notes: z.string().optional(),
  lines: z.array(mrvLineSchema).min(1, 'At least one line item is required'),
});

export const mrvUpdateSchema = z.object({
  returnType: z.enum(['return_to_warehouse', 'return_to_supplier', 'scrap', 'transfer_to_project']).optional(),
  projectId: uuid.optional(),
  fromWarehouseId: uuid.optional(),
  toWarehouseId: uuid.optional(),
  returnDate: z.string().datetime().optional(),
  reason: z.string().optional(),
  originalMirvId: uuid.optional(),
  notes: z.string().optional(),
});

// ── RFIM ────────────────────────────────────────────────────────────────

export const rfimUpdateSchema = z.object({
  inspectorId: uuid.optional(),
  result: z.enum(['pass', 'fail', 'conditional']).optional(),
  comments: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

// ── OSD ─────────────────────────────────────────────────────────────────

const osdLineSchema = z.object({
  itemId: uuid,
  uomId: uuid,
  mrrvLineId: uuid.optional(),
  qtyInvoice: decimalNonNegative,
  qtyReceived: decimalNonNegative,
  qtyDamaged: decimalNonNegative.optional(),
  damageType: z.enum(['physical', 'water', 'missing_parts', 'wrong_item', 'expired', 'other']).optional(),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
});

export const osdCreateSchema = z.object({
  mrrvId: uuid,
  poNumber: z.string().optional(),
  supplierId: uuid.optional(),
  warehouseId: uuid.optional(),
  reportDate: z.string().datetime(),
  reportTypes: z.array(z.string()).min(1, 'At least one report type is required'),
  notes: z.string().optional(),
  lines: z.array(osdLineSchema).min(1, 'At least one line item is required'),
});

export const osdUpdateSchema = z.object({
  poNumber: z.string().optional(),
  supplierId: uuid.optional(),
  warehouseId: uuid.optional(),
  reportDate: z.string().datetime().optional(),
  reportTypes: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ── Approval Action ─────────────────────────────────────────────────────

export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
});
