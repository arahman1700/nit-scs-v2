/**
 * License Plate Number (LPN) Service — V2
 *
 * Manages the full lifecycle of license plates (pallets, cartons, totes, etc.)
 * within the warehouse: create, receive, store, pick, pack, ship, dissolve.
 * Also handles content management and location moves.
 */
import type { Prisma, LicensePlate } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LpnFilters {
  warehouseId?: string;
  status?: string;
  lpnType?: string;
  page?: number;
  pageSize?: number;
}

export interface LpnStats {
  created: number;
  inReceiving: number;
  stored: number;
  inPicking: number;
  inPacking: number;
  shipped: number;
  dissolved: number;
}

export interface AddContentInput {
  itemId: string;
  lotId?: string;
  quantity: number;
  uomId?: string;
  expiryDate?: Date;
}

export interface MoveLpnInput {
  zoneId?: string;
  binId?: string;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const DETAIL_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  zone: { select: { id: true, zoneName: true, zoneCode: true } },
  bin: { select: { id: true, locationCode: true } },
  contents: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
  },
  rfidTags: true,
} satisfies Prisma.LicensePlateInclude;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Creates a new license plate record with warehouse/zone/bin associations. */
export async function createLpn(data: Prisma.LicensePlateUncheckedCreateInput): Promise<LicensePlate> {
  return prisma.licensePlate.create({
    data,
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

/** Retrieves a single LPN by ID, throwing NotFoundError if missing. */
export async function getLpnById(id: string) {
  const record = await prisma.licensePlate.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('LicensePlate', id);
  return record;
}

/** Lists LPNs with optional warehouse/status/type filters and pagination. */
export async function getLpns(filters: LpnFilters) {
  const where: Prisma.LicensePlateWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.status) where.status = filters.status;
  if (filters.lpnType) where.lpnType = filters.lpnType;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.licensePlate.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.licensePlate.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/** Transitions LPN from 'created' to 'in_receiving'. */
export async function receiveLpn(id: string): Promise<LicensePlate> {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);
  if (record.status !== 'created') {
    throw new Error(`Cannot receive LPN in status '${record.status}'. Must be 'created'.`);
  }

  return prisma.licensePlate.update({
    where: { id },
    data: { status: 'in_receiving' },
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

/** Transitions LPN from 'in_receiving' to 'stored'. */
export async function storeLpn(id: string): Promise<LicensePlate> {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);
  if (record.status !== 'in_receiving') {
    throw new Error(`Cannot store LPN in status '${record.status}'. Must be 'in_receiving'.`);
  }

  return prisma.licensePlate.update({
    where: { id },
    data: { status: 'stored' },
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

/** Transitions LPN from 'stored' to 'in_picking'. */
export async function pickLpn(id: string): Promise<LicensePlate> {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);
  if (record.status !== 'stored') {
    throw new Error(`Cannot pick LPN in status '${record.status}'. Must be 'stored'.`);
  }

  return prisma.licensePlate.update({
    where: { id },
    data: { status: 'in_picking' },
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

/** Transitions LPN from 'in_picking' to 'in_packing'. */
export async function packLpn(id: string): Promise<LicensePlate> {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);
  if (record.status !== 'in_picking') {
    throw new Error(`Cannot pack LPN in status '${record.status}'. Must be 'in_picking'.`);
  }

  return prisma.licensePlate.update({
    where: { id },
    data: { status: 'in_packing' },
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

/** Transitions LPN from 'in_packing' to 'shipped'. */
export async function shipLpn(id: string): Promise<LicensePlate> {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);
  if (record.status !== 'in_packing') {
    throw new Error(`Cannot ship LPN in status '${record.status}'. Must be 'in_packing'.`);
  }

  return prisma.licensePlate.update({
    where: { id },
    data: { status: 'shipped' },
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

/** Dissolves an LPN (allowed from any non-terminal state). */
export async function dissolveLpn(id: string): Promise<LicensePlate> {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);
  if (record.status === 'shipped') {
    throw new Error("Cannot dissolve LPN in status 'shipped'.");
  }
  if (record.status === 'dissolved') {
    throw new Error("Cannot dissolve LPN in status 'dissolved'.");
  }

  return prisma.licensePlate.update({
    where: { id },
    data: { status: 'dissolved' },
    include: DETAIL_INCLUDE,
  }) as unknown as LicensePlate;
}

// ---------------------------------------------------------------------------
// Move LPN
// ---------------------------------------------------------------------------

/** Relocates an LPN to a different zone and/or bin. */
export async function moveLpn(id: string, input: MoveLpnInput) {
  const record = await prisma.licensePlate.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LicensePlate', id);

  const data: Prisma.LicensePlateUncheckedUpdateInput = {};
  if (input.zoneId !== undefined) data.zoneId = input.zoneId;
  if (input.binId !== undefined) data.binId = input.binId;

  return prisma.licensePlate.update({
    where: { id },
    data,
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Content management
// ---------------------------------------------------------------------------

/** Adds an item/lot content line to an existing LPN. */
export async function addContent(lpnId: string, input: AddContentInput) {
  const record = await prisma.licensePlate.findUnique({ where: { id: lpnId } });
  if (!record) throw new NotFoundError('LicensePlate', lpnId);

  return prisma.lpnContent.create({
    data: {
      lpnId,
      itemId: input.itemId,
      lotId: input.lotId,
      quantity: input.quantity,
      uomId: input.uomId,
      expiryDate: input.expiryDate,
    },
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
  });
}

/** Removes a content line from an LPN by content ID. */
export async function removeContent(contentId: string) {
  const content = await prisma.lpnContent.findUnique({ where: { id: contentId } });
  if (!content) throw new NotFoundError('LpnContent', contentId);

  return prisma.lpnContent.delete({ where: { id: contentId } });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Returns LPN counts grouped by status, optionally filtered by warehouse. */
export async function getStats(warehouseId?: string): Promise<LpnStats> {
  const where: Prisma.LicensePlateWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const [created, inReceiving, stored, inPicking, inPacking, shipped, dissolved] = await Promise.all([
    prisma.licensePlate.count({ where: { ...where, status: 'created' } }),
    prisma.licensePlate.count({ where: { ...where, status: 'in_receiving' } }),
    prisma.licensePlate.count({ where: { ...where, status: 'stored' } }),
    prisma.licensePlate.count({ where: { ...where, status: 'in_picking' } }),
    prisma.licensePlate.count({ where: { ...where, status: 'in_packing' } }),
    prisma.licensePlate.count({ where: { ...where, status: 'shipped' } }),
    prisma.licensePlate.count({ where: { ...where, status: 'dissolved' } }),
  ]);

  return {
    created,
    inReceiving,
    stored,
    inPicking,
    inPacking,
    shipped,
    dissolved,
  };
}
