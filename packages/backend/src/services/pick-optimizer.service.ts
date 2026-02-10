/**
 * Pick Path Optimizer Service
 *
 * Parses bin locations (zone-aisle-shelf format), calculates distances,
 * and produces an optimized pick path using nearest-neighbor heuristic.
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface BinLocation {
  zone: string;
  aisle: number;
  shelf: number;
}

export interface PickStop {
  itemId: string;
  itemCode: string;
  itemName: string;
  binNumber: string;
  zone: string;
  aisle: number;
  shelf: number;
  quantity: number;
  stopOrder: number;
}

export interface PickPath {
  stops: PickStop[];
  totalDistance: number;
  estimatedMinutes: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a bin location string "A-03-12" into { zone, aisle, shelf }.
 */
export function parseBinLocation(binNumber: string): BinLocation {
  const parts = binNumber.split('-');
  if (parts.length < 3) {
    return { zone: parts[0] ?? 'A', aisle: 0, shelf: 0 };
  }
  return {
    zone: parts[0]!,
    aisle: parseInt(parts[1]!, 10) || 0,
    shelf: parseInt(parts[2]!, 10) || 0,
  };
}

/**
 * Convert zone letter to numeric offset for distance calculation.
 * A=0, B=1, C=2 etc. Each zone is treated as ~10 units apart.
 */
function zoneToNumber(zone: string): number {
  const code = zone.toUpperCase().charCodeAt(0) - 65; // A=0, B=1 ...
  return Math.max(0, code) * 10;
}

/**
 * Calculate Manhattan distance between two bin locations.
 * Distance = |zone_diff| + |aisle_diff| + |shelf_diff|
 */
export function manhattanDistance(a: BinLocation, b: BinLocation): number {
  return (
    Math.abs(zoneToNumber(a.zone) - zoneToNumber(b.zone)) + Math.abs(a.aisle - b.aisle) + Math.abs(a.shelf - b.shelf)
  );
}

// ── Main ────────────────────────────────────────────────────────────────

/**
 * Optimize pick path for a list of items in a given warehouse.
 *
 * Algorithm: Nearest-neighbor heuristic
 *  1. Start at the dock / entrance (zone A, aisle 0, shelf 0)
 *  2. Find the nearest unpicked item
 *  3. Pick it, mark as visited
 *  4. Repeat until all items picked
 *  5. Return ordered list with estimated travel distance
 */
export async function optimizePickPath(
  warehouseId: string,
  items: Array<{ itemId: string; quantity: number }>,
): Promise<PickPath> {
  if (items.length === 0) {
    return { stops: [], totalDistance: 0, estimatedMinutes: 0 };
  }

  // Look up BinCard records for each requested item in the warehouse
  const itemIds = items.map(i => i.itemId);
  const binCards = await prisma.binCard.findMany({
    where: {
      warehouseId,
      itemId: { in: itemIds },
      currentQty: { gt: 0 },
    },
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
    orderBy: { binNumber: 'asc' },
  });

  // Build a map: itemId -> best bin card (one with highest qty)
  const itemBinMap = new Map<string, (typeof binCards)[number]>();
  for (const bc of binCards) {
    const existing = itemBinMap.get(bc.itemId);
    if (!existing || Number(bc.currentQty) > Number(existing.currentQty)) {
      itemBinMap.set(bc.itemId, bc);
    }
  }

  // Build the unordered stop list
  const qtyMap = new Map(items.map(i => [i.itemId, i.quantity]));
  const unvisited: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    binNumber: string;
    loc: BinLocation;
    quantity: number;
  }> = [];

  for (const item of items) {
    const bc = itemBinMap.get(item.itemId);
    if (bc) {
      const loc = parseBinLocation(bc.binNumber);
      unvisited.push({
        itemId: item.itemId,
        itemCode: bc.item.itemCode,
        itemName: bc.item.itemDescription,
        binNumber: bc.binNumber,
        loc,
        quantity: qtyMap.get(item.itemId) ?? item.quantity,
      });
    } else {
      // Item has no bin card — include with unknown location
      unvisited.push({
        itemId: item.itemId,
        itemCode: 'UNKNOWN',
        itemName: 'Item not found in bin cards',
        binNumber: 'N/A',
        loc: { zone: 'Z', aisle: 99, shelf: 99 },
        quantity: qtyMap.get(item.itemId) ?? item.quantity,
      });
    }
  }

  // Nearest-neighbor from dock (zone A, aisle 0, shelf 0)
  const dock: BinLocation = { zone: 'A', aisle: 0, shelf: 0 };
  let currentPos = dock;
  let totalDistance = 0;
  const ordered: PickStop[] = [];

  while (unvisited.length > 0) {
    // Find nearest
    let bestIdx = 0;
    let bestDist = manhattanDistance(currentPos, unvisited[0]!.loc);

    for (let i = 1; i < unvisited.length; i++) {
      const d = manhattanDistance(currentPos, unvisited[i]!.loc);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const picked = unvisited.splice(bestIdx, 1)[0]!;
    totalDistance += bestDist;
    currentPos = picked.loc;

    ordered.push({
      itemId: picked.itemId,
      itemCode: picked.itemCode,
      itemName: picked.itemName,
      binNumber: picked.binNumber,
      zone: picked.loc.zone,
      aisle: picked.loc.aisle,
      shelf: picked.loc.shelf,
      quantity: picked.quantity,
      stopOrder: ordered.length + 1,
    });
  }

  // Estimate time: ~0.5 min per distance unit (walking + picking)
  const estimatedMinutes = Math.round(totalDistance * 0.5 + ordered.length * 1.5);

  log(
    'info',
    `[PickOptimizer] Optimized path: ${ordered.length} stops, distance=${totalDistance}, est=${estimatedMinutes}min`,
  );

  return { stops: ordered, totalDistance, estimatedMinutes };
}
