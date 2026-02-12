/**
 * AI Slotting Service
 *
 * Advanced slotting analysis beyond the standard frequency-based optimizer:
 * 1. Co-Location Analysis — items frequently picked together on the same MI
 * 2. Seasonal Trends — monthly velocity patterns for proactive golden-zone placement
 * 3. Unified AI Summary — merges standard + advanced analyses
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { analyzeSlotting, type SlottingAnalysis } from './slotting-optimizer.service.js';

// ── Interfaces ──────────────────────────────────────────────────────────

export interface CoLocationPair {
  itemA: { id: string; code: string; name: string };
  itemB: { id: string; code: string; name: string };
  coOccurrences: number;
  itemABin: string | null;
  itemBBin: string | null;
  binDistance: number;
  suggestion: string;
}

export interface CoLocationAnalysis {
  warehouseId: string;
  pairs: CoLocationPair[];
  potentialTimeSavingMinutes: number;
}

export interface SeasonalItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  currentBin: string | null;
  abcClass: string;
  monthlyVolumes: Record<string, number>; // "2025-01" -> qty
  avgMonthlyVolume: number;
  peakMonth: string;
  peakVolume: number;
  seasonalityIndex: number; // peak / avg — >2 means highly seasonal
  recommendation: string;
}

export interface SeasonalAnalysis {
  warehouseId: string;
  items: SeasonalItem[];
  seasonalAlertCount: number;
}

export interface AiSlottingSummary {
  warehouseId: string;
  standardAnalysis: SlottingAnalysis;
  coLocation: CoLocationAnalysis;
  seasonal: SeasonalAnalysis;
  aiConfidence: number;
  topRecommendations: string[];
}

// ── Constants ───────────────────────────────────────────────────────────

/** Minimum co-occurrences to consider a pair "frequently co-picked" */
const MIN_CO_OCCURRENCES = 3;

/** Seasonality index threshold: >2x avg means seasonal spike */
const SEASONAL_THRESHOLD = 2.0;

/** Minutes saved per co-located pair moved adjacent */
const TIME_SAVING_PER_COLOCATION = 1.5;

// ── Co-Location Analysis ────────────────────────────────────────────────

export async function analyzeCoLocation(warehouseId: string): Promise<CoLocationAnalysis> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Find item pairs that appear on the same MI document
  const pairs = await prisma.$queryRaw<
    Array<{
      item_a_id: string;
      item_a_code: string;
      item_a_name: string;
      item_b_id: string;
      item_b_code: string;
      item_b_name: string;
      co_count: bigint;
    }>
  >`
    SELECT
      a.item_id AS item_a_id,
      ia.item_code AS item_a_code,
      ia.item_description AS item_a_name,
      b.item_id AS item_b_id,
      ib.item_code AS item_b_code,
      ib.item_description AS item_b_name,
      COUNT(DISTINCT a.mirv_id) AS co_count
    FROM mirv_lines a
    INNER JOIN mirv_lines b ON a.mirv_id = b.mirv_id AND a.item_id < b.item_id
    INNER JOIN mirv m ON m.id = a.mirv_id
    INNER JOIN items ia ON ia.id = a.item_id
    INNER JOIN items ib ON ib.id = b.item_id
    WHERE m.warehouse_id = ${warehouseId}::uuid
      AND m.request_date >= ${sixMonthsAgo}
      AND m.status NOT IN ('draft', 'cancelled', 'rejected')
    GROUP BY a.item_id, ia.item_code, ia.item_description,
             b.item_id, ib.item_code, ib.item_description
    HAVING COUNT(DISTINCT a.mirv_id) >= ${MIN_CO_OCCURRENCES}
    ORDER BY co_count DESC
    LIMIT 50
  `;

  // Fetch bin assignments for these items
  const itemIds = new Set<string>();
  for (const p of pairs) {
    itemIds.add(p.item_a_id);
    itemIds.add(p.item_b_id);
  }

  const binCards = await prisma.binCard.findMany({
    where: { warehouseId, itemId: { in: [...itemIds] } },
    select: { itemId: true, binNumber: true },
  });

  const binMap = new Map(binCards.map(bc => [bc.itemId, bc.binNumber]));

  const result: CoLocationPair[] = pairs.map(p => {
    const binA = binMap.get(p.item_a_id) ?? null;
    const binB = binMap.get(p.item_b_id) ?? null;
    const distance = calculateBinDistance(binA, binB);
    const coOccurrences = Number(p.co_count);

    const suggestion =
      distance > 20
        ? `Move ${p.item_a_code} and ${p.item_b_code} to adjacent bins — co-picked ${coOccurrences} times, currently ${distance} units apart`
        : distance > 5
          ? `Consider moving closer — co-picked ${coOccurrences} times, ${distance} units apart`
          : `Already well-placed (${distance} units apart)`;

    return {
      itemA: { id: p.item_a_id, code: p.item_a_code, name: p.item_a_name },
      itemB: { id: p.item_b_id, code: p.item_b_code, name: p.item_b_name },
      coOccurrences,
      itemABin: binA,
      itemBBin: binB,
      binDistance: distance,
      suggestion,
    };
  });

  const movablePairs = result.filter(r => r.binDistance > 5).length;
  const potentialTimeSavingMinutes = Math.round(movablePairs * TIME_SAVING_PER_COLOCATION * 100) / 100;

  log('info', `[AI-Slotting] Co-location analysis for ${warehouseId}: ${result.length} pairs, ${movablePairs} movable`);

  return {
    warehouseId,
    pairs: result,
    potentialTimeSavingMinutes,
  };
}

