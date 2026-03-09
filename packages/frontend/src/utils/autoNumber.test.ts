import { describe, it, expect, vi, afterEach } from 'vitest';
import { previewNextNumber, generateDocumentNumber } from './autoNumber';

// ── previewNextNumber ───────────────────────────────────────────────────

describe('previewNextNumber', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns GRN prefix for mrrv document type', () => {
    const result = previewNextNumber('mrrv');
    expect(result).toMatch(/^GRN-\d{4}-XXXX$/);
  });

  it('returns MI prefix for mirv document type', () => {
    const result = previewNextNumber('mirv');
    expect(result).toMatch(/^MI-\d{4}-XXXX$/);
  });

  it('returns MRN prefix for mrv document type', () => {
    const result = previewNextNumber('mrv');
    expect(result).toMatch(/^MRN-\d{4}-XXXX$/);
  });

  it('returns QCI prefix for rfim document type', () => {
    const result = previewNextNumber('rfim');
    expect(result).toMatch(/^QCI-\d{4}-XXXX$/);
  });

  it('returns DR prefix for osd document type', () => {
    const result = previewNextNumber('osd');
    expect(result).toMatch(/^DR-\d{4}-XXXX$/);
  });

  it('returns JO-NIT prefix for jo document type', () => {
    const result = previewNextNumber('jo');
    expect(result).toMatch(/^JO-NIT-\d{4}-XXXX$/);
  });

  it('returns GP prefix for gatepass document type', () => {
    const result = previewNextNumber('gatepass');
    expect(result).toMatch(/^GP-\d{4}-XXXX$/);
  });

  it('returns ST prefix for stock-transfer document type', () => {
    const result = previewNextNumber('stock-transfer');
    expect(result).toMatch(/^ST-\d{4}-XXXX$/);
  });

  it('returns MR prefix for mrf document type', () => {
    const result = previewNextNumber('mrf');
    expect(result).toMatch(/^MR-\d{4}-XXXX$/);
  });

  it('returns SH prefix for shipment document type', () => {
    const result = previewNextNumber('shipment');
    expect(result).toMatch(/^SH-\d{4}-XXXX$/);
  });

  it('returns CC prefix for customs document type', () => {
    const result = previewNextNumber('customs');
    expect(result).toMatch(/^CC-\d{4}-XXXX$/);
  });

  it('uses uppercase document type as prefix for unknown types', () => {
    const result = previewNextNumber('unknown');
    expect(result).toMatch(/^UNKNOWN-\d{4}-XXXX$/);
  });

  it('handles empty string as document type', () => {
    const result = previewNextNumber('');
    expect(result).toMatch(/^-\d{4}-XXXX$/);
  });

  it('uses the current year in the format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15'));
    expect(previewNextNumber('mrrv')).toBe('GRN-2026-XXXX');
  });

  it('updates year when system time changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01'));
    expect(previewNextNumber('mirv')).toBe('MI-2030-XXXX');
  });
});

// ── generateDocumentNumber (deprecated wrapper) ─────────────────────────

describe('generateDocumentNumber', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns same result as previewNextNumber', () => {
    expect(generateDocumentNumber('mrrv')).toBe(previewNextNumber('mrrv'));
  });

  it('works for known document types', () => {
    expect(generateDocumentNumber('mirv')).toMatch(/^MI-\d{4}-XXXX$/);
  });

  it('works for unknown document types', () => {
    expect(generateDocumentNumber('something')).toMatch(/^SOMETHING-\d{4}-XXXX$/);
  });

  it('handles special characters in document type by uppercasing', () => {
    const result = generateDocumentNumber('my-type');
    expect(result).toMatch(/^MY-TYPE-\d{4}-XXXX$/);
  });
});
