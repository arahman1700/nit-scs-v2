/**
 * Slotting Optimization Service
 *
 * Analyzes warehouse bin assignments and suggests optimal slot positions
 * based on pick frequency and ABC classification. High-frequency items
 * should be in the "golden zone" (low aisles, low shelves) for ergonomic
 * and time-efficient picking.
 *
 * Algorithm:
 * 1. Calculate pick frequency per item from MirvLine data (last 6 months)
 * 2. Score items: frequency * ABC weight (A=3, B=2, C=1)
 * 3. Map ideal positions:
 *    - High-score items -> Zone A, low aisles (1-3), low shelves (1-2) — "golden zone"
 *    - Medium-score items -> middle aisles/shelves
 *    - Low-score items -> upper shelves, far zones
 * 4. Compare current bin vs ideal -> generate move suggestions
 * 5. Calculate efficiency: how many high-freq items are already in golden zone
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Interfaces ──────────────────────────────────────────────────────────

export interface SlottingSuggestion {
  itemId: string;
  itemCode: string;
  itemName: string;
  abcClass: string;
  pickFrequency: number;
  currentBin: string;
  suggestedBin: string;
  currentZone: string;
  suggestedZone: string;
  reason: string;
  priorityScore: number;
}

export interface SlottingAnalysis {
  warehouseId: string;
  suggestions: SlottingSuggestion[];
  currentEfficiency: number;
  projectedEfficiency: number;
  estimatedTimeSavingMinutes: number;
}

export interface ItemPickFrequency {
  itemId: string;
  itemCode: string;
  itemName: string;
  abcClass: string;
  pickCount: number;
  totalQtyIssued: number;
  pickFrequency: number;
}

// ── Constants ───────────────────────────────────────────────────────────

const ABC_WEIGHTS: Record<string, number> = { A: 3, B: 2, C: 1 };

/** Golden zone: zone A (or first zone alphabetically), aisles 1-3, shelves 1-2 */
const GOLDEN_ZONE_MAX_AISLE = 3;
const GOLDEN_ZONE_MAX_SHELF = 2;

/** Mid zone: aisles 4-6, shelves 3-4 */
const MID_ZONE_MAX_AISLE = 6;
const MID_ZONE_MAX_SHELF = 4;

/** Average time saved per bin move to a more optimal position (minutes/month) */
const AVG_TIME_SAVING_PER_MOVE = 2.5;

// ── Helpers ─────────────────────────────────────────────────────────────

function parseBinNumber(bin: string): { zone: string; aisle: number; shelf: number } {
  const parts = bin.split('-');
  return {
    zone: parts[0] ?? 'A',
    aisle: parseInt(parts[1] ?? '1', 10) || 1,
    shelf: parseInt(parts[2] ?? '1', 10) || 1,
  };
}

function buildBinNumber(zone: string, aisle: number, shelf: number): string {
  return `${zone}-${String(aisle).padStart(2, '0')}-${String(shelf).padStart(2, '0')}`;
}

function isGoldenZone(aisle: number, shelf: number): boolean {
  return aisle <= GOLDEN_ZONE_MAX_AISLE && shelf <= GOLDEN_ZONE_MAX_SHELF;
}

function _isMidZone(aisle: number, shelf: number): boolean {
  return !isGoldenZone(aisle, shelf) && aisle <= MID_ZONE_MAX_AISLE && shelf <= MID_ZONE_MAX_SHELF;
}

/**
 * Compute a position score (lower = more accessible).
 * Used to compare current vs ideal placement.
 */
function positionScore(aisle: number, shelf: number): number {
  return aisle * 10 + shelf;
}

// ── Core Functions ──────────────────────────────────────────────────────

/**
 * Get pick frequencies for all items in a warehouse (last 6 months).
 */
export async function getItemPickFrequencies(warehouseId: string): Promise<ItemPickFrequency[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows = await prisma.$queryRaw<
    Array<{
      item_id: string;
      item_code: string;
      item_description: string;
      abc_class: string | null;
      pick_count: bigint;
      total_qty: number;
    }>
  >`
    SELECT
      i.id AS item_id,
      i.item_code,
      i.item_description,
      i.abc_class,
      COUNT(DISTINCT ml.id) AS pick_count,
      COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS total_qty
    FROM items i
    INNER JOIN mirv_lines ml ON ml.item_id = i.id
    INNER JOIN mirv m ON m.id = ml.mirv_id
    WHERE m.warehouse_id = ${warehouseId}::uuid
      AND m.request_date >= ${sixMonthsAgo}
      AND m.status NOT IN ('draft', 'cancelled', 'rejected')
      AND i.status = 'active'
    GROUP BY i.id, i.item_code, i.item_description, i.abc_class
    ORDER BY pick_count DESC
  `;

  return rows.map(row => ({
    itemId: row.item_id,
    itemCode: row.item_code,
    itemName: row.item_description,
    abcClass: row.abc_class ?? 'C',
    pickCount: Number(row.pick_count),
    totalQtyIssued: row.total_qty,
    // Picks per month (over 6-month window)
    pickFrequency: Math.round((Number(row.pick_count) / 6) * 100) / 100,
  }));
}

