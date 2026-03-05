import type { VoucherLineItem } from '../types/materials.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

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

// ── WT Validators (was StockTransfer) ───────────────────────────────────

export function validateWT(data: Record<string, unknown>, lineItems: VoucherLineItem[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.sourceWarehouseId || !(data.sourceWarehouseId as string).trim()) {
    errors.push({ field: 'sourceWarehouseId', rule: 'WT-V001', message: 'Source warehouse is required' });
  }

  if (!data.destinationWarehouseId || !(data.destinationWarehouseId as string).trim()) {
    errors.push({ field: 'destinationWarehouseId', rule: 'WT-V002', message: 'Destination warehouse is required' });
  }

  if (data.sourceWarehouseId && data.destinationWarehouseId && data.sourceWarehouseId === data.destinationWarehouseId) {
    errors.push({
      field: 'destinationWarehouseId',
      rule: 'WT-V003',
      message: 'Source and destination warehouses must be different',
    });
  }

  if (lineItems.length === 0) {
    errors.push({ field: 'lineItems', rule: 'WT-V004', message: 'At least one line item is required' });
  }

  lineItems.forEach((item, idx) => {
    if (!item.quantity || item.quantity <= 0) {
      errors.push({
        field: `lineItems[${idx}].quantity`,
        rule: 'WT-V005',
        message: `Quantity must be greater than zero for ${item.itemName}`,
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ── Handover Validators ────────────────────────────────────────────────

export function validateHandover(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.fromUserId || !(data.fromUserId as string).trim()) {
    errors.push({ field: 'fromUserId', rule: 'HO-V001', message: 'From user is required' });
  }

  if (!data.toUserId || !(data.toUserId as string).trim()) {
    errors.push({ field: 'toUserId', rule: 'HO-V002', message: 'To user is required' });
  }

  if (!data.warehouseId || !(data.warehouseId as string).trim()) {
    errors.push({ field: 'warehouseId', rule: 'HO-V003', message: 'Warehouse is required' });
  }

  if (data.fromUserId && data.toUserId && data.fromUserId === data.toUserId) {
    errors.push({
      field: 'toUserId',
      rule: 'HO-V004',
      message: 'Cannot handover to yourself',
    });
  }

  if (!data.handoverDate) {
    errors.push({ field: 'handoverDate', rule: 'HO-V005', message: 'Handover date is required' });
  }

  return { valid: errors.length === 0, errors, warnings };
}
