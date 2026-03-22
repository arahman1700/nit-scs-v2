import { describe, it, expect } from 'vitest';
import { calculateDocumentTotalValue } from './document-value.js';

describe('calculateDocumentTotalValue', () => {
  it('should sum cost * qty for all lines', () => {
    const result = calculateDocumentTotalValue([
      { cost: 50, qty: 10 },
      { cost: 200, qty: 5 },
    ]);
    expect(result).toBe(1500);
  });

  it('should return 0 for empty array', () => {
    expect(calculateDocumentTotalValue([])).toBe(0);
  });

  it('should skip lines with zero cost', () => {
    const result = calculateDocumentTotalValue([
      { cost: 0, qty: 10 },
      { cost: 50, qty: 5 },
    ]);
    expect(result).toBe(250);
  });

  it('should treat null cost as 0', () => {
    const result = calculateDocumentTotalValue([
      { cost: null as unknown as number, qty: 10 },
    ]);
    expect(result).toBe(0);
  });

  it('should treat undefined cost as 0', () => {
    const result = calculateDocumentTotalValue([
      { cost: undefined as unknown as number, qty: 10 },
    ]);
    expect(result).toBe(0);
  });

  it('should handle zero quantity', () => {
    const result = calculateDocumentTotalValue([{ cost: 50, qty: 0 }]);
    expect(result).toBe(0);
  });

  it('should sum only valid lines in mixed input', () => {
    const result = calculateDocumentTotalValue([
      { cost: null as unknown as number, qty: 10 },
      { cost: 50, qty: 5 },
      { cost: 0, qty: 100 },
      { cost: 100, qty: 3 },
    ]);
    expect(result).toBe(550); // 250 + 300
  });

  it('should coerce Prisma Decimal-like objects via Number()', () => {
    // Prisma Decimal objects have a toString() and can be coerced via Number()
    const decimalLike = { toString: () => '49.99', valueOf: () => 49.99 };
    const result = calculateDocumentTotalValue([
      { cost: decimalLike as unknown as number, qty: 10 },
    ]);
    expect(result).toBeCloseTo(499.9, 2);
  });
});
