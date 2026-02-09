import { z } from 'zod';

const uuid = z.string().uuid();
const decimalPositive = z.number().positive();
const decimalNonNegative = z.number().min(0);

// ── JO Type Enum ──────────────────────────────────────────────────────

const joTypeEnum = z.enum([
  'transport',
  'equipment',
  'rental_monthly',
  'rental_daily',
  'scrap',
  'generator_rental',
  'generator_maintenance',
]);

const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

// ── Transport Detail ──────────────────────────────────────────────────

export const transportDetailSchema = z.object({
  pickupLocation: z.string().min(1),
  pickupLocationUrl: z.string().optional(),
  pickupContactName: z.string().optional(),
  pickupContactPhone: z.string().optional(),
  deliveryLocation: z.string().min(1),
  deliveryLocationUrl: z.string().optional(),
  deliveryContactName: z.string().optional(),
  deliveryContactPhone: z.string().optional(),
  cargoType: z.string().min(1),
  cargoWeightTons: decimalNonNegative.optional(),
  numberOfTrailers: z.number().int().optional(),
  numberOfTrips: z.number().int().optional(),
  includeLoadingEquipment: z.boolean().optional(),
  loadingEquipmentType: z.string().optional(),
  insuranceRequired: z.boolean().optional(),
  materialPriceSar: decimalNonNegative.optional(),
});

// ── Rental Detail ─────────────────────────────────────────────────────

export const rentalDetailSchema = z.object({
  rentalStartDate: z.string().datetime(),
  rentalEndDate: z.string().datetime(),
  monthlyRate: decimalNonNegative.optional(),
  dailyRate: decimalNonNegative.optional(),
  withOperator: z.boolean().optional(),
  overtimeHours: decimalNonNegative.optional(),
  overtimeApproved: z.boolean().optional(),
});

// ── Generator Detail ──────────────────────────────────────────────────

export const generatorDetailSchema = z.object({
  generatorId: uuid.optional(),
  capacityKva: z.number().int().optional(),
  maintenanceType: z.enum(['preventive', 'corrective', 'emergency']).optional(),
  issueDescription: z.string().optional(),
  shiftStartTime: z.string().optional(),
});

// ── Scrap Detail ──────────────────────────────────────────────────────

export const scrapDetailSchema = z.object({
  scrapType: z.string().min(1),
  scrapWeightTons: decimalPositive,
  scrapDescription: z.string().optional(),
  scrapDestination: z.string().optional(),
  materialPriceSar: decimalNonNegative.optional(),
});

// ── Equipment Line ────────────────────────────────────────────────────

export const equipmentLineSchema = z.object({
  equipmentTypeId: uuid,
  quantity: z.number().int().positive(),
  withOperator: z.boolean().optional(),
  siteLocation: z.string().optional(),
  dailyRate: decimalNonNegative.optional(),
  durationDays: z.number().int().optional(),
});

// ── JO Base ───────────────────────────────────────────────────────────

const joBaseFields = {
  joType: joTypeEnum,
  entityId: uuid.optional(),
  projectId: uuid,
  supplierId: uuid.optional(),
  requestDate: z.string().datetime(),
  requiredDate: z.string().optional(),
  priority: priorityEnum.optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  totalAmount: decimalNonNegative.optional(),
};

// ── Create Schema ─────────────────────────────────────────────────────

export const joCreateSchema = z.object({
  ...joBaseFields,
  transportDetails: transportDetailSchema.optional(),
  rentalDetails: rentalDetailSchema.optional(),
  generatorDetails: generatorDetailSchema.optional(),
  scrapDetails: scrapDetailSchema.optional(),
  equipmentLines: z.array(equipmentLineSchema).optional(),
});

// ── Update Schema ─────────────────────────────────────────────────────

export const joUpdateSchema = z.object({
  entityId: uuid.optional(),
  projectId: uuid.optional(),
  supplierId: uuid.optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().optional(),
  priority: priorityEnum.optional(),
  description: z.string().min(1).optional(),
  notes: z.string().optional(),
  totalAmount: decimalNonNegative.optional(),
});

// ── Approval Schema ───────────────────────────────────────────────────

export const joApprovalSchema = z.object({
  approved: z.boolean(),
  quoteAmount: decimalNonNegative.optional(),
  comments: z.string().optional(),
});

// ── Payment Schema ────────────────────────────────────────────────────

export const joPaymentSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceReceiptDate: z.string().datetime().optional(),
  costExclVat: decimalNonNegative.optional(),
  vatAmount: decimalNonNegative.optional(),
  grandTotal: decimalNonNegative.optional(),
  paymentStatus: z.enum(['pending', 'approved', 'paid', 'disputed']).optional(),
  oracleVoucher: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

// ── SLA Schema ────────────────────────────────────────────────────────

export const joSlaSchema = z.object({
  slaDueDate: z.string().datetime().optional(),
  slaResponseHours: z.number().int().optional(),
  slaBusinessDays: z.number().int().optional(),
});
