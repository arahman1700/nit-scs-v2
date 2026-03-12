/**
 * Wave Picking Service — V2
 *
 * Batch-based pick optimization: groups multiple MI pick lines into waves
 * for warehouse-floor execution. Manages the full lifecycle:
 * planning -> released -> picking -> completed (or cancelled).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaveFilters {
  warehouseId?: string;
  status?: string;
  waveType?: string;
  page?: number;
  pageSize?: number;
}

export interface WaveLineInput {
  mirvId: string;
  mirvLineId?: string;
  itemId: string;
  qtyRequired: number;
  fromZoneId?: string;
  fromBinId?: string;
  lotId?: string;
}

export interface ConfirmPickInput {
  qtyPicked: number;
  pickedById: string;
}

export interface WaveStats {
  planning: number;
  released: number;
  picking: number;
  completed: number;
  cancelled: number;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const DETAIL_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  createdBy: { select: { id: true, employeeIdNumber: true, fullName: true } },
  lines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      fromZone: { select: { id: true, zoneName: true, zoneCode: true } },
    },
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.WaveHeaderInclude;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Creates a new wave header in 'planning' status. */
export async function createWave(data: Prisma.WaveHeaderUncheckedCreateInput) {
  return prisma.waveHeader.create({
    data,
    include: DETAIL_INCLUDE,
  });
}

/** Retrieves a single wave by ID with lines, throwing NotFoundError if missing. */
export async function getWaveById(id: string) {
  const record = await prisma.waveHeader.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('WaveHeader', id);
  return record;
}

/** Lists waves with optional warehouse/status/type filters and pagination. */
export async function getWaves(filters: WaveFilters) {
  const where: Prisma.WaveHeaderWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.status) where.status = filters.status;
  if (filters.waveType) where.waveType = filters.waveType;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.waveHeader.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.waveHeader.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Line management
// ---------------------------------------------------------------------------

/** Adds pick lines to a wave in 'planning' status and increments totalLines. */
export async function addLines(waveId: string, lines: WaveLineInput[]) {
  const wave = await prisma.waveHeader.findUnique({ where: { id: waveId } });
  if (!wave) throw new NotFoundError('WaveHeader', waveId);
  if (wave.status !== 'planning') {
    throw new Error(`Cannot add lines to wave in status '${wave.status}'. Must be 'planning'.`);
  }

  const created = await prisma.waveLine.createMany({
    data: lines.map((line, idx) => ({
      waveId,
      mirvId: line.mirvId,
      mirvLineId: line.mirvLineId,
      itemId: line.itemId,
      qtyRequired: line.qtyRequired,
      fromZoneId: line.fromZoneId,
      fromBinId: line.fromBinId,
      lotId: line.lotId,
      sequence: idx + 1,
    })),
  });

  // Update totalLines
  await prisma.waveHeader.update({
    where: { id: waveId },
    data: { totalLines: { increment: lines.length } },
  });

  return created;
}

/** Confirms a pick for a wave line, recording quantity picked and picker. */
export async function confirmPick(lineId: string, input: ConfirmPickInput) {
  const line = await prisma.waveLine.findUnique({
    where: { id: lineId },
    include: { wave: true },
  });
  if (!line) throw new NotFoundError('WaveLine', lineId);

  const updatedLine = await prisma.waveLine.update({
    where: { id: lineId },
    data: {
      qtyPicked: input.qtyPicked,
      pickedById: input.pickedById,
      pickedAt: new Date(),
      status: 'picked',
    },
  });

  // Increment pickedLines on the wave header
  await prisma.waveHeader.update({
    where: { id: line.waveId },
    data: { pickedLines: { increment: 1 } },
  });

  return updatedLine;
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/** Releases a wave from 'planning' to 'released' for floor execution. */
export async function release(waveId: string) {
  const record = await prisma.waveHeader.findUnique({ where: { id: waveId } });
  if (!record) throw new NotFoundError('WaveHeader', waveId);
  if (record.status !== 'planning') {
    throw new Error(`Cannot release wave in status '${record.status}'. Must be 'planning'.`);
  }
  if ((record.totalLines ?? 0) === 0) {
    throw new Error('Cannot release wave with 0 lines.');
  }

  return prisma.waveHeader.update({
    where: { id: waveId },
    data: { status: 'released', releasedAt: new Date() },
    include: DETAIL_INCLUDE,
  });
}

/** Transitions a released wave to 'picking' status. */
export async function startPicking(waveId: string) {
  const record = await prisma.waveHeader.findUnique({ where: { id: waveId } });
  if (!record) throw new NotFoundError('WaveHeader', waveId);
  if (record.status !== 'released') {
    throw new Error(`Cannot start picking for wave in status '${record.status}'. Must be 'released'.`);
  }

  return prisma.waveHeader.update({
    where: { id: waveId },
    data: { status: 'picking' },
    include: DETAIL_INCLUDE,
  });
}

/** Completes a wave, validating all lines are in a terminal state. */
export async function complete(waveId: string) {
  const record = await prisma.waveHeader.findUnique({
    where: { id: waveId },
    include: { lines: true },
  });
  if (!record) throw new NotFoundError('WaveHeader', waveId);
  if (record.status !== 'picking') {
    throw new Error(`Cannot complete wave in status '${record.status}'. Must be 'picking'.`);
  }

  // Validate all lines are in a terminal state
  const pendingLines = record.lines.filter(l => !['picked', 'short', 'cancelled'].includes(l.status));
  if (pendingLines.length > 0) {
    throw new Error(`Cannot complete wave: ${pendingLines.length} line(s) still in non-terminal status.`);
  }

  return prisma.waveHeader.update({
    where: { id: waveId },
    data: { status: 'completed', completedAt: new Date() },
    include: DETAIL_INCLUDE,
  });
}

/** Cancels a wave (allowed from any non-terminal state). */
export async function cancel(waveId: string) {
  const record = await prisma.waveHeader.findUnique({ where: { id: waveId } });
  if (!record) throw new NotFoundError('WaveHeader', waveId);
  if (record.status === 'completed' || record.status === 'cancelled') {
    throw new Error(`Cannot cancel wave in status '${record.status}'.`);
  }

  return prisma.waveHeader.update({
    where: { id: waveId },
    data: { status: 'cancelled' },
    include: DETAIL_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Returns wave counts grouped by status, optionally filtered by warehouse. */
export async function getStats(warehouseId?: string): Promise<WaveStats> {
  const where: Prisma.WaveHeaderWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const [planning, released, picking, completed, cancelled] = await Promise.all([
    prisma.waveHeader.count({ where: { ...where, status: 'planning' } }),
    prisma.waveHeader.count({ where: { ...where, status: 'released' } }),
    prisma.waveHeader.count({ where: { ...where, status: 'picking' } }),
    prisma.waveHeader.count({ where: { ...where, status: 'completed' } }),
    prisma.waveHeader.count({ where: { ...where, status: 'cancelled' } }),
  ]);

  return { planning, released, picking, completed, cancelled };
}