// ── Seasonal Trends Analysis ────────────────────────────────────────────

export async function analyzeSeasonalTrends(warehouseId: string): Promise<SeasonalAnalysis> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Monthly MI volumes per item over last 12 months
  const rows = await prisma.$queryRaw<
    Array<{
      item_id: string;
      item_code: string;
      item_description: string;
      abc_class: string | null;
      month_key: string;
      month_qty: number;
    }>
  >`
    SELECT
      i.id AS item_id,
      i.item_code,
      i.item_description,
      i.abc_class,
      to_char(m.request_date, 'YYYY-MM') AS month_key,
      COALESCE(SUM(COALESCE(ml.qty_issued, ml.qty_requested)::float), 0) AS month_qty
    FROM items i
    INNER JOIN mirv_lines ml ON ml.item_id = i.id
    INNER JOIN mirv m ON m.id = ml.mirv_id
    WHERE m.warehouse_id = ${warehouseId}::uuid
      AND m.request_date >= ${twelveMonthsAgo}
      AND m.status NOT IN ('draft', 'cancelled', 'rejected')
      AND i.status = 'active'
    GROUP BY i.id, i.item_code, i.item_description, i.abc_class,
             to_char(m.request_date, 'YYYY-MM')
    ORDER BY i.item_code, month_key
  `;

  // Group by item
  const itemMap = new Map<
    string,
    {
      itemId: string;
      itemCode: string;
      itemName: string;
      abcClass: string;
      monthlyVolumes: Record<string, number>;
    }
  >();

  for (const row of rows) {
    let entry = itemMap.get(row.item_id);
    if (!entry) {
      entry = {
        itemId: row.item_id,
        itemCode: row.item_code,
        itemName: row.item_description,
        abcClass: row.abc_class ?? 'C',
        monthlyVolumes: {},
      };
      itemMap.set(row.item_id, entry);
    }
    entry.monthlyVolumes[row.month_key] = row.month_qty;
  }

  // Fetch bin assignments
  const allItemIds = [...itemMap.keys()];
  const binCards = await prisma.binCard.findMany({
    where: { warehouseId, itemId: { in: allItemIds } },
    select: { itemId: true, binNumber: true },
  });
  const binMap = new Map(binCards.map(bc => [bc.itemId, bc.binNumber]));

  // Analyze seasonality
  const items: SeasonalItem[] = [];

  for (const entry of itemMap.values()) {
    const volumes = Object.values(entry.monthlyVolumes);
    if (volumes.length < 3) continue; // need at least 3 months of data

    const avgMonthlyVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    if (avgMonthlyVolume <= 0) continue;

    let peakMonth = '';
    let peakVolume = 0;
    for (const [month, vol] of Object.entries(entry.monthlyVolumes)) {
      if (vol > peakVolume) {
        peakVolume = vol;
        peakMonth = month;
      }
    }

    const seasonalityIndex = Math.round((peakVolume / avgMonthlyVolume) * 100) / 100;

    let recommendation = '';
    if (seasonalityIndex >= SEASONAL_THRESHOLD) {
      recommendation = `Seasonal spike in ${peakMonth} (${seasonalityIndex}x avg) — move to golden zone before peak`;
    }

    if (seasonalityIndex >= SEASONAL_THRESHOLD) {
      items.push({
        itemId: entry.itemId,
        itemCode: entry.itemCode,
        itemName: entry.itemName,
        currentBin: binMap.get(entry.itemId) ?? null,
        abcClass: entry.abcClass,
        monthlyVolumes: entry.monthlyVolumes,
        avgMonthlyVolume: Math.round(avgMonthlyVolume * 100) / 100,
        peakMonth,
        peakVolume,
        seasonalityIndex,
        recommendation,
      });
    }
  }

  // Sort by seasonality index descending
  items.sort((a, b) => b.seasonalityIndex - a.seasonalityIndex);

  log('info', `[AI-Slotting] Seasonal analysis for ${warehouseId}: ${items.length} seasonal items detected`);

  return {
    warehouseId,
    items,
    seasonalAlertCount: items.length,
  };
}

