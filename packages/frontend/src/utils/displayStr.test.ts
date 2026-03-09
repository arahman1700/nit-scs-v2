import { describe, it, expect } from 'vitest';
import { displayStr } from './displayStr';

// ── null / undefined / empty ────────────────────────────────────────────

describe('displayStr – null/undefined handling', () => {
  it('returns empty string for null', () => {
    expect(displayStr(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(displayStr(undefined)).toBe('');
  });
});

// ── string inputs ───────────────────────────────────────────────────────

describe('displayStr – string inputs', () => {
  it('returns the string as-is', () => {
    expect(displayStr('Hello World')).toBe('Hello World');
  });

  it('returns empty string for empty string input', () => {
    expect(displayStr('')).toBe('');
  });

  it('preserves whitespace in strings', () => {
    expect(displayStr('  spaced  ')).toBe('  spaced  ');
  });

  it('handles string with special characters', () => {
    expect(displayStr('Item #42 (A/B)')).toBe('Item #42 (A/B)');
  });
});

// ── object inputs – named fields ────────────────────────────────────────

describe('displayStr – object field priority', () => {
  it('extracts supplierName from object', () => {
    expect(displayStr({ supplierName: 'ACME Corp' })).toBe('ACME Corp');
  });

  it('extracts warehouseName from object', () => {
    expect(displayStr({ warehouseName: 'Main Warehouse' })).toBe('Main Warehouse');
  });

  it('extracts projectName from object', () => {
    expect(displayStr({ projectName: 'Project Alpha' })).toBe('Project Alpha');
  });

  it('extracts fullName from object', () => {
    expect(displayStr({ fullName: 'John Doe' })).toBe('John Doe');
  });

  it('extracts itemDescription from object', () => {
    expect(displayStr({ itemDescription: 'Steel Pipe 4 inch' })).toBe('Steel Pipe 4 inch');
  });

  it('extracts regionName from object', () => {
    expect(displayStr({ regionName: 'Eastern Region' })).toBe('Eastern Region');
  });

  it('extracts cityName from object', () => {
    expect(displayStr({ cityName: 'Riyadh' })).toBe('Riyadh');
  });

  it('extracts name from object', () => {
    expect(displayStr({ name: 'Generic Name' })).toBe('Generic Name');
  });

  it('extracts id as fallback from object', () => {
    expect(displayStr({ id: 42 })).toBe('42');
  });

  it('returns empty string for empty object', () => {
    expect(displayStr({})).toBe('');
  });
});

// ── object inputs – priority ordering ───────────────────────────────────

describe('displayStr – field priority ordering', () => {
  it('prefers supplierName over name', () => {
    expect(displayStr({ supplierName: 'Supplier A', name: 'Fallback' })).toBe('Supplier A');
  });

  it('prefers warehouseName over projectName', () => {
    expect(displayStr({ warehouseName: 'WH-1', projectName: 'Proj-1' })).toBe('WH-1');
  });

  it('prefers projectName over fullName', () => {
    expect(displayStr({ projectName: 'Proj-1', fullName: 'User X' })).toBe('Proj-1');
  });

  it('prefers fullName over name', () => {
    expect(displayStr({ fullName: 'Jane Doe', name: 'Fallback' })).toBe('Jane Doe');
  });

  it('prefers name over id', () => {
    expect(displayStr({ name: 'Named', id: 99 })).toBe('Named');
  });
});

// ── non-string, non-object primitives ───────────────────────────────────

describe('displayStr – primitive coercion', () => {
  it('converts number to string', () => {
    expect(displayStr(42 as unknown)).toBe('42');
  });

  it('converts boolean true to string', () => {
    expect(displayStr(true as unknown)).toBe('true');
  });

  it('converts boolean false to string', () => {
    expect(displayStr(false as unknown)).toBe('false');
  });

  it('converts zero to string', () => {
    expect(displayStr(0 as unknown)).toBe('0');
  });
});
