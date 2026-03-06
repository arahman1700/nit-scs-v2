import { formatGS1Barcode, generateBinLocationQR, generateItemLabel } from './barcode.service.js';

describe('barcode.service', () => {
  // ─── formatGS1Barcode ───────────────────────────────────────────────

  describe('formatGS1Barcode', () => {
    it('formats a basic GTIN-14 from itemCode', () => {
      const result = formatGS1Barcode({ itemCode: '12345' });
      expect(result).toBe('(01)00000000012345');
    });

    it('pads short codes to 14 digits', () => {
      const result = formatGS1Barcode({ itemCode: '1' });
      expect(result).toBe('(01)00000000000001');
    });

    it('strips non-digit characters from itemCode', () => {
      const result = formatGS1Barcode({ itemCode: 'IT-001-A' });
      expect(result).toBe('(01)00000000000001');
    });

    it('truncates codes longer than 14 digits', () => {
      const result = formatGS1Barcode({ itemCode: '123456789012345' });
      expect(result).toBe('(01)12345678901234');
    });

    it('appends lot number with AI (10)', () => {
      const result = formatGS1Barcode({ itemCode: '12345', lot: 'LOT-A1' });
      expect(result).toBe('(01)00000000012345(10)LOT-A1');
    });

    it('truncates lot number to 20 chars', () => {
      const longLot = 'A'.repeat(25);
      const result = formatGS1Barcode({ itemCode: '12345', lot: longLot });
      expect(result).toContain('(10)' + 'A'.repeat(20));
    });

    it('appends expiry date with AI (17) in YYMMDD format', () => {
      const expiry = new Date(2026, 5, 15); // June 15, 2026
      const result = formatGS1Barcode({ itemCode: '12345', expiry });
      expect(result).toContain('(17)260615');
    });

    it('appends quantity with AI (30)', () => {
      const result = formatGS1Barcode({ itemCode: '12345', qty: 42 });
      expect(result).toBe('(01)00000000012345(30)42');
    });

    it('omits quantity when qty is 0', () => {
      const result = formatGS1Barcode({ itemCode: '12345', qty: 0 });
      expect(result).not.toContain('(30)');
    });

    it('omits quantity when qty is null/undefined', () => {
      const result = formatGS1Barcode({ itemCode: '12345' });
      expect(result).not.toContain('(30)');
    });

    it('combines all AIs when all params provided', () => {
      const result = formatGS1Barcode({
        itemCode: '12345',
        lot: 'BATCH1',
        expiry: new Date(2027, 11, 1), // Dec 1, 2027
        qty: 100,
      });
      expect(result).toBe('(01)00000000012345(10)BATCH1(17)271201(30)100');
    });
  });

  // ─── generateBinLocationQR ──────────────────────────────────────────

  describe('generateBinLocationQR', () => {
    it('returns JSON string with type, wh, zone, bin', () => {
      const result = generateBinLocationQR({
        warehouseId: 'wh-1',
        zoneCode: 'A',
        binCode: 'A-01-03',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({
        type: 'bin',
        wh: 'wh-1',
        zone: 'A',
        bin: 'A-01-03',
      });
    });

    it('produces valid JSON', () => {
      const result = generateBinLocationQR({
        warehouseId: 'x',
        zoneCode: 'y',
        binCode: 'z',
      });
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  // ─── generateItemLabel ──────────────────────────────────────────────

  describe('generateItemLabel', () => {
    it('uses barcode field when provided', () => {
      const result = generateItemLabel({
        itemCode: 'IT-001',
        itemDescription: 'Steel Pipe',
        barcode: '9876543210',
      });
      expect(result.barcodeValue).toBe('9876543210');
    });

    it('falls back to itemCode when barcode is not provided', () => {
      const result = generateItemLabel({
        itemCode: 'IT-001',
        itemDescription: 'Steel Pipe',
      });
      expect(result.barcodeValue).toBe('IT-001');
    });

    it('sets barcodeType to code128', () => {
      const result = generateItemLabel({
        itemCode: 'X',
        itemDescription: 'Test',
      });
      expect(result.barcodeType).toBe('code128');
    });

    it('includes description as first line', () => {
      const result = generateItemLabel({
        itemCode: 'IT-001',
        itemDescription: 'Steel Pipe 3 inch',
      });
      expect(result.lines[0]).toBe('Steel Pipe 3 inch');
    });

    it('includes code line when itemCode is present', () => {
      const result = generateItemLabel({
        itemCode: 'IT-001',
        itemDescription: 'Test',
      });
      expect(result.lines).toContain('Code: IT-001');
    });

    it('includes UOM line when uom is provided', () => {
      const result = generateItemLabel({
        itemCode: 'IT-001',
        itemDescription: 'Test',
        uom: 'KG',
      });
      expect(result.lines).toContain('UOM: KG');
    });

    it('omits UOM line when uom is not provided', () => {
      const result = generateItemLabel({
        itemCode: 'IT-001',
        itemDescription: 'Test',
      });
      expect(result.lines.some(l => l.startsWith('UOM:'))).toBe(false);
    });
  });
});
