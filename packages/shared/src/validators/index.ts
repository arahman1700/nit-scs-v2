import type { VoucherLineItem } from '../types/materials.js';
import { INSURANCE_THRESHOLD_SAR, SLA_HOURS } from '../constants/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  rule: string;
  message: string;
}

// ── GRN Validators (was MRRV) ───────────────────────────────────────────

export function validateGRN(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (data.date && new Date(data.date as string) > new Date()) {
    errors.push({ field: 'date', rule: 'GRN-V001', message: 'Receipt date cannot be in the future' });
  }

  if (data.date) {
    const daysDiff = Math.floor((Date.now() - new Date(data.date as string).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) {
      warnings.push({
        field: 'date',
        rule: 'GRN-V002',
        message: `Receipt date is ${daysDiff} days old — requires supervisor approval`,
      });
    }
  }

  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'GRN-V003', message: 'At least one line item is required' });
  }

  if (!data.poNumber || !(data.poNumber as string).trim()) {
    errors.push({ field: 'poNumber', rule: 'GRN-V004', message: 'PO Number is required' });
  }

  if (!data.supplier || !(data.supplier as string).trim()) {
    errors.push({ field: 'supplier', rule: 'GRN-V005', message: 'Supplier is required' });
  }

  lineItems.forEach((item, idx) => {
    if (item.qtyExpected && item.qtyReceived) {
      const overPct = ((item.qtyReceived - item.qtyExpected) / item.qtyExpected) * 100;
      if (overPct > 10) {
        warnings.push({
          field: `lineItems[${idx}]`,
          rule: 'GRN-V006',
          message: `Over-delivery of ${overPct.toFixed(1)}% on ${item.itemName} (tolerance: 10%)`,
        });
      }
    }
    if (item.condition === 'Damaged') {
      warnings.push({
        field: `lineItems[${idx}]`,
        rule: 'GRN-AUTO1',
        message: `Damaged item "${item.itemName}" — QCI will be auto-created`,
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ── MI Validators (was MIRV) ────────────────────────────────────────────

export function validateMI(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'MI-V001', message: 'At least one line item is required' });
  }

  if (!data.project || !(data.project as string).trim()) {
    errors.push({ field: 'project', rule: 'MI-V002', message: 'Project is required' });
  }

  if (!data.warehouse || !(data.warehouse as string).trim()) {
    errors.push({ field: 'warehouse', rule: 'MI-V003', message: 'Warehouse is required' });
  }

  lineItems.forEach((item, idx) => {
    if (item.qtyAvailable !== undefined && item.quantity > item.qtyAvailable) {
      errors.push({
        field: `lineItems[${idx}]`,
        rule: 'MI-V004',
        message: `Insufficient stock for ${item.itemName}: requested ${item.quantity}, available ${item.qtyAvailable}`,
      });
    }
    if (item.qtyApproved !== undefined && item.qtyIssued !== undefined && item.qtyIssued > item.qtyApproved) {
      errors.push({
        field: `lineItems[${idx}]`,
        rule: 'MI-V005',
        message: `Issued qty (${item.qtyIssued}) exceeds approved qty (${item.qtyApproved}) for ${item.itemName}`,
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ── MRN Validators (was MRV) ────────────────────────────────────────────

export function validateMRN(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.returnType) {
    errors.push({ field: 'returnType', rule: 'MRN-V001', message: 'Return type is required' });
  }
  if (!data.project || !(data.project as string).trim()) {
    errors.push({ field: 'project', rule: 'MRN-V002', message: 'Project is required' });
  }
  if (!data.reason || !(data.reason as string).trim()) {
    errors.push({ field: 'reason', rule: 'MRN-V003', message: 'Return reason is required' });
  }
  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'MRN-V004', message: 'At least one line item is required' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── QCI Validators (was RFIM) ───────────────────────────────────────────

export function validateQCI(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.grnId || !(data.grnId as string).trim()) {
    errors.push({ field: 'grnId', rule: 'QCI-V001', message: 'GRN Reference is required' });
  }

  if (!data.inspectionType || !(data.inspectionType as string).trim()) {
    errors.push({ field: 'inspectionType', rule: 'QCI-V002', message: 'Inspection type is required' });
  }

  if (!data.priority || !(data.priority as string).trim()) {
    errors.push({ field: 'priority', rule: 'QCI-V003', message: 'Priority is required' });
  }

  if (!data.itemsDescription || !(data.itemsDescription as string).trim()) {
    errors.push({ field: 'itemsDescription', rule: 'QCI-V004', message: 'Items description is required' });
  }

  if (
    data.inspectionDate &&
    new Date(data.inspectionDate as string) < new Date(new Date().toISOString().split('T')[0])
  ) {
    warnings.push({ field: 'inspectionDate', rule: 'QCI-V005', message: 'Inspection date is in the past' });
  }

  if (data.priority === 'Critical') {
    warnings.push({
      field: 'priority',
      rule: 'QCI-V006',
      message: 'Critical priority inspections require QC Manager approval',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── DR Validators (was OSD) ─────────────────────────────────────────────

export function validateDR(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.grnId || !(data.grnId as string).trim()) {
    errors.push({ field: 'grnId', rule: 'DR-V001', message: 'GRN Reference is required' });
  }

  if (!data.reportType || !(data.reportType as string).trim()) {
    errors.push({ field: 'reportType', rule: 'DR-V002', message: 'Issue type is required' });
  }

  if (!data.qtyAffected || Number(data.qtyAffected) <= 0) {
    errors.push({ field: 'qtyAffected', rule: 'DR-V003', message: 'Quantity affected must be greater than zero' });
  }

  if (!data.description || !(data.description as string).trim()) {
    errors.push({ field: 'description', rule: 'DR-V004', message: 'Description is required' });
  }

  if (!data.actionRequired || !(data.actionRequired as string).trim()) {
    errors.push({ field: 'actionRequired', rule: 'DR-V005', message: 'Required action must be specified' });
  }

  if (data.reportType === 'Damage' && !data.attachments) {
    warnings.push({
      field: 'attachments',
      rule: 'DR-V006',
      message: 'Photographic evidence is recommended for damage reports',
    });
  }

  if (data.actionRequired === 'Claim Insurance') {
    warnings.push({
      field: 'actionRequired',
      rule: 'DR-V007',
      message: 'Insurance claims require supporting documentation and photos',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── MR Validators (enhanced from MRF) ───────────────────────────────────

export function validateMR(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.project || !(data.project as string).trim()) {
    errors.push({ field: 'project', rule: 'MR-V001', message: 'Project is required' });
  }

  if (!data.requestedBy || !(data.requestedBy as string).trim()) {
    errors.push({ field: 'requestedBy', rule: 'MR-V002', message: 'Requester is required' });
  }

  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'MR-V003', message: 'At least one line item is required' });
  }

  if (!data.priority || !(data.priority as string).trim()) {
    errors.push({ field: 'priority', rule: 'MR-V004', message: 'Priority is required' });
  }

  if (!data.requiredDate) {
    errors.push({ field: 'requiredDate', rule: 'MR-V005', message: 'Required date is required' });
  }

  lineItems.forEach((item, idx) => {
    if (!item.quantity || item.quantity <= 0) {
      errors.push({
        field: `lineItems[${idx}].quantity`,
        rule: 'MR-V006',
        message: `Quantity must be greater than zero for ${item.itemName}`,
      });
    }
    if (!item.itemCode || !item.itemCode.trim()) {
      errors.push({
        field: `lineItems[${idx}].itemCode`,
        rule: 'MR-V010',
        message: `Item code must exist in master catalog for ${item.itemName}`,
      });
    }
  });

  if (data.stockVerifiedAt) {
    const verifiedAt = new Date(data.stockVerifiedAt as string).getTime();
    const now = Date.now();
    const hoursSince = (now - verifiedAt) / (1000 * 60 * 60);
    if (hoursSince > SLA_HOURS.stock_verification) {
      warnings.push({
        field: 'stockVerifiedAt',
        rule: 'MR-V011',
        message: `Stock verification is stale (${Math.floor(hoursSince)}h old, SLA: ${SLA_HOURS.stock_verification}h)`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── JO Validators (enhanced) ────────────────────────────────────────────

export function validateJO(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.joType && !data.type) {
    errors.push({ field: 'joType', rule: 'JO-V001', message: 'Job Order type is required' });
  }
  if (!data.project || !(data.project as string).trim()) {
    errors.push({ field: 'project', rule: 'JO-V002', message: 'Project is required' });
  }

  const type = (data.joType || data.type) as string;
  if (type === 'Transport') {
    if (!data.cargoType || !(data.cargoType as string).trim()) {
      errors.push({ field: 'cargoType', rule: 'JO-V003', message: 'Cargo type is required for transport' });
    }
    if (!data.cargoWeight && !data.cargoWeightTons) {
      errors.push({ field: 'cargoWeight', rule: 'JO-V004', message: 'Cargo weight is required for transport' });
    }
  }
  if (type === 'Scrap') {
    if (!data.scrapType || !(data.scrapType as string).trim()) {
      errors.push({ field: 'scrapType', rule: 'JO-V005', message: 'Scrap type is required' });
    }
    if (!data.weightTons && !data.scrapWeightTons) {
      errors.push({ field: 'weightTons', rule: 'JO-V006', message: 'Scrap weight is required' });
    }
  }

  // Insurance required if value exceeds threshold
  const value = Number(data.value || data.estimatedValue || 0);
  if (value > INSURANCE_THRESHOLD_SAR && !data.insurancePolicyId) {
    errors.push({
      field: 'insurancePolicyId',
      rule: 'JO-V010',
      message: `Insurance is required for JOs exceeding ${INSURANCE_THRESHOLD_SAR.toLocaleString()} SAR`,
    });
  }

  // Monthly rentals require COO approval
  if (type === 'Rental_Monthly' || type === 'rental_monthly') {
    warnings.push({
      field: 'joType',
      rule: 'JO-V011',
      message: 'Monthly rental JOs require COO approval',
    });
  }

  // Budget NO requires additional approval
  if (data.budgetAvailable === false || data.budgetStatus === 'no') {
    warnings.push({
      field: 'budgetAvailable',
      rule: 'JO-V012',
      message: 'No budget available — additional approval required from finance',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── IMSF Validators ─────────────────────────────────────────────────────

export function validateIMSF(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.senderProjectId || !(data.senderProjectId as string).trim()) {
    errors.push({ field: 'senderProjectId', rule: 'IMSF-V001', message: 'Sender project is required' });
  }

  if (!data.receiverProjectId || !(data.receiverProjectId as string).trim()) {
    errors.push({ field: 'receiverProjectId', rule: 'IMSF-V002', message: 'Receiver project is required' });
  }

  if (data.senderProjectId && data.receiverProjectId && data.senderProjectId === data.receiverProjectId) {
    errors.push({
      field: 'receiverProjectId',
      rule: 'IMSF-V003',
      message: 'Sender and receiver projects must be different',
    });
  }

  if (!data.materialType || !(data.materialType as string).trim()) {
    errors.push({ field: 'materialType', rule: 'IMSF-V004', message: 'Material type is required' });
  }

  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'IMSF-V005', message: 'At least one line item is required' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Scrap Validators ────────────────────────────────────────────────────

export function validateScrap(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.materialType || !(data.materialType as string).trim()) {
    errors.push({ field: 'materialType', rule: 'SCRAP-V001', message: 'Material type is required' });
  }

  if (!data.warehouseId || !(data.warehouseId as string).trim()) {
    errors.push({ field: 'warehouseId', rule: 'SCRAP-V002', message: 'Warehouse is required' });
  }

  if (!data.estimatedWeight || Number(data.estimatedWeight) <= 0) {
    errors.push({
      field: 'estimatedWeight',
      rule: 'SCRAP-V003',
      message: 'Estimated weight must be greater than zero',
    });
  }

  if (!data.photos || !(data.photos as string[]).length) {
    errors.push({ field: 'photos', rule: 'SCRAP-V001', message: 'Photos are required for scrap identification' });
  }

  if (data.buyerPickupDate) {
    const pickupDate = new Date(data.buyerPickupDate as string).getTime();
    const now = Date.now();
    const daysDiff = (pickupDate - now) / (1000 * 60 * 60 * 24);
    if (daysDiff > SLA_HOURS.scrap_buyer_pickup / 24) {
      warnings.push({
        field: 'buyerPickupDate',
        rule: 'SCRAP-V002',
        message: `Buyer pickup date exceeds ${SLA_HOURS.scrap_buyer_pickup / 24}-day SLA`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Surplus Validators ──────────────────────────────────────────────────

export function validateSurplus(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.itemId || !(data.itemId as string).trim()) {
    errors.push({ field: 'itemId', rule: 'SURPLUS-V001', message: 'Item is required' });
  }

  if (!data.warehouseId || !(data.warehouseId as string).trim()) {
    errors.push({ field: 'warehouseId', rule: 'SURPLUS-V002', message: 'Warehouse is required' });
  }

  if (!data.qty || Number(data.qty) <= 0) {
    errors.push({ field: 'qty', rule: 'SURPLUS-V003', message: 'Quantity must be greater than zero' });
  }

  if (!data.condition || !(data.condition as string).trim()) {
    errors.push({ field: 'condition', rule: 'SURPLUS-V004', message: 'Condition is required' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Rental Contract Validators ──────────────────────────────────────────

export function validateRentalContract(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.supplierId || !(data.supplierId as string).trim()) {
    errors.push({ field: 'supplierId', rule: 'RC-V001', message: 'Supplier is required' });
  }

  if (!data.startDate) {
    errors.push({ field: 'startDate', rule: 'RC-V002', message: 'Start date is required' });
  }

  if (!data.endDate) {
    errors.push({ field: 'endDate', rule: 'RC-V003', message: 'End date is required' });
  }

  if (data.startDate && data.endDate && new Date(data.startDate as string) >= new Date(data.endDate as string)) {
    errors.push({ field: 'endDate', rule: 'RC-V004', message: 'End date must be after start date' });
  }

  if (!data.monthlyRate && !data.dailyRate) {
    errors.push({ field: 'monthlyRate', rule: 'RC-V005', message: 'Monthly rate or daily rate is required' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Generic ─────────────────────────────────────────────────────────────

export function validateRequired(
  data: Record<string, unknown>,
  fields: { key: string; label: string }[],
): ValidationError[] {
  return fields
    .filter(f => !data[f.key] || (typeof data[f.key] === 'string' && !(data[f.key] as string).trim()))
    .map(f => ({ field: f.key, rule: 'REQUIRED', message: `${f.label} is required` }));
}