/**
 * Analyze current slotting and generate optimization suggestions.
 */
export async function analyzeSlotting(warehouseId: string): Promise<SlottingAnalysis> {
  // 1. Get pick frequencies
  const frequencies = await getItemPickFrequencies(warehouseId);
  const frequencyMap = new Map(frequencies.map(f => [f.itemId, f]));

  // 2. Get all bin cards for this warehouse
  const binCards = await prisma.binCard.findMany({
    where: { warehouseId },
    include: {
      item: {
        select: { id: true, itemCode: true, itemDescription: true, abcClass: true, category: true },
      },
    },
  });

  if (binCards.length === 0) {
    return {
      warehouseId,
      suggestions: [],
      currentEfficiency: 100,
      projectedEfficiency: 100,
      estimatedTimeSavingMinutes: 0,
    };
  }

  // 3. Get available zones to determine the primary zone code
  const zones = await prisma.warehouseZone.findMany({
    where: { warehouseId },
    orderBy: { zoneCode: 'asc' },
    select: { zoneCode: true, zoneName: true },
  });
  const primaryZoneCode = zones.length > 0 ? zones[0]!.zoneCode : 'A';

  // 4. Score each bin card item: frequency * ABC weight
  interface ScoredItem {
    itemId: string;
    itemCode: string;
    itemName: string;
    abcClass: string;
    pickFrequency: number;
    score: number;
    currentBin: string;
    currentZone: string;
    currentAisle: number;
    currentShelf: number;
  }

  const scoredItems: ScoredItem[] = binCards.map(bc => {
    const freq = frequencyMap.get(bc.itemId);
    const abcClass = bc.item.abcClass ?? 'C';
    const pickFrequency = freq?.pickFrequency ?? 0;
    const weight = ABC_WEIGHTS[abcClass] ?? 1;
    const score = pickFrequency * weight;
    const parsed = parseBinNumber(bc.binNumber);

    return {
      itemId: bc.itemId,
      itemCode: bc.item.itemCode,
      itemName: bc.item.itemDescription,
      abcClass,
      pickFrequency,
      score,
      currentBin: bc.binNumber,
      currentZone: parsed.zone,
      currentAisle: parsed.aisle,
      currentShelf: parsed.shelf,
    };
  });

  // Sort by score descending — highest priority items first
  scoredItems.sort((a, b) => b.score - a.score);

  // 5. Determine ideal positions based on score ranking
  const totalItems = scoredItems.length;
  const goldenCount = Math.ceil(totalItems * 0.2); // Top 20% -> golden zone
  const midCount = Math.ceil(totalItems * 0.3); // Next 30% -> mid zone

  // Count items currently in golden zone that are high-frequency
  let currentGoldenCorrect = 0;
  let totalHighFreqItems = 0;

  const suggestions: SlottingSuggestion[] = [];

  scoredItems.forEach((item, index) => {
    let suggestedZone: string;
    let suggestedAisle: number;
    let suggestedShelf: number;
    let reason: string;

    if (index < goldenCount) {
      // This item SHOULD be in the golden zone
      totalHighFreqItems++;
      suggestedZone = primaryZoneCode;
      suggestedAisle = Math.min(Math.floor(index / GOLDEN_ZONE_MAX_SHELF) + 1, GOLDEN_ZONE_MAX_AISLE);
      suggestedShelf = (index % GOLDEN_ZONE_MAX_SHELF) + 1;
      reason = `High pick frequency (${item.pickFrequency}/mo) + ABC class ${item.abcClass} — move to golden zone for ergonomic access`;

      if (isGoldenZone(item.currentAisle, item.currentShelf) && item.currentZone === primaryZoneCode) {
        currentGoldenCorrect++;
      }
    } else if (index < goldenCount + midCount) {
      // Mid zone
      const midIndex = index - goldenCount;
      suggestedZone = primaryZoneCode;
      suggestedAisle = GOLDEN_ZONE_MAX_AISLE + Math.floor(midIndex / MID_ZONE_MAX_SHELF) + 1;
      suggestedShelf = (midIndex % MID_ZONE_MAX_SHELF) + 1;
      reason = `Medium pick frequency (${item.pickFrequency}/mo) — place in middle zone`;
    } else {
      // Far zone / upper shelves
      const farIndex = index - goldenCount - midCount;
      suggestedZone = zones.length > 1 ? zones[zones.length - 1]!.zoneCode : primaryZoneCode;
      suggestedAisle = MID_ZONE_MAX_AISLE + Math.floor(farIndex / 6) + 1;
      suggestedShelf = MID_ZONE_MAX_SHELF + (farIndex % 4) + 1;
      reason = `Low pick frequency (${item.pickFrequency}/mo) — store in far zone / upper shelves`;
    }

    const suggestedBin = buildBinNumber(suggestedZone, suggestedAisle, suggestedShelf);
    const currentPosScore = positionScore(item.currentAisle, item.currentShelf);
    const suggestedPosScore = positionScore(suggestedAisle, suggestedShelf);

    // Only suggest a move if the improvement is meaningful
    const improvement = Math.abs(currentPosScore - suggestedPosScore);
    const zoneChanged = item.currentZone !== suggestedZone;

    if (improvement >= 5 || zoneChanged) {
      suggestions.push({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        abcClass: item.abcClass,
        pickFrequency: item.pickFrequency,
        currentBin: item.currentBin,
        suggestedBin,
        currentZone: item.currentZone,
        suggestedZone,
        reason,
        priorityScore: Math.round(item.score * (improvement / 10) * 100) / 100,
      });
    }
  });

  // Sort suggestions by priority score descending
  suggestions.sort((a, b) => b.priorityScore - a.priorityScore);

  // 6. Calculate efficiencies
  const currentEfficiency =
    totalHighFreqItems > 0 ? Math.round((currentGoldenCorrect / totalHighFreqItems) * 10000) / 100 : 100;

  // Projected: if all suggestions applied, all high-freq items would be correct
  const projectedCorrect = totalHighFreqItems > 0 ? totalHighFreqItems : 0;
  const projectedEfficiency =
    totalHighFreqItems > 0 ? Math.round((projectedCorrect / totalHighFreqItems) * 10000) / 100 : 100;

  const estimatedTimeSavingMinutes = Math.round(suggestions.length * AVG_TIME_SAVING_PER_MOVE * 100) / 100;

  log(
    'info',
    `[Slotting] Analyzed warehouse ${warehouseId}: ${suggestions.length} suggestions, ${currentEfficiency}% -> ${projectedEfficiency}% efficiency`,
  );

  return {
    warehouseId,
    suggestions,
    currentEfficiency,
    projectedEfficiency,
    estimatedTimeSavingMinutes,
  };
}

