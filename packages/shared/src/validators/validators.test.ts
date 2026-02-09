import { describe, it, expect } from 'vitest';
import {
  validateGRN,
  validateMI,
  validateMRN,
  validateJO,
  validateQCI,
  validateDR,
  validateMR,
  validateIMSF,
  validateScrap,
  validateSurplus,
  validateRentalContract,
  validateRequired,
} from '../validators/index.js';
import type { VoucherLineItem } from '../types/materials.js';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeLineItem(overrides: Partial<VoucherLineItem> = {}): VoucherLineItem {
  return {
    id: '1',
    itemCode: 'MAT-001',
    itemName: 'Steel Beam',
    unit: 'pcs',
    quantity: 10,
    unitPrice: 100,
    totalPrice: 1000,
    ...overrides,
  };
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
}

// ── validateGRN (was validateMRRV) ──────────────────────────────────────

describe('validateGRN', () => {
  const validData = { date: pastDate(1), poNumber: 'PO-001', supplier: 'Acme Corp' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateGRN(validData, validItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('GRN-V001: errors on future date', () => {
    const result = validateGRN({ ...validData, date: futureDate(3) }, validItems);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V001' })]));
  });

  it('GRN-V002: warns on old date (>7 days)', () => {
    const result = validateGRN({ ...validData, date: pastDate(10) }, validItems);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V002' })]));
    // still valid because it's a warning, not an error
    expect(result.valid).toBe(true);
  });

  it('GRN-V002: no warning for date within 7 days', () => {
    const result = validateGRN({ ...validData, date: pastDate(3) }, validItems);
    expect(result.warnings.find(w => w.rule === 'GRN-V002')).toBeUndefined();
  });

  it('GRN-V003: errors on empty lineItems', () => {
    const result = validateGRN(validData, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V003' })]));
  });

  it('GRN-V004: errors on missing poNumber', () => {
    const result = validateGRN({ ...validData, poNumber: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V004' })]));
  });

  it('GRN-V004: errors on whitespace-only poNumber', () => {
    const result = validateGRN({ ...validData, poNumber: '   ' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V004' })]));
  });

  it('GRN-V005: errors on missing supplier', () => {
    const result = validateGRN({ ...validData, supplier: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V005' })]));
  });

  it('GRN-V006: warns on over-delivery >10%', () => {
    const items = [makeLineItem({ qtyExpected: 100, qtyReceived: 120 })];
    const result = validateGRN(validData, items);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-V006' })]));
  });

  it('GRN-V006: no warning at exactly 10% over', () => {
    const items = [makeLineItem({ qtyExpected: 100, qtyReceived: 110 })];
    const result = validateGRN(validData, items);
    expect(result.warnings.find(w => w.rule === 'GRN-V006')).toBeUndefined();
  });

  it('GRN-AUTO1: warns on damaged items', () => {
    const items = [makeLineItem({ condition: 'Damaged' })];
    const result = validateGRN(validData, items);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'GRN-AUTO1' })]));
  });

  it('GRN-AUTO1: no warning for non-damaged items', () => {
    const items = [makeLineItem({ condition: 'Good' })];
    const result = validateGRN(validData, items);
    expect(result.warnings.find(w => w.rule === 'GRN-AUTO1')).toBeUndefined();
  });

  it('accumulates multiple errors', () => {
    const result = validateGRN({ date: futureDate(1) }, []);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // future date, no PO, no supplier, no items
  });
});

// ── validateMI (was validateMIRV) ───────────────────────────────────────

describe('validateMI', () => {
  const validData = { project: 'PRJ-001', warehouse: 'WH-A' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateMI(validData, validItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('MI-V001: errors on empty lineItems', () => {
    const result = validateMI(validData, []);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MI-V001' })]));
  });

  it('MI-V002: errors on missing project', () => {
    const result = validateMI({ ...validData, project: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MI-V002' })]));
  });

  it('MI-V003: errors on missing warehouse', () => {
    const result = validateMI({ ...validData, warehouse: '  ' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MI-V003' })]));
  });

  it('MI-V004: errors on insufficient stock', () => {
    const items = [makeLineItem({ quantity: 50, qtyAvailable: 30 })];
    const result = validateMI(validData, items);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MI-V004' })]));
  });

  it('MI-V004: no error when quantity <= qtyAvailable', () => {
    const items = [makeLineItem({ quantity: 10, qtyAvailable: 10 })];
    const result = validateMI(validData, items);
    expect(result.errors.find(e => e.rule === 'MI-V004')).toBeUndefined();
  });

  it('MI-V004: no error when qtyAvailable is undefined', () => {
    const items = [makeLineItem({ quantity: 100, qtyAvailable: undefined })];
    const result = validateMI(validData, items);
    expect(result.errors.find(e => e.rule === 'MI-V004')).toBeUndefined();
  });

  it('MI-V005: errors when issued > approved', () => {
    const items = [makeLineItem({ qtyApproved: 10, qtyIssued: 15 })];
    const result = validateMI(validData, items);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MI-V005' })]));
  });

  it('MI-V005: no error when issued <= approved', () => {
    const items = [makeLineItem({ qtyApproved: 10, qtyIssued: 10 })];
    const result = validateMI(validData, items);
    expect(result.errors.find(e => e.rule === 'MI-V005')).toBeUndefined();
  });
});

// ── validateMRN (was validateMRV) ───────────────────────────────────────

describe('validateMRN', () => {
  const validData = { returnType: 'Surplus', project: 'PRJ-001', reason: 'Not needed' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateMRN(validData, validItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('MRN-V001: errors on missing returnType', () => {
    const result = validateMRN({ ...validData, returnType: undefined }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRN-V001' })]));
  });

  it('MRN-V002: errors on missing project', () => {
    const result = validateMRN({ ...validData, project: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRN-V002' })]));
  });

  it('MRN-V003: errors on missing reason', () => {
    const result = validateMRN({ ...validData, reason: '   ' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRN-V003' })]));
  });

  it('MRN-V004: errors on empty lineItems', () => {
    const result = validateMRN(validData, []);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRN-V004' })]));
  });

  it('accumulates all errors when everything is missing', () => {
    const result = validateMRN({}, []);
    expect(result.errors.length).toBe(4);
    expect(result.valid).toBe(false);
  });
});

// ── validateJO ──────────────────────────────────────────────────────────

describe('validateJO', () => {
  it('returns valid for minimal correct data', () => {
    const result = validateJO({ joType: 'Equipment', project: 'PRJ-001' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('JO-V001: errors on missing joType and type', () => {
    const result = validateJO({ project: 'PRJ-001' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V001' })]));
  });

  it('JO-V001: no error when type is set (alternative field)', () => {
    const result = validateJO({ type: 'Equipment', project: 'PRJ-001' });
    expect(result.errors.find(e => e.rule === 'JO-V001')).toBeUndefined();
  });

  it('JO-V002: errors on missing project', () => {
    const result = validateJO({ joType: 'Equipment' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V002' })]));
  });

  it('JO-V003: errors on Transport without cargoType', () => {
    const result = validateJO({ joType: 'Transport', project: 'PRJ-001', cargoWeight: 100 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V003' })]));
  });

  it('JO-V004: errors on Transport without cargoWeight', () => {
    const result = validateJO({ joType: 'Transport', project: 'PRJ-001', cargoType: 'Bulk' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V004' })]));
  });

  it('JO-V004: no error when cargoWeightTons is provided', () => {
    const result = validateJO({
      joType: 'Transport',
      project: 'PRJ-001',
      cargoType: 'Bulk',
      cargoWeightTons: 50,
    });
    expect(result.errors.find(e => e.rule === 'JO-V004')).toBeUndefined();
  });

  it('Transport: valid with all required fields', () => {
    const result = validateJO({
      joType: 'Transport',
      project: 'PRJ-001',
      cargoType: 'Bulk',
      cargoWeight: 100,
    });
    expect(result.valid).toBe(true);
  });

  it('JO-V005: errors on Scrap without scrapType', () => {
    const result = validateJO({ joType: 'Scrap', project: 'PRJ-001', weightTons: 10 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V005' })]));
  });

  it('JO-V006: errors on Scrap without weightTons', () => {
    const result = validateJO({ joType: 'Scrap', project: 'PRJ-001', scrapType: 'Metal' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V006' })]));
  });

  it('JO-V006: no error when scrapWeightTons is provided', () => {
    const result = validateJO({
      joType: 'Scrap',
      project: 'PRJ-001',
      scrapType: 'Metal',
      scrapWeightTons: 5,
    });
    expect(result.errors.find(e => e.rule === 'JO-V006')).toBeUndefined();
  });

  it('Scrap: valid with all required fields', () => {
    const result = validateJO({
      joType: 'Scrap',
      project: 'PRJ-001',
      scrapType: 'Metal',
      weightTons: 10,
    });
    expect(result.valid).toBe(true);
  });

  it('non-Transport/Scrap type does not trigger type-specific errors', () => {
    const result = validateJO({ joType: 'Equipment', project: 'PRJ-001' });
    expect(result.errors).toEqual([]);
  });

  it('JO-V010: errors when value exceeds insurance threshold without policy', () => {
    const result = validateJO({ joType: 'Equipment', project: 'PRJ-001', value: 8_000_000 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V010' })]));
  });

  it('JO-V010: no error when insurance policy provided', () => {
    const result = validateJO({
      joType: 'Equipment',
      project: 'PRJ-001',
      value: 8_000_000,
      insurancePolicyId: 'INS-001',
    });
    expect(result.errors.find(e => e.rule === 'JO-V010')).toBeUndefined();
  });

  it('JO-V011: warns on monthly rental', () => {
    const result = validateJO({ joType: 'Rental_Monthly', project: 'PRJ-001' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V011' })]));
  });

  it('JO-V012: warns when no budget available', () => {
    const result = validateJO({ joType: 'Equipment', project: 'PRJ-001', budgetAvailable: false });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'JO-V012' })]));
  });
});

// ── validateQCI (was validateRFIM) ──────────────────────────────────────

describe('validateQCI', () => {
  const validData = {
    grnId: 'GRN-001',
    inspectionType: 'Quality',
    priority: 'Normal',
    itemsDescription: 'Steel beams for inspection',
  };

  it('returns valid for correct data', () => {
    const result = validateQCI(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('QCI-V001: errors on missing grnId', () => {
    const result = validateQCI({ ...validData, grnId: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'QCI-V001' })]));
  });

  it('QCI-V002: errors on missing inspectionType', () => {
    const result = validateQCI({ ...validData, inspectionType: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'QCI-V002' })]));
  });

  it('QCI-V003: errors on missing priority', () => {
    const result = validateQCI({ ...validData, priority: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'QCI-V003' })]));
  });

  it('QCI-V004: errors on missing itemsDescription', () => {
    const result = validateQCI({ ...validData, itemsDescription: '   ' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'QCI-V004' })]));
  });

  it('QCI-V005: warns on past inspectionDate', () => {
    const result = validateQCI({ ...validData, inspectionDate: pastDate(2) });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'QCI-V005' })]));
  });

  it('QCI-V005: no warning for future inspectionDate', () => {
    const result = validateQCI({ ...validData, inspectionDate: futureDate(2) });
    expect(result.warnings.find(w => w.rule === 'QCI-V005')).toBeUndefined();
  });

  it('QCI-V006: warns on Critical priority', () => {
    const result = validateQCI({ ...validData, priority: 'Critical' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'QCI-V006' })]));
  });

  it('QCI-V006: no warning for non-Critical priority', () => {
    const result = validateQCI({ ...validData, priority: 'High' });
    expect(result.warnings.find(w => w.rule === 'QCI-V006')).toBeUndefined();
  });

  it('accumulates all errors when everything is missing', () => {
    const result = validateQCI({});
    expect(result.errors.length).toBe(4);
    expect(result.valid).toBe(false);
  });
});

// ── validateDR (was validateOSD) ────────────────────────────────────────

describe('validateDR', () => {
  const validData = {
    grnId: 'GRN-001',
    reportType: 'Shortage',
    qtyAffected: 5,
    description: 'Missing 5 units',
    actionRequired: 'Reorder',
  };

  it('returns valid for correct data', () => {
    const result = validateDR(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('DR-V001: errors on missing grnId', () => {
    const result = validateDR({ ...validData, grnId: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V001' })]));
  });

  it('DR-V002: errors on missing reportType', () => {
    const result = validateDR({ ...validData, reportType: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V002' })]));
  });

  it('DR-V003: errors on qtyAffected = 0', () => {
    const result = validateDR({ ...validData, qtyAffected: 0 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V003' })]));
  });

  it('DR-V003: errors on negative qtyAffected', () => {
    const result = validateDR({ ...validData, qtyAffected: -1 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V003' })]));
  });

  it('DR-V003: errors on missing qtyAffected', () => {
    const result = validateDR({ ...validData, qtyAffected: undefined });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V003' })]));
  });

  it('DR-V004: errors on missing description', () => {
    const result = validateDR({ ...validData, description: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V004' })]));
  });

  it('DR-V005: errors on missing actionRequired', () => {
    const result = validateDR({ ...validData, actionRequired: '  ' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V005' })]));
  });

  it('DR-V006: warns on Damage without attachments', () => {
    const result = validateDR({ ...validData, reportType: 'Damage' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V006' })]));
  });

  it('DR-V006: no warning when Damage has attachments', () => {
    const result = validateDR({ ...validData, reportType: 'Damage', attachments: ['photo.jpg'] });
    expect(result.warnings.find(w => w.rule === 'DR-V006')).toBeUndefined();
  });

  it('DR-V007: warns on insurance claim action', () => {
    const result = validateDR({ ...validData, actionRequired: 'Claim Insurance' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'DR-V007' })]));
  });

  it('DR-V007: no warning for non-insurance action', () => {
    const result = validateDR(validData);
    expect(result.warnings.find(w => w.rule === 'DR-V007')).toBeUndefined();
  });

  it('accumulates all errors when everything is missing', () => {
    const result = validateDR({});
    expect(result.errors.length).toBe(5);
    expect(result.valid).toBe(false);
  });
});

// ── validateMR ──────────────────────────────────────────────────────────

describe('validateMR', () => {
  const validData = { project: 'PRJ-001', requestedBy: 'John', priority: 'Normal', requiredDate: '2026-03-01' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateMR(validData, validItems);
    expect(result.valid).toBe(true);
  });

  it('MR-V001: errors on missing project', () => {
    const result = validateMR({ ...validData, project: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MR-V001' })]));
  });

  it('MR-V010: errors on missing item code', () => {
    const items = [makeLineItem({ itemCode: '' })];
    const result = validateMR(validData, items);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MR-V010' })]));
  });
});

// ── validateIMSF ────────────────────────────────────────────────────────

describe('validateIMSF', () => {
  const validData = {
    senderProjectId: 'PRJ-001',
    receiverProjectId: 'PRJ-002',
    materialType: 'electrical',
  };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateIMSF(validData, validItems);
    expect(result.valid).toBe(true);
  });

  it('IMSF-V003: errors when sender and receiver are same', () => {
    const result = validateIMSF({ ...validData, receiverProjectId: 'PRJ-001' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'IMSF-V003' })]));
  });

  it('IMSF-V005: errors on empty lineItems', () => {
    const result = validateIMSF(validData, []);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'IMSF-V005' })]));
  });
});

// ── validateScrap ───────────────────────────────────────────────────────

describe('validateScrap', () => {
  it('errors on missing photos', () => {
    const result = validateScrap({ materialType: 'cable', warehouseId: 'WH-A', estimatedWeight: 100 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'SCRAP-V001' })]));
  });

  it('returns valid with all required fields', () => {
    const result = validateScrap({
      materialType: 'cable',
      warehouseId: 'WH-A',
      estimatedWeight: 100,
      photos: ['img.jpg'],
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateSurplus ─────────────────────────────────────────────────────

describe('validateSurplus', () => {
  it('errors on missing fields', () => {
    const result = validateSurplus({});
    expect(result.errors.length).toBe(4);
    expect(result.valid).toBe(false);
  });

  it('returns valid with all required fields', () => {
    const result = validateSurplus({ itemId: 'ITM-001', warehouseId: 'WH-A', qty: 10, condition: 'Good' });
    expect(result.valid).toBe(true);
  });
});

// ── validateRentalContract ──────────────────────────────────────────────

describe('validateRentalContract', () => {
  it('errors on missing fields', () => {
    const result = validateRentalContract({});
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.valid).toBe(false);
  });

  it('RC-V004: errors when end date is before start date', () => {
    const result = validateRentalContract({
      supplierId: 'SUP-001',
      startDate: '2026-06-01',
      endDate: '2026-05-01',
      monthlyRate: 5000,
    });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RC-V004' })]));
  });

  it('returns valid with all required fields', () => {
    const result = validateRentalContract({
      supplierId: 'SUP-001',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      monthlyRate: 5000,
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateRequired ────────────────────────────────────────────────────

describe('validateRequired', () => {
  it('returns empty array when all fields present', () => {
    const data = { name: 'Test', email: 'test@example.com' };
    const fields = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
    ];
    expect(validateRequired(data, fields)).toEqual([]);
  });

  it('returns errors for missing fields', () => {
    const data = { name: 'Test' };
    const fields = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
    ];
    const errors = validateRequired(data, fields);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ field: 'email', rule: 'REQUIRED', message: 'Email is required' });
  });

  it('treats empty strings as missing', () => {
    const data = { name: '' };
    const fields = [{ key: 'name', label: 'Name' }];
    const errors = validateRequired(data, fields);
    expect(errors).toHaveLength(1);
  });

  it('treats whitespace-only strings as missing', () => {
    const data = { name: '   ' };
    const fields = [{ key: 'name', label: 'Name' }];
    const errors = validateRequired(data, fields);
    expect(errors).toHaveLength(1);
  });

  it('treats null/undefined as missing', () => {
    const data = { name: null, email: undefined };
    const fields = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
    ];
    const errors = validateRequired(data, fields);
    expect(errors).toHaveLength(2);
  });

  it('accepts non-string truthy values (numbers, booleans)', () => {
    const data = { count: 0, active: true, score: 42 };
    const fields = [
      { key: 'count', label: 'Count' },
      { key: 'active', label: 'Active' },
      { key: 'score', label: 'Score' },
    ];
    const errors = validateRequired(data, fields);
    // 0 is falsy, so it should be flagged as missing
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('count');
  });

  it('returns empty for empty fields array', () => {
    expect(validateRequired({}, [])).toEqual([]);
  });
});
