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
  pickupLocation: z.string().min(1).max(500),
  pickupLocationUrl: z.string().max(2000).optional(),
  pickupContactName: z.string().max(255).optional(),
  pickupContactPhone: z.string().max(100).optional(),
  deliveryLocation: z.string().min(1).max(500),
  deliveryLocationUrl: z.string().max(2000).optional(),
  deliveryContactName: z.string().max(255).optional(),
  deliveryContactPhone: z.string().max(100).optional(),
  cargoType: z.string().min(1).max(255),
  cargoWeightTons: decimalNonNegative.optional(),
  numberOfTrailers: z.number().int().optional(),
  numberOfTrips: z.number().int().optional(),
  includeLoadingEquipment: z.boolean().optional(),
  loadingEquipmentType: z.string().max(255).optional(),
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
  issueDescription: z.string().max(2000).optional(),
  shiftStartTime: z.string().max(50).optional(),
});

// ── Scrap Detail ──────────────────────────────────────────────────────

export const scrapDetailSchema = z.object({
  scrapType: z.string().min(1).max(255),
  scrapWeightTons: decimalPositive,
  scrapDescription: z.string().max(2000).optional(),
  scrapDestination: z.string().max(500).optional(),
  materialPriceSar: decimalNonNegative.optional(),
});

// ── Equipment Line ────────────────────────────────────────────────────

export const equipmentLineSchema = z.object({
  equipmentTypeId: uuid,
  quantity: z.number().int().positive(),
  withOperator: z.boolean().optional(),
  siteLocation: z.string().max(500).optional(),
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
  requiredDate: z.string().max(50).optional(),
  priority: priorityEnum.optional(),
  description: z.string().min(1).max(2000),
  notes: z.string().max(2000).optional(),
  totalAmount: decimalNonNegative.optional(),
  // Logistics Process V5 fields
  driverName: z.string().max(255).optional(),
  driverNationality: z.string().max(100).optional(),
  driverIdNumber: z.string().max(50).optional(),
  vehicleBrand: z.string().max(100).optional(),
  vehicleYear: z.number().int().optional(),
  vehiclePlate: z.string().max(30).optional(),
  googleMapsPickup: z.string().max(2000).optional(),
  googleMapsDelivery: z.string().max(2000).optional(),
  insuranceValue: decimalNonNegative.optional(),
  insuranceRequired: z.boolean().optional(),
  projectBudgetApproved: z.boolean().optional(),
  coaApprovalRequired: z.boolean().optional(),
  shiftStartTime: z.string().datetime().optional(),
  cnNumber: z.string().max(50).optional(),
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
  requiredDate: z.string().max(50).optional(),
  priority: priorityEnum.optional(),
  description: z.string().min(1).max(2000).optional(),
  notes: z.string().max(2000).optional(),
  totalAmount: decimalNonNegative.optional(),
  // Logistics Process V5 fields
  driverName: z.string().max(255).optional(),
  driverNationality: z.string().max(100).optional(),
  driverIdNumber: z.string().max(50).optional(),
  vehicleBrand: z.string().max(100).optional(),
  vehicleYear: z.number().int().optional(),
  vehiclePlate: z.string().max(30).optional(),
  googleMapsPickup: z.string().max(2000).optional(),
  googleMapsDelivery: z.string().max(2000).optional(),
  insuranceValue: decimalNonNegative.optional(),
  insuranceRequired: z.boolean().optional(),
  projectBudgetApproved: z.boolean().optional(),
  coaApprovalRequired: z.boolean().optional(),
  shiftStartTime: z.string().datetime().optional(),
  cnNumber: z.string().max(50).optional(),
  version: z.number().int().min(0).optional(),
});

// ── Approval Schema ───────────────────────────────────────────────────

export const joApprovalSchema = z.object({
  approved: z.boolean(),
  quoteAmount: decimalNonNegative.optional(),
  comments: z.string().max(2000).optional(),
});

// ── Payment Schema ────────────────────────────────────────────────────

export const joPaymentSchema = z.object({
  invoiceNumber: z.string().max(50).optional(),
  invoiceReceiptDate: z.string().datetime().optional(),
  costExclVat: decimalNonNegative.optional(),
  vatAmount: decimalNonNegative.optional(),
  grandTotal: decimalNonNegative.optional(),
  paymentStatus: z.enum(['pending', 'approved', 'paid', 'disputed']).optional(),
  oracleVoucher: z.string().max(50).optional(),
  attachmentUrl: z.string().max(2000).optional(),
});

// ── SLA Schema ────────────────────────────────────────────────────────

export const joSlaSchema = z.object({
  slaDueDate: z.string().datetime().optional(),
  slaResponseHours: z.number().int().optional(),
  slaBusinessDays: z.number().int().optional(),
});
