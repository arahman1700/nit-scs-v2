import { INSURANCE_THRESHOLD_SAR } from '../constants/index.js';
import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

// ── JO Validators (enhanced) ────────────────────────────────────────────

export function validateJO(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.joType && !data.type) {
    errors.push({ field: 'joType', rule: 'JO-V001', message: 'Job Order type is required' });
  }
  if ((!data.project || !(data.project as string).trim()) && (!data.projectId || !(data.projectId as string).trim())) {
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