// ── Unified AI Summary ──────────────────────────────────────────────────

export async function generateAiSlottingSummary(warehouseId: string): Promise<AiSlottingSummary> {
  // Run all analyses in parallel
  const [standardAnalysis, coLocation, seasonal] = await Promise.all([
    analyzeSlotting(warehouseId),
    analyzeCoLocation(warehouseId),
    analyzeSeasonalTrends(warehouseId),
  ]);

  // Compute AI confidence based on data availability
  const hasFrequencyData = standardAnalysis.suggestions.length > 0;
  const hasCoLocationData = coLocation.pairs.length > 0;
  const hasSeasonalData = seasonal.items.length > 0;

  let confidence = 40; // base confidence
  if (hasFrequencyData) confidence += 25;
  if (hasCoLocationData) confidence += 20;
  if (hasSeasonalData) confidence += 15;

  // Generate top recommendations
  const topRecommendations: string[] = [];

  if (standardAnalysis.suggestions.length > 0) {
    const topSugg = standardAnalysis.suggestions[0]!;
    topRecommendations.push(
      `Move ${topSugg.itemCode} from ${topSugg.currentBin} to ${topSugg.suggestedBin} (highest priority)`,
    );
  }

  const movablePairs = coLocation.pairs.filter(p => p.binDistance > 20);
  if (movablePairs.length > 0) {
    const top = movablePairs[0]!;
    topRecommendations.push(
      `Co-locate ${top.itemA.code} and ${top.itemB.code} (picked together ${top.coOccurrences} times)`,
    );
  }

  if (seasonal.items.length > 0) {
    const top = seasonal.items[0]!;
    topRecommendations.push(
      `Pre-position ${top.itemCode} for ${top.peakMonth} seasonal spike (${top.seasonalityIndex}x avg volume)`,
    );
  }

  if (standardAnalysis.projectedEfficiency > standardAnalysis.currentEfficiency) {
    topRecommendations.push(
      `Projected efficiency improvement: ${standardAnalysis.currentEfficiency}% → ${standardAnalysis.projectedEfficiency}%`,
    );
  }

  return {
    warehouseId,
    standardAnalysis,
    coLocation,
    seasonal,
    aiConfidence: Math.min(confidence, 100),
    topRecommendations,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function calculateBinDistance(binA: string | null, binB: string | null): number {
  if (!binA || !binB) return 99;

  const partsA = binA.split('-');
  const partsB = binB.split('-');

  const zoneA = partsA[0] ?? 'A';
  const zoneB = partsB[0] ?? 'A';
  const aisleA = parseInt(partsA[1] ?? '1', 10) || 1;
  const aisleB = parseInt(partsB[1] ?? '1', 10) || 1;
  const shelfA = parseInt(partsA[2] ?? '1', 10) || 1;
  const shelfB = parseInt(partsB[2] ?? '1', 10) || 1;

  // Zone difference (each zone ~50 units apart conceptually)
  const zoneDist = zoneA !== zoneB ? 50 : 0;
  // Aisle difference (~10 units per aisle)
  const aisleDist = Math.abs(aisleA - aisleB) * 10;
  // Shelf difference (~2 units per shelf)
  const shelfDist = Math.abs(shelfA - shelfB) * 2;

  return zoneDist + aisleDist + shelfDist;
}
