/**
 * Canonical V1↔V2 naming registry.
 * Single source of truth for mapping between legacy Prisma model names,
 * V1 API paths, V2 API paths, and display names.
 */
export const CANONICAL_NAMES = {
  grn: { v1Model: 'Mrrv', v1Path: 'mrrv', v2Path: 'grn', displayName: 'GRN' },
  qci: { v1Model: 'Rfim', v1Path: 'rfim', v2Path: 'qci', displayName: 'QCI' },
  dr: { v1Model: 'OsdReport', v1Path: 'osd', v2Path: 'dr', displayName: 'DR' },
  mi: { v1Model: 'Mirv', v1Path: 'mirv', v2Path: 'mi', displayName: 'MI' },
  mrn: { v1Model: 'Mrv', v1Path: 'mrv', v2Path: 'mrn', displayName: 'MRN' },
  mr: { v1Model: 'Mrf', v1Path: 'mrf', v2Path: 'mr', displayName: 'MR' },
  wt: { v1Model: 'StockTransfer', v1Path: 'stock-transfers', v2Path: 'wt', displayName: 'WT' },
} as const;

export type CanonicalDocType = keyof typeof CANONICAL_NAMES;

/** Lookup V2 display name from V1 model name */
export function v1ModelToDisplayName(model: string): string | undefined {
  const entry = Object.values(CANONICAL_NAMES).find(e => e.v1Model === model);
  return entry?.displayName;
}

/** Lookup V2 path from V1 path */
export function v1PathToV2Path(v1Path: string): string | undefined {
  const entry = Object.values(CANONICAL_NAMES).find(e => e.v1Path === v1Path);
  return entry?.v2Path;
}
