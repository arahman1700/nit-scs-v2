import type { VoucherLineItem } from '../types/materials.js';
import { SLA_HOURS } from '../constants/index.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

// ── MI Validators (was MIRV) ────────────────────────────────────────────

export function validateMI(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'MI-V001', message: 'At least one line item is required' });
  }

  if ((!data.project || !(data.project as string).trim()) && (!data.projectId || !(data.projectId as string).trim())) {
    errors.push({ field: 'project', rule: 'MI-V002', message: 'Project is required' });
  }

  if (
    (!data.warehouse || !(data.warehouse as string).trim()) &&
    (!data.warehouseId || !(data.warehouseId as string).trim())
  ) {
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
  if ((!data.project || !(data.project as string).trim()) && (!data.projectId || !(data.projectId as string).trim())) {
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

// ── MR Validators (enhanced from MRF) ───────────────────────────────────

export function validateMR(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if ((!data.project || !(data.project as string).trim()) && (!data.projectId || !(data.projectId as string).trim())) {
    errors.push({ field: 'project', rule: 'MR-V001', message: 'Project is required' });
  }

  if (
    (!data.requestedBy || !(data.requestedBy as string).trim()) &&
    (!data.requestedById || !(data.requestedById as string).trim())
  ) {
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
