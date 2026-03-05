import type { ValidationResult, ValidationError, ValidationWarning } from './common.js';

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

// ── ToolIssue Validators ───────────────────────────────────────────────

export function validateToolIssue(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.toolId || !(data.toolId as string).trim()) {
    errors.push({ field: 'toolId', rule: 'TI-V001', message: 'Tool is required' });
  }

  if (!data.issuedToId || !(data.issuedToId as string).trim()) {
    errors.push({ field: 'issuedToId', rule: 'TI-V002', message: 'Issued to is required' });
  }

  if (!data.issueDate) {
    errors.push({ field: 'issueDate', rule: 'TI-V003', message: 'Issue date is required' });
  }

  if (!data.expectedReturnDate) {
    warnings.push({ field: 'expectedReturnDate', rule: 'TI-W001', message: 'Expected return date is recommended' });
  }

  if (data.returnDate && data.issueDate) {
    if (new Date(data.returnDate as string) < new Date(data.issueDate as string)) {
      errors.push({
        field: 'returnDate',
        rule: 'TI-V004',
        message: 'Return date cannot be before issue date',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── GeneratorFuel Validators ───────────────────────────────────────────

export function validateGeneratorFuel(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.generatorId || !(data.generatorId as string).trim()) {
    errors.push({ field: 'generatorId', rule: 'GF-V001', message: 'Generator is required' });
  }

  if (!data.date) {
    errors.push({ field: 'date', rule: 'GF-V002', message: 'Date is required' });
  }

  if (!data.fuelQtyLiters || Number(data.fuelQtyLiters) <= 0) {
    errors.push({ field: 'fuelQtyLiters', rule: 'GF-V003', message: 'Fuel quantity must be greater than zero' });
  }

  if (Number(data.fuelQtyLiters || 0) > 1000) {
    warnings.push({
      field: 'fuelQtyLiters',
      rule: 'GF-W001',
      message: 'Unusually high fuel quantity',
    });
  }

  if (data.date && new Date(data.date as string) > new Date()) {
    warnings.push({
      field: 'date',
      rule: 'GF-W002',
      message: 'Fuel log date is in the future',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── GeneratorMaintenance Validators ────────────────────────────────────

export function validateGeneratorMaintenance(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.generatorId || !(data.generatorId as string).trim()) {
    errors.push({ field: 'generatorId', rule: 'GM-V001', message: 'Generator is required' });
  }

  if (!data.maintenanceType || !(data.maintenanceType as string).trim()) {
    errors.push({ field: 'maintenanceType', rule: 'GM-V002', message: 'Maintenance type is required' });
  }

  if (!data.scheduledDate) {
    errors.push({ field: 'scheduledDate', rule: 'GM-V003', message: 'Scheduled date is required' });
  }

  if (data.maintenanceType === 'Emergency') {
    warnings.push({
      field: 'maintenanceType',
      rule: 'GM-W001',
      message: 'Emergency maintenance requires supervisor notification',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Tool Validators ────────────────────────────────────────────────────

export function validateTool(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data.toolName || !(data.toolName as string).trim()) {
    errors.push({ field: 'toolName', rule: 'TOOL-V001', message: 'Tool name is required' });
  }

  if (!data.toolCode || !(data.toolCode as string).trim()) {
    errors.push({ field: 'toolCode', rule: 'TOOL-V002', message: 'Tool code is required' });
  }

  if (
    data.condition &&
    !['good', 'under_maintenance', 'damaged', 'decommissioned'].includes(data.condition as string)
  ) {
    errors.push({
      field: 'condition',
      rule: 'TOOL-V003',
      message: 'Condition must be one of: good, under_maintenance, damaged, decommissioned',
    });
  }

  if (data.warrantyExpiry && data.purchaseDate) {
    if (new Date(data.warrantyExpiry as string) < new Date(data.purchaseDate as string)) {
      errors.push({
        field: 'warrantyExpiry',
        rule: 'TOOL-V004',
        message: 'Warranty expiry cannot be before purchase date',
      });
    }
  }

  if (data.warrantyExpiry && new Date(data.warrantyExpiry as string) < new Date()) {
    warnings.push({
      field: 'warrantyExpiry',
      rule: 'TOOL-W001',
      message: 'Tool warranty has expired',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
