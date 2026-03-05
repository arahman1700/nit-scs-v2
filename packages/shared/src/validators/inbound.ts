import type { VoucherLineItem } from '../types/materials.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

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

  if (
    (!data.supplier || !(data.supplier as string).trim()) &&
    (!data.supplierId || !(data.supplierId as string).trim())
  ) {
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
