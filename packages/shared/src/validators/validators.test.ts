import { describe, it, expect } from 'vitest';
import {
  validateMRRV,
  validateMIRV,
  validateMRV,
  validateJO,
  validateRFIM,
  validateOSD,
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

// ── validateMRRV ────────────────────────────────────────────────────────

describe('validateMRRV', () => {
  const validData = { date: pastDate(1), poNumber: 'PO-001', supplier: 'Acme Corp' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateMRRV(validData, validItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('MRRV-V001: errors on future date', () => {
    const result = validateMRRV({ ...validData, date: futureDate(3) }, validItems);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V001' })]));
  });

  it('MRRV-V002: warns on old date (>7 days)', () => {
    const result = validateMRRV({ ...validData, date: pastDate(10) }, validItems);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V002' })]));
    // still valid because it's a warning, not an error
    expect(result.valid).toBe(true);
  });

  it('MRRV-V002: no warning for date within 7 days', () => {
    const result = validateMRRV({ ...validData, date: pastDate(3) }, validItems);
    expect(result.warnings.find(w => w.rule === 'MRRV-V002')).toBeUndefined();
  });

  it('MRRV-V003: errors on empty lineItems', () => {
    const result = validateMRRV(validData, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V003' })]));
  });

  it('MRRV-V004: errors on missing poNumber', () => {
    const result = validateMRRV({ ...validData, poNumber: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V004' })]));
  });

  it('MRRV-V004: errors on whitespace-only poNumber', () => {
    const result = validateMRRV({ ...validData, poNumber: '   ' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V004' })]));
  });

  it('MRRV-V005: errors on missing supplier', () => {
    const result = validateMRRV({ ...validData, supplier: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V005' })]));
  });

  it('MRRV-V006: warns on over-delivery >10%', () => {
    const items = [makeLineItem({ qtyExpected: 100, qtyReceived: 120 })];
    const result = validateMRRV(validData, items);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-V006' })]));
  });

  it('MRRV-V006: no warning at exactly 10% over', () => {
    const items = [makeLineItem({ qtyExpected: 100, qtyReceived: 110 })];
    const result = validateMRRV(validData, items);
    expect(result.warnings.find(w => w.rule === 'MRRV-V006')).toBeUndefined();
  });

  it('MRRV-AUTO1: warns on damaged items', () => {
    const items = [makeLineItem({ condition: 'Damaged' })];
    const result = validateMRRV(validData, items);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRRV-AUTO1' })]));
  });

  it('MRRV-AUTO1: no warning for non-damaged items', () => {
    const items = [makeLineItem({ condition: 'Good' })];
    const result = validateMRRV(validData, items);
    expect(result.warnings.find(w => w.rule === 'MRRV-AUTO1')).toBeUndefined();
  });

  it('accumulates multiple errors', () => {
    const result = validateMRRV({ date: futureDate(1) }, []);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // future date, no PO, no supplier, no items
  });
});

// ── validateMIRV ────────────────────────────────────────────────────────

describe('validateMIRV', () => {
  const validData = { project: 'PRJ-001', warehouse: 'WH-A' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateMIRV(validData, validItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('MIRV-V001: errors on empty lineItems', () => {
    const result = validateMIRV(validData, []);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MIRV-V001' })]));
  });

  it('MIRV-V002: errors on missing project', () => {
    const result = validateMIRV({ ...validData, project: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MIRV-V002' })]));
  });

  it('MIRV-V003: errors on missing warehouse', () => {
    const result = validateMIRV({ ...validData, warehouse: '  ' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MIRV-V003' })]));
  });

  it('MIRV-V004: errors on insufficient stock', () => {
    const items = [makeLineItem({ quantity: 50, qtyAvailable: 30 })];
    const result = validateMIRV(validData, items);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MIRV-V004' })]));
  });

  it('MIRV-V004: no error when quantity <= qtyAvailable', () => {
    const items = [makeLineItem({ quantity: 10, qtyAvailable: 10 })];
    const result = validateMIRV(validData, items);
    expect(result.errors.find(e => e.rule === 'MIRV-V004')).toBeUndefined();
  });

  it('MIRV-V004: no error when qtyAvailable is undefined', () => {
    const items = [makeLineItem({ quantity: 100, qtyAvailable: undefined })];
    const result = validateMIRV(validData, items);
    expect(result.errors.find(e => e.rule === 'MIRV-V004')).toBeUndefined();
  });

  it('MIRV-V005: errors when issued > approved', () => {
    const items = [makeLineItem({ qtyApproved: 10, qtyIssued: 15 })];
    const result = validateMIRV(validData, items);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MIRV-V005' })]));
  });

  it('MIRV-V005: no error when issued <= approved', () => {
    const items = [makeLineItem({ qtyApproved: 10, qtyIssued: 10 })];
    const result = validateMIRV(validData, items);
    expect(result.errors.find(e => e.rule === 'MIRV-V005')).toBeUndefined();
  });
});

// ── validateMRV ─────────────────────────────────────────────────────────

describe('validateMRV', () => {
  const validData = { returnType: 'Surplus', project: 'PRJ-001', reason: 'Not needed' };
  const validItems = [makeLineItem()];

  it('returns valid for correct data', () => {
    const result = validateMRV(validData, validItems);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('MRV-V001: errors on missing returnType', () => {
    const result = validateMRV({ ...validData, returnType: undefined }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRV-V001' })]));
  });

  it('MRV-V002: errors on missing project', () => {
    const result = validateMRV({ ...validData, project: '' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRV-V002' })]));
  });

  it('MRV-V003: errors on missing reason', () => {
    const result = validateMRV({ ...validData, reason: '   ' }, validItems);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRV-V003' })]));
  });

  it('MRV-V004: errors on empty lineItems', () => {
    const result = validateMRV(validData, []);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'MRV-V004' })]));
  });

  it('accumulates all errors when everything is missing', () => {
    const result = validateMRV({}, []);
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
});

// ── validateRFIM ────────────────────────────────────────────────────────

describe('validateRFIM', () => {
  const validData = {
    mrrvId: 'MRRV-001',
    inspectionType: 'Quality',
    priority: 'Normal',
    itemsDescription: 'Steel beams for inspection',
  };

  it('returns valid for correct data', () => {
    const result = validateRFIM(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('RFIM-V001: errors on missing mrrvId', () => {
    const result = validateRFIM({ ...validData, mrrvId: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RFIM-V001' })]));
  });

  it('RFIM-V002: errors on missing inspectionType', () => {
    const result = validateRFIM({ ...validData, inspectionType: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RFIM-V002' })]));
  });

  it('RFIM-V003: errors on missing priority', () => {
    const result = validateRFIM({ ...validData, priority: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RFIM-V003' })]));
  });

  it('RFIM-V004: errors on missing itemsDescription', () => {
    const result = validateRFIM({ ...validData, itemsDescription: '   ' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RFIM-V004' })]));
  });

  it('RFIM-V005: warns on past inspectionDate', () => {
    const result = validateRFIM({ ...validData, inspectionDate: pastDate(2) });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RFIM-V005' })]));
  });

  it('RFIM-V005: no warning for future inspectionDate', () => {
    const result = validateRFIM({ ...validData, inspectionDate: futureDate(2) });
    expect(result.warnings.find(w => w.rule === 'RFIM-V005')).toBeUndefined();
  });

  it('RFIM-V006: warns on Critical priority', () => {
    const result = validateRFIM({ ...validData, priority: 'Critical' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'RFIM-V006' })]));
  });

  it('RFIM-V006: no warning for non-Critical priority', () => {
    const result = validateRFIM({ ...validData, priority: 'High' });
    expect(result.warnings.find(w => w.rule === 'RFIM-V006')).toBeUndefined();
  });

  it('accumulates all errors when everything is missing', () => {
    const result = validateRFIM({});
    expect(result.errors.length).toBe(4);
    expect(result.valid).toBe(false);
  });
});

// ── validateOSD ─────────────────────────────────────────────────────────

describe('validateOSD', () => {
  const validData = {
    mrrvId: 'MRRV-001',
    reportType: 'Shortage',
    qtyAffected: 5,
    description: 'Missing 5 units',
    actionRequired: 'Reorder',
  };

  it('returns valid for correct data', () => {
    const result = validateOSD(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('OSD-V001: errors on missing mrrvId', () => {
    const result = validateOSD({ ...validData, mrrvId: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V001' })]));
  });

  it('OSD-V002: errors on missing reportType', () => {
    const result = validateOSD({ ...validData, reportType: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V002' })]));
  });

  it('OSD-V003: errors on qtyAffected = 0', () => {
    const result = validateOSD({ ...validData, qtyAffected: 0 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V003' })]));
  });

  it('OSD-V003: errors on negative qtyAffected', () => {
    const result = validateOSD({ ...validData, qtyAffected: -1 });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V003' })]));
  });

  it('OSD-V003: errors on missing qtyAffected', () => {
    const result = validateOSD({ ...validData, qtyAffected: undefined });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V003' })]));
  });

  it('OSD-V004: errors on missing description', () => {
    const result = validateOSD({ ...validData, description: '' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V004' })]));
  });

  it('OSD-V005: errors on missing actionRequired', () => {
    const result = validateOSD({ ...validData, actionRequired: '  ' });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V005' })]));
  });

  it('OSD-V006: warns on Damage without attachments', () => {
    const result = validateOSD({ ...validData, reportType: 'Damage' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V006' })]));
  });

  it('OSD-V006: no warning when Damage has attachments', () => {
    const result = validateOSD({ ...validData, reportType: 'Damage', attachments: ['photo.jpg'] });
    expect(result.warnings.find(w => w.rule === 'OSD-V006')).toBeUndefined();
  });

  it('OSD-V007: warns on insurance claim action', () => {
    const result = validateOSD({ ...validData, actionRequired: 'Claim Insurance' });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'OSD-V007' })]));
  });

  it('OSD-V007: no warning for non-insurance action', () => {
    const result = validateOSD(validData);
    expect(result.warnings.find(w => w.rule === 'OSD-V007')).toBeUndefined();
  });

  it('accumulates all errors when everything is missing', () => {
    const result = validateOSD({});
    expect(result.errors.length).toBe(5);
    expect(result.valid).toBe(false);
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
