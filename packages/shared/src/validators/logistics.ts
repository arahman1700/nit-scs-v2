import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

// ── GatePass Validators ────────────────────────────────────────────────

export function validateGatePass(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.passType || !(data.passType as string).trim()) {
    errors.push({ field: 'passType', rule: 'GP-V001', message: 'Pass type is required' });
  }

  if (!data.vehiclePlate || !(data.vehiclePlate as string).trim()) {
    errors.push({ field: 'vehiclePlate', rule: 'GP-V002', message: 'Vehicle plate is required' });
  }

  if (data.passType === 'outbound' && !data.mirvId && !data.joId) {
    errors.push({
      field: 'passType',
      rule: 'GP-V003',
      message: 'Outbound gate pass requires MI or JO reference',
    });
  }

  if (data.validFrom && data.validUntil) {
    if (new Date(data.validFrom as string) >= new Date(data.validUntil as string)) {
      errors.push({
        field: 'validUntil',
        rule: 'GP-V004',
        message: 'Valid until must be after valid from',
      });
    }
  }

  if (!data.driverName || !(data.driverName as string).trim()) {
    warnings.push({ field: 'driverName', rule: 'GP-W001', message: 'Driver name is recommended' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Shipment Validators ────────────────────────────────────────────────

export function validateShipment(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.poNumber || !(data.poNumber as string).trim()) {
    errors.push({ field: 'poNumber', rule: 'SHIP-V001', message: 'PO Number is required' });
  }

  if (!data.supplierId || !(data.supplierId as string).trim()) {
    errors.push({ field: 'supplierId', rule: 'SHIP-V002', message: 'Supplier is required' });
  }

  if (!data.modeOfShipment || !(data.modeOfShipment as string).trim()) {
    errors.push({ field: 'modeOfShipment', rule: 'SHIP-V003', message: 'Mode of shipment is required' });
  }

  if (data.expectedShipDate && data.orderDate) {
    if (new Date(data.expectedShipDate as string) < new Date(data.orderDate as string)) {
      errors.push({
        field: 'expectedShipDate',
        rule: 'SHIP-V004',
        message: 'Expected ship date cannot be before order date',
      });
    }
  }

  if (Number(data.commercialValue || 0) > 100000 && !data.insuranceCost) {
    warnings.push({
      field: 'insuranceCost',
      rule: 'SHIP-W001',
      message: 'Insurance is recommended for shipments with commercial value exceeding 100,000',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
