/**
 * Wave Picking Service
 *
 * Groups multiple MIs (Material Issues) into a single "wave" so that a
 * warehouse picker can fulfill them in one optimized run.  Waves are stored
 * in-memory (no schema change needed).
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { optimizePickPath } from './pick-optimizer.service.js';
import type { PickPath } from './pick-optimizer.service.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface Wave {
  id: string;
  warehouseId: string;
  miIds: string[];
  status: 'created' | 'picking' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  pickPath?: PickPath;
  itemCount: number;
  totalQuantity: number;
}

// ── In-memory store ─────────────────────────────────────────────────────

const waves = new Map<string, Wave>();

// ── Create Wave ─────────────────────────────────────────────────────────

export async function createWave(warehouseId: string, miIds: string[]): Promise<Wave> {
  if (miIds.length === 0) {
    throw new Error('At least one MI is required to create a wave');
  }

  // Validate that all MIs exist and belong to this warehouse
  const mis = await prisma.mirv.findMany({
    where: {
      id: { in: miIds },
      warehouseId,
      status: { in: ['approved', 'partially_issued'] },
    },
    select: { id: true, mirvNumber: true },
  });

  if (mis.length === 0) {
    throw new Error('No approved MIs found for the specified warehouse');
  }

  const foundIds = new Set(mis.map(m => m.id));
  const missingIds = miIds.filter(id => !foundIds.has(id));
  if (missingIds.length > 0) {
    log('warn', `[WavePicking] Some MI IDs not found or not eligible: ${missingIds.join(', ')}`);
  }

  // Gather all line items from the valid MIs
  const lines = await prisma.mirvLine.findMany({
    where: { mirvId: { in: [...foundIds] } },
    select: {
      itemId: true,
      qtyRequested: true,
      qtyIssued: true,
    },
  });

  // Aggregate items (same item from different MIs is merged)
  const itemAgg = new Map<string, number>();
  for (const line of lines) {
    const remaining = Number(line.qtyRequested) - Number(line.qtyIssued ?? 0);
    if (remaining > 0) {
      itemAgg.set(line.itemId, (itemAgg.get(line.itemId) ?? 0) + remaining);
    }
  }

  const items = Array.from(itemAgg.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));

  if (items.length === 0) {
    throw new Error('No outstanding items to pick from the selected MIs');
  }

  // Generate optimized pick path
  const pickPath = await optimizePickPath(warehouseId, items);

  const wave: Wave = {
    id: randomUUID(),
    warehouseId,
    miIds: [...foundIds],
    status: 'created',
    createdAt: new Date(),
    pickPath,
    itemCount: items.length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
  };

  waves.set(wave.id, wave);
  log('info', `[WavePicking] Created wave ${wave.id}: ${wave.miIds.length} MIs, ${wave.itemCount} items`);

  return wave;
}

// ── Get Wave ────────────────────────────────────────────────────────────

export function getWave(waveId: string): Wave | undefined {
  return waves.get(waveId);
}

// ── Get Wave Pick List ──────────────────────────────────────────────────

export async function getWavePickList(waveId: string): Promise<PickPath> {
  const wave = waves.get(waveId);
  if (!wave) {
    throw new Error(`Wave ${waveId} not found`);
  }

  if (wave.pickPath) {
    return wave.pickPath;
  }

  // Regenerate pick path (shouldn't normally happen)
  const lines = await prisma.mirvLine.findMany({
    where: { mirvId: { in: wave.miIds } },
    select: { itemId: true, qtyRequested: true, qtyIssued: true },
  });

  const itemAgg = new Map<string, number>();
  for (const line of lines) {
    const remaining = Number(line.qtyRequested) - Number(line.qtyIssued ?? 0);
    if (remaining > 0) {
      itemAgg.set(line.itemId, (itemAgg.get(line.itemId) ?? 0) + remaining);
    }
  }

  const items = Array.from(itemAgg.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));

  const pickPath = await optimizePickPath(wave.warehouseId, items);
  wave.pickPath = pickPath;
  return pickPath;
}

// ── List Waves ──────────────────────────────────────────────────────────

export function getWaves(warehouseId?: string, status?: string): Wave[] {
  let result = Array.from(waves.values());

  if (warehouseId) {
    result = result.filter(w => w.warehouseId === warehouseId);
  }
  if (status) {
    result = result.filter(w => w.status === status);
  }

  // Sort newest first
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return result;
}

// ── Start Picking ───────────────────────────────────────────────────────

export function startPicking(waveId: string): Wave {
  const wave = waves.get(waveId);
  if (!wave) throw new Error(`Wave ${waveId} not found`);
  if (wave.status !== 'created') throw new Error('Can only start picking on a created wave');

  wave.status = 'picking';
  log('info', `[WavePicking] Wave ${waveId} started picking`);
  return wave;
}

// ── Complete Wave ───────────────────────────────────────────────────────

export function completeWave(waveId: string): Wave {
  const wave = waves.get(waveId);
  if (!wave) throw new Error(`Wave ${waveId} not found`);
  if (wave.status === 'completed') throw new Error('Wave already completed');

  wave.status = 'completed';
  wave.completedAt = new Date();
  log('info', `[WavePicking] Wave ${waveId} completed`);
  return wave;
}
