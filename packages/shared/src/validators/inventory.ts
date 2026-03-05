import { SLA_HOURS } from '../constants/index.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

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
    errors.push({ field: 'photos', rule: 'SCRAP-V004', message: 'Photos are required for scrap identification' });
  }

  if (data.buyerPickupDate) {
    const pickupDate = new Date(data.buyerPickupDate as string).getTime();
    const now = Date.now();
    const daysDiff = (pickupDate - now) / (1000 * 60 * 60 * 24);
    if (daysDiff > SLA_HOURS.scrap_buyer_pickup / 24) {
      warnings.push({
        field: 'buyerPickupDate',
        rule: 'SCRAP-W001',
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
