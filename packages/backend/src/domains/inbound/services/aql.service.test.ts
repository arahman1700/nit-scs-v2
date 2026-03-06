import { calculateSampleSize, getAqlTable } from './aql.service.js';

describe('aql.service', () => {
  // ─── calculateSampleSize ───────────────────────────────────────────

  describe('calculateSampleSize', () => {
    it('returns 100% inspection for lot size < 2', () => {
      const result = calculateSampleSize(1, 'II', 2.5);
      expect(result.sampleSize).toBe(1);
      expect(result.acceptNumber).toBe(0);
      expect(result.rejectNumber).toBe(1);
    });

    it('returns correct sample for lot 2-8 at level II', () => {
      const result = calculateSampleSize(5, 'II', 2.5);
      expect(result.sampleSize).toBe(3); // level II for 2-8 is 3
    });

    it('returns correct sample for lot 51-90 at level I', () => {
      const result = calculateSampleSize(75, 'I', 2.5);
      expect(result.sampleSize).toBe(13); // level I for 51-90 is 13
    });

    it('returns correct sample for lot 51-90 at level III', () => {
      const result = calculateSampleSize(75, 'III', 2.5);
      expect(result.sampleSize).toBe(32); // level III for 51-90 is 32
    });

    it('caps sample size at lot size', () => {
      // Lot of 3, level III would give sample=5, but capped at 3
      const result = calculateSampleSize(3, 'III', 2.5);
      expect(result.sampleSize).toBeLessThanOrEqual(3);
    });

    it('computes accept number = floor(sampleSize * aql / 100)', () => {
      const result = calculateSampleSize(500, 'II', 2.5);
      // Level II for 281-500 = 80; accept = floor(80 * 2.5 / 100) = 2
      expect(result.sampleSize).toBe(80);
      expect(result.acceptNumber).toBe(2);
      expect(result.rejectNumber).toBe(3);
    });

    it('returns acceptNumber=0 for tight AQL on small samples', () => {
      const result = calculateSampleSize(10, 'I', 0.1);
      // Level I for 9-15 = 3; accept = floor(3 * 0.1 / 100) = 0
      expect(result.acceptNumber).toBe(0);
      expect(result.rejectNumber).toBe(1);
    });

    it('handles large lots (500001+)', () => {
      const result = calculateSampleSize(1000000, 'II', 2.5);
      expect(result.sampleSize).toBe(1250);
    });

    it('preserves input fields in result', () => {
      const result = calculateSampleSize(100, 'II', 1.5);
      expect(result.lotSize).toBe(100);
      expect(result.inspectionLevel).toBe('II');
      expect(result.aqlPercent).toBe(1.5);
    });
  });

  // ─── getAqlTable ───────────────────────────────────────────────────

  describe('getAqlTable', () => {
    it('returns 15 rows', () => {
      const table = getAqlTable();
      expect(table.rows).toHaveLength(15);
    });

    it('returns 8 standard AQL values', () => {
      const table = getAqlTable();
      expect(table.aqlValues).toEqual([0.1, 0.25, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5]);
    });

    it('first row covers lot size 2-8', () => {
      const table = getAqlTable();
      expect(table.rows[0].lotSizeMin).toBe(2);
      expect(table.rows[0].lotSizeMax).toBe(8);
      expect(table.rows[0].lotSizeLabel).toBe('2-8');
    });

    it('last row has -1 for max (infinity) and "500001+" label', () => {
      const table = getAqlTable();
      const last = table.rows[table.rows.length - 1];
      expect(last.lotSizeMax).toBe(-1);
      expect(last.lotSizeLabel).toBe('500001+');
    });

    it('all rows have positive sample sizes', () => {
      const table = getAqlTable();
      for (const row of table.rows) {
        expect(row.sampleSizeLevelI).toBeGreaterThan(0);
        expect(row.sampleSizeLevelII).toBeGreaterThan(0);
        expect(row.sampleSizeLevelIII).toBeGreaterThan(0);
      }
    });

    it('sample sizes increase with level (I < II < III)', () => {
      const table = getAqlTable();
      for (const row of table.rows) {
        expect(row.sampleSizeLevelI).toBeLessThanOrEqual(row.sampleSizeLevelII);
        expect(row.sampleSizeLevelII).toBeLessThanOrEqual(row.sampleSizeLevelIII);
      }
    });
  });
});
