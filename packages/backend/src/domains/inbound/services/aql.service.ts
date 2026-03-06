/**
 * AQL (Acceptable Quality Level) Sampling Calculator
 * Based on simplified ANSI/ASQ Z1.4 (MIL-STD-1916) standard tables.
 * Used by QCI (Quality Control Inspection) module.
 */

export type InspectionLevel = 'I' | 'II' | 'III';

export interface AqlSample {
  lotSize: number;
  inspectionLevel: InspectionLevel;
  aqlPercent: number;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
}

export interface AqlTableRow {
  lotSizeMin: number;
  lotSizeMax: number;
  lotSizeLabel: string;
  sampleSizeLevelI: number;
  sampleSizeLevelII: number;
  sampleSizeLevelIII: number;
}

// ── Lot size ranges mapped to sample size code letters (simplified Z1.4) ──
// Each entry: [lotMin, lotMax, sampleSizeI, sampleSizeII, sampleSizeIII]
const LOT_SIZE_TABLE: [number, number, number, number, number][] = [
  [2, 8, 2, 3, 5],
  [9, 15, 3, 5, 8],
  [16, 25, 5, 8, 13],
  [26, 50, 8, 13, 20],
  [51, 90, 13, 20, 32],
  [91, 150, 20, 32, 50],
  [151, 280, 32, 50, 80],
  [281, 500, 50, 80, 125],
  [501, 1200, 80, 125, 200],
  [1201, 3200, 125, 200, 315],
  [3201, 10000, 200, 315, 500],
  [10001, 35000, 315, 500, 800],
  [35001, 150000, 500, 800, 1250],
  [150001, 500000, 800, 1250, 1250],
  [500001, Infinity, 1250, 1250, 1250],
];

// ── Accept/Reject numbers based on (sampleSize, aqlPercent) ──
// Simplified: accept = floor(sampleSize * aqlPercent / 100)
// Reject = accept + 1
// Minimum accept = 0 (single sampling plan)
const STANDARD_AQL_VALUES = [0.1, 0.25, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5];

function getSampleSizeForLevel(row: [number, number, number, number, number], level: InspectionLevel): number {
  switch (level) {
    case 'I':
      return row[2];
    case 'II':
      return row[3];
    case 'III':
      return row[4];
    default:
      return row[3]; // default to level II
  }
}

function findLotRow(lotSize: number): [number, number, number, number, number] | undefined {
  return LOT_SIZE_TABLE.find(([min, max]) => lotSize >= min && lotSize <= max);
}

function computeAcceptReject(sampleSize: number, aqlPercent: number): { acceptNumber: number; rejectNumber: number } {
  const acceptNumber = Math.floor((sampleSize * aqlPercent) / 100);
  return {
    acceptNumber,
    rejectNumber: acceptNumber + 1,
  };
}

/**
 * Calculate AQL sample size and accept/reject numbers for a given lot.
 */
export function calculateSampleSize(lotSize: number, inspectionLevel: InspectionLevel, aqlPercent: number): AqlSample {
  if (lotSize < 2) {
    // For lots smaller than 2, inspect 100%
    return {
      lotSize,
      inspectionLevel,
      aqlPercent,
      sampleSize: lotSize,
      acceptNumber: 0,
      rejectNumber: 1,
    };
  }

  const row = findLotRow(lotSize);
  if (!row) {
    // Fallback for extremely large lots
    const sampleSize = 1250;
    const { acceptNumber, rejectNumber } = computeAcceptReject(sampleSize, aqlPercent);
    return { lotSize, inspectionLevel, aqlPercent, sampleSize, acceptNumber, rejectNumber };
  }

  const sampleSize = getSampleSizeForLevel(row, inspectionLevel);
  const { acceptNumber, rejectNumber } = computeAcceptReject(sampleSize, aqlPercent);

  return {
    lotSize,
    inspectionLevel,
    aqlPercent,
    sampleSize: Math.min(sampleSize, lotSize), // never sample more than the lot
    acceptNumber,
    rejectNumber,
  };
}

/**
 * Return the full AQL reference table for UI display.
 */
export function getAqlTable(): {
  rows: AqlTableRow[];
  aqlValues: number[];
} {
  const rows: AqlTableRow[] = LOT_SIZE_TABLE.map(([min, max, sI, sII, sIII]) => ({
    lotSizeMin: min,
    lotSizeMax: max === Infinity ? -1 : max, // -1 signals "and above"
    lotSizeLabel: max === Infinity ? `${min}+` : `${min}-${max}`,
    sampleSizeLevelI: sI,
    sampleSizeLevelII: sII,
    sampleSizeLevelIII: sIII,
  }));

  return {
    rows,
    aqlValues: STANDARD_AQL_VALUES,
  };
}
