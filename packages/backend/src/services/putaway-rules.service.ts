/**
 * Put-Away Rules Service — V2
 * Evaluates rules to suggest optimal zone placement for incoming items.
 */
import type { Prisma, PutAwayRule } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PutAwaySuggestion {
  zoneId: string;
  zoneName: string;
  zoneCode: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

export async function suggestPutAwayLocation(itemId: string, warehouseId: string): Promise<PutAwaySuggestion[]> {
  // 1. Fetch item details
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError('Item', itemId);

  // 2. Fetch active rules for this warehouse, sorted by priority ASC (lower = higher priority)
  const rules = await prisma.putAwayRule.findMany({
    where: { warehouseId, isActive: true },
    orderBy: { priority: 'asc' },
    include: {
      targetZone: { select: { id: true, zoneName: true, zoneCode: true, capacity: true, currentOccupancy: true } },
    },
  });

  // 3. Fetch all zones for the warehouse (fallback options)
  const allZones = await prisma.warehouseZone.findMany({
    where: { warehouseId },
    select: { id: true, zoneName: true, zoneCode: true, zoneType: true, capacity: true, currentOccupancy: true },
  });

  const suggestions: PutAwaySuggestion[] = [];
  const usedZoneIds = new Set<string>();

  for (const rule of rules) {
    if (!rule.targetZone) continue;

    const zone = rule.targetZone;

    // Skip zones already suggested or at capacity
    if (usedZoneIds.has(zone.id)) continue;
    if (zone.capacity != null && zone.currentOccupancy != null && zone.currentOccupancy >= zone.capacity) continue;

    // Category match
    if (rule.itemCategory && rule.itemCategory.toLowerCase() === item.category?.toLowerCase()) {
      suggestions.push({
        zoneId: zone.id,
        zoneName: zone.zoneName,
        zoneCode: zone.zoneCode,
        reason: `Category match: ${item.category}`,
        confidence: 'high',
      });
      usedZoneIds.add(zone.id);
      continue;
    }

    // Hazardous match (item category contains 'hazardous' or zone type is 'hazardous')
    if (rule.isHazardous) {
      // Treat items in the 'safety' category or hazardous zone rules as a match
      if (item.category === 'safety') {
        suggestions.push({
          zoneId: zone.id,
          zoneName: zone.zoneName,
          zoneCode: zone.zoneCode,
          reason: 'Hazardous material zone',
          confidence: 'high',
        });
        usedZoneIds.add(zone.id);
        continue;
      }
    }

    // Generic rule (no category/hazardous filter) = default zone suggestion
    if (!rule.itemCategory && !rule.isHazardous) {
      suggestions.push({
        zoneId: zone.id,
        zoneName: zone.zoneName,
        zoneCode: zone.zoneCode,
        reason: `Default zone (priority ${rule.priority})`,
        confidence: 'medium',
      });
      usedZoneIds.add(zone.id);
    }
  }

  // 4. Add remaining zones with capacity as low-confidence fallbacks
  for (const zone of allZones) {
    if (usedZoneIds.has(zone.id)) continue;
    if (zone.capacity != null && zone.currentOccupancy != null && zone.currentOccupancy >= zone.capacity) continue;

    suggestions.push({
      zoneId: zone.id,
      zoneName: zone.zoneName,
      zoneCode: zone.zoneCode,
      reason: 'Available zone',
      confidence: 'low',
    });
    usedZoneIds.add(zone.id);
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

const LIST_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  targetZone: { select: { id: true, zoneName: true, zoneCode: true } },
} satisfies Prisma.PutAwayRuleInclude;

export async function listRules(warehouseId?: string) {
  const where: Prisma.PutAwayRuleWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;

  return prisma.putAwayRule.findMany({
    where,
    orderBy: { priority: 'asc' },
    include: LIST_INCLUDE,
  });
}

export async function getRuleById(id: string) {
  const rule = await prisma.putAwayRule.findUnique({
    where: { id },
    include: LIST_INCLUDE,
  });
  if (!rule) throw new NotFoundError('PutAwayRule', id);
  return rule;
}

export async function createRule(data: Prisma.PutAwayRuleUncheckedCreateInput): Promise<PutAwayRule> {
  return prisma.putAwayRule.create({ data, include: LIST_INCLUDE }) as unknown as PutAwayRule;
}

export async function updateRule(id: string, data: Prisma.PutAwayRuleUncheckedUpdateInput): Promise<PutAwayRule> {
  const existing = await prisma.putAwayRule.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PutAwayRule', id);

  return prisma.putAwayRule.update({ where: { id }, data, include: LIST_INCLUDE }) as unknown as PutAwayRule;
}

export async function deleteRule(id: string): Promise<void> {
  const existing = await prisma.putAwayRule.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PutAwayRule', id);

  await prisma.putAwayRule.delete({ where: { id } });
}
