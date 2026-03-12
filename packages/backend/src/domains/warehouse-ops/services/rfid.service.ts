/**
 * RFID Tag Service — P6
 *
 * Manages RFID tag lifecycle: registration, association with LPNs/items/assets,
 * scan events, and deactivation.
 */
import type { Prisma, RfidTag } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RfidFilters {
  warehouseId?: string;
  tagType?: string;
  isActive?: boolean;
  lpnId?: string;
  page?: number;
  pageSize?: number;
}

export interface RfidStats {
  totalActive: number;
  totalInactive: number;
  byType: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const DETAIL_INCLUDE = {
  lpn: { select: { id: true, lpnNumber: true, status: true } },
  item: { select: { id: true, itemCode: true, itemDescription: true } },
  asset: { select: { id: true, assetCode: true, description: true } },
  warehouse: { select: { id: true, warehouseName: true } },
} satisfies Prisma.RfidTagInclude;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Registers a new RFID tag with EPC, type, and optional entity associations. */
export async function registerTag(data: {
  epc: string;
  tagType: string;
  warehouseId: string;
  lpnId?: string;
  itemId?: string;
  assetId?: string;
}): Promise<RfidTag> {
  return prisma.rfidTag.create({
    data,
    include: DETAIL_INCLUDE,
  }) as unknown as RfidTag;
}

/** Retrieves an RFID tag by ID, throwing NotFoundError if missing. */
export async function getTagById(id: string) {
  const tag = await prisma.rfidTag.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!tag) throw new NotFoundError('RfidTag', id);
  return tag;
}

/** Retrieves an RFID tag by EPC code, throwing NotFoundError if missing. */
export async function getTagByEpc(epc: string) {
  const tag = await prisma.rfidTag.findUnique({
    where: { epc },
    include: DETAIL_INCLUDE,
  });
  if (!tag) throw new NotFoundError('RfidTag', epc);
  return tag;
}

/** Lists RFID tags with optional warehouse/type/active/LPN filters and pagination. */
export async function getTags(filters: RfidFilters) {
  const where: Prisma.RfidTagWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.tagType) where.tagType = filters.tagType;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.lpnId) where.lpnId = filters.lpnId;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.rfidTag.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.rfidTag.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Scan Event — update lastSeenAt + lastReaderId
// ---------------------------------------------------------------------------

/** Records a scan event, updating lastSeenAt and lastReaderId. Rejects deactivated tags. */
export async function recordScan(epc: string, readerId: string) {
  const tag = await prisma.rfidTag.findUnique({ where: { epc } });
  if (!tag) throw new NotFoundError('RfidTag', epc);
  if (!tag.isActive) throw new Error('Tag is deactivated');

  return prisma.rfidTag.update({
    where: { epc },
    data: {
      lastSeenAt: new Date(),
      lastReaderId: readerId,
    },
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Bulk scan — process multiple EPCs from a reader
// ---------------------------------------------------------------------------

/** Processes multiple RFID scan events from a reader, returning found/not-found results. */
export async function bulkScan(scans: { epc: string; readerId: string }[]) {
  const results: { epc: string; found: boolean; tagType?: string }[] = [];

  for (const scan of scans) {
    const tag = await prisma.rfidTag.findUnique({ where: { epc: scan.epc } });
    if (tag && tag.isActive) {
      await prisma.rfidTag.update({
        where: { epc: scan.epc },
        data: { lastSeenAt: new Date(), lastReaderId: scan.readerId },
      });
      results.push({ epc: scan.epc, found: true, tagType: tag.tagType });
    } else {
      results.push({ epc: scan.epc, found: false });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Associate / Dissociate
// ---------------------------------------------------------------------------

/** Associates an RFID tag with an LPN, setting tagType to 'lpn'. */
export async function associateWithLpn(id: string, lpnId: string) {
  const tag = await prisma.rfidTag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError('RfidTag', id);

  return prisma.rfidTag.update({
    where: { id },
    data: { lpnId, tagType: 'lpn' },
    include: DETAIL_INCLUDE,
  });
}

/** Deactivates an RFID tag, preventing future scan events. */
export async function deactivate(id: string) {
  const tag = await prisma.rfidTag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError('RfidTag', id);

  return prisma.rfidTag.update({
    where: { id },
    data: { isActive: false },
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Returns active/inactive tag counts and breakdown by type, optionally filtered by warehouse. */
export async function getStats(warehouseId?: string): Promise<RfidStats> {
  const where: Prisma.RfidTagWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const [active, inactive, lpnCount, itemCount, assetCount, gateCount] = await Promise.all([
    prisma.rfidTag.count({ where: { ...where, isActive: true } }),
    prisma.rfidTag.count({ where: { ...where, isActive: false } }),
    prisma.rfidTag.count({ where: { ...where, tagType: 'lpn', isActive: true } }),
    prisma.rfidTag.count({ where: { ...where, tagType: 'item', isActive: true } }),
    prisma.rfidTag.count({ where: { ...where, tagType: 'asset', isActive: true } }),
    prisma.rfidTag.count({ where: { ...where, tagType: 'zone_gate', isActive: true } }),
  ]);

  return {
    totalActive: active,
    totalInactive: inactive,
    byType: { lpn: lpnCount, item: itemCount, asset: assetCount, zone_gate: gateCount },
  };
}