/**
 * Apply a single slotting suggestion: update the BinCard binNumber.
 * Creates an audit trail via BinCardTransaction.
 */
export async function applySuggestion(
  itemId: string,
  warehouseId: string,
  newBinNumber: string,
  performedById: string,
): Promise<{ success: boolean; oldBin: string; newBin: string }> {
  // Find the current bin card
  const binCard = await prisma.binCard.findFirst({
    where: { itemId, warehouseId },
    include: { item: { select: { itemCode: true } } },
  });

  if (!binCard) {
    throw new Error(`No bin card found for item ${itemId} in warehouse ${warehouseId}`);
  }

  const oldBin = binCard.binNumber;

  if (oldBin === newBinNumber) {
    return { success: true, oldBin, newBin: newBinNumber };
  }

  // Update bin number and create audit transaction in a transaction
  await prisma.$transaction([
    prisma.binCard.update({
      where: { id: binCard.id },
      data: { binNumber: newBinNumber },
    }),
    prisma.binCardTransaction.create({
      data: {
        binCardId: binCard.id,
        transactionType: 'adjustment',
        referenceType: 'adjustment',
        referenceId: binCard.id,
        referenceNumber: `SLOT-${binCard.item.itemCode}`,
        qtyIn: 0,
        qtyOut: 0,
        runningBalance: binCard.currentQty,
        performedById,
      },
    }),
  ]);

  log(
    'info',
    `[Slotting] Moved item ${binCard.item.itemCode} from bin ${oldBin} to ${newBinNumber} in warehouse ${warehouseId}`,
  );

  return { success: true, oldBin, newBin: newBinNumber };
}
