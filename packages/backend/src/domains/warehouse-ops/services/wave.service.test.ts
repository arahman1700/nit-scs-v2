import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  createWave,
  getWaveById,
  getWaves,
  addLines,
  confirmPick,
  release,
  startPicking,
  complete,
  cancel,
  getStats,
} from './wave.service.js';

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WH_ID = 'wh-001';

function makeWaveRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wave-001',
    waveNumber: 'WV-001',
    warehouseId: WH_ID,
    status: 'planning',
    waveType: 'manual',
    releasedAt: null,
    completedAt: null,
    totalLines: 0,
    pickedLines: 0,
    createdById: 'user-001',
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    warehouse: { id: WH_ID, warehouseName: 'Main WH', warehouseCode: 'WH-01' },
    createdBy: { id: 'user-001', employeeCode: 'EMP-001', firstName: 'John', lastName: 'Doe' },
    lines: [],
    ...overrides,
  };
}

function makeWaveLineRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wl-001',
    waveId: 'wave-001',
    mirvId: 'mirv-001',
    mirvLineId: null,
    itemId: 'item-001',
    qtyRequired: 100,
    qtyPicked: 0,
    fromZoneId: null,
    fromBinId: null,
    lotId: null,
    status: 'pending',
    pickedById: null,
    pickedAt: null,
    sequence: 1,
    createdAt: new Date('2026-02-01T10:00:00Z'),
    wave: makeWaveRecord(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('wave.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).waveHeader = createModelMock();
    (mockPrisma as Record<string, unknown>).waveLine = createModelMock();
  });

  const waveHeader = () => (mockPrisma as unknown as { waveHeader: PrismaModelMock }).waveHeader;
  const waveLine = () => (mockPrisma as unknown as { waveLine: PrismaModelMock }).waveLine;

  // ########################################################################
  // createWave
  // ########################################################################

  describe('createWave', () => {
    it('should create a wave record with given data', async () => {
      const input = { waveNumber: 'WV-001', warehouseId: WH_ID, waveType: 'manual' };
      const created = makeWaveRecord();
      waveHeader().create.mockResolvedValue(created);

      const result = await createWave(input as never);

      expect(waveHeader().create).toHaveBeenCalledWith({
        data: input,
        include: expect.objectContaining({
          warehouse: expect.any(Object),
          createdBy: expect.any(Object),
          lines: expect.any(Object),
        }),
      });
      expect(result).toEqual(created);
    });
  });

  // ########################################################################
  // getWaveById
  // ########################################################################

  describe('getWaveById', () => {
    it('should return the record when found', async () => {
      const record = makeWaveRecord();
      waveHeader().findUnique.mockResolvedValue(record);

      const result = await getWaveById('wave-001');

      expect(waveHeader().findUnique).toHaveBeenCalledWith({
        where: { id: 'wave-001' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result).toEqual(record);
    });

    it('should throw NotFoundError when record does not exist', async () => {
      waveHeader().findUnique.mockResolvedValue(null);
      await expect(getWaveById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getWaves
  // ########################################################################

  describe('getWaves', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeWaveRecord()];
      waveHeader().findMany.mockResolvedValue(records);
      waveHeader().count.mockResolvedValue(1);

      const result = await getWaves({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
      expect(waveHeader().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 25, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should apply warehouseId and status filters', async () => {
      waveHeader().findMany.mockResolvedValue([]);
      waveHeader().count.mockResolvedValue(0);

      await getWaves({ warehouseId: WH_ID, status: 'released' });

      expect(waveHeader().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID, status: 'released' }),
        }),
      );
    });

    it('should apply waveType filter', async () => {
      waveHeader().findMany.mockResolvedValue([]);
      waveHeader().count.mockResolvedValue(0);

      await getWaves({ waveType: 'priority' });

      expect(waveHeader().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ waveType: 'priority' }),
        }),
      );
    });

    it('should handle custom page and pageSize', async () => {
      waveHeader().findMany.mockResolvedValue([]);
      waveHeader().count.mockResolvedValue(50);

      const result = await getWaves({ page: 3, pageSize: 10 });

      expect(waveHeader().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });
  });

  // ########################################################################
  // addLines
  // ########################################################################

  describe('addLines', () => {
    it('should add lines to a planning wave', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'planning' }));
      waveLine().createMany.mockResolvedValue({ count: 2 });
      waveHeader().update.mockResolvedValue(makeWaveRecord({ totalLines: 2 }));

      const lines = [
        { mirvId: 'mirv-001', itemId: 'item-001', qtyRequired: 50 },
        { mirvId: 'mirv-002', itemId: 'item-002', qtyRequired: 30 },
      ];

      const result = await addLines('wave-001', lines);

      expect(waveLine().createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ waveId: 'wave-001', mirvId: 'mirv-001', sequence: 1 }),
          expect.objectContaining({ waveId: 'wave-001', mirvId: 'mirv-002', sequence: 2 }),
        ]),
      });
      expect(waveHeader().update).toHaveBeenCalledWith({
        where: { id: 'wave-001' },
        data: { totalLines: { increment: 2 } },
      });
    });

    it('should throw NotFoundError when wave does not exist', async () => {
      waveHeader().findUnique.mockResolvedValue(null);
      await expect(addLines('nonexistent', [])).rejects.toThrow(NotFoundError);
    });

    it('should throw error when wave is not in planning status', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'released' }));
      await expect(addLines('wave-001', [])).rejects.toThrow(
        "Cannot add lines to wave in status 'released'. Must be 'planning'.",
      );
    });
  });

  // ########################################################################
  // confirmPick
  // ########################################################################

  describe('confirmPick', () => {
    it('should confirm pick on a line and increment wave pickedLines', async () => {
      const line = makeWaveLineRecord();
      waveLine().findUnique.mockResolvedValue(line);
      waveLine().update.mockResolvedValue({ ...line, qtyPicked: 80, status: 'picked' });
      waveHeader().update.mockResolvedValue(makeWaveRecord({ pickedLines: 1 }));

      const result = await confirmPick('wl-001', { qtyPicked: 80, pickedById: 'picker-001' });

      expect(waveLine().update).toHaveBeenCalledWith({
        where: { id: 'wl-001' },
        data: expect.objectContaining({
          qtyPicked: 80,
          pickedById: 'picker-001',
          status: 'picked',
          pickedAt: expect.any(Date),
        }),
      });
      expect(waveHeader().update).toHaveBeenCalledWith({
        where: { id: 'wave-001' },
        data: { pickedLines: { increment: 1 } },
      });
    });

    it('should throw NotFoundError when line does not exist', async () => {
      waveLine().findUnique.mockResolvedValue(null);
      await expect(confirmPick('nonexistent', { qtyPicked: 10, pickedById: 'p-1' })).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // release
  // ########################################################################

  describe('release', () => {
    it('should release a planning wave', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'planning', totalLines: 5 }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'released', releasedAt: new Date() }));

      const result = await release('wave-001');

      expect(waveHeader().update).toHaveBeenCalledWith({
        where: { id: 'wave-001' },
        data: { status: 'released', releasedAt: expect.any(Date) },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('released');
    });

    it('should throw NotFoundError when not found', async () => {
      waveHeader().findUnique.mockResolvedValue(null);
      await expect(release('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not planning', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'picking' }));
      await expect(release('wave-001')).rejects.toThrow("Cannot release wave in status 'picking'. Must be 'planning'.");
    });
  });

  // ########################################################################
  // startPicking
  // ########################################################################

  describe('startPicking', () => {
    it('should start picking for a released wave', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'released' }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'picking' }));

      const result = await startPicking('wave-001');

      expect(waveHeader().update).toHaveBeenCalledWith({
        where: { id: 'wave-001' },
        data: { status: 'picking' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('picking');
    });

    it('should throw error when status is not released', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'planning' }));
      await expect(startPicking('wave-001')).rejects.toThrow(
        "Cannot start picking for wave in status 'planning'. Must be 'released'.",
      );
    });
  });

  // ########################################################################
  // complete
  // ########################################################################

  describe('complete', () => {
    it('should complete a picking wave with all lines in terminal state', async () => {
      const wave = makeWaveRecord({
        status: 'picking',
        lines: [
          { id: 'wl-1', status: 'picked' },
          { id: 'wl-2', status: 'short' },
          { id: 'wl-3', status: 'cancelled' },
        ],
      });
      waveHeader().findUnique.mockResolvedValue(wave);
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'completed', completedAt: new Date() }));

      const result = await complete('wave-001');

      expect(waveHeader().update).toHaveBeenCalledWith({
        where: { id: 'wave-001' },
        data: { status: 'completed', completedAt: expect.any(Date) },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('completed');
    });

    it('should throw error when lines are still pending', async () => {
      const wave = makeWaveRecord({
        status: 'picking',
        lines: [
          { id: 'wl-1', status: 'picked' },
          { id: 'wl-2', status: 'pending' },
        ],
      });
      waveHeader().findUnique.mockResolvedValue(wave);

      await expect(complete('wave-001')).rejects.toThrow(
        'Cannot complete wave: 1 line(s) still in non-terminal status.',
      );
    });

    it('should throw error when status is not picking', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'released', lines: [] }));
      await expect(complete('wave-001')).rejects.toThrow(
        "Cannot complete wave in status 'released'. Must be 'picking'.",
      );
    });

    it('should throw NotFoundError when not found', async () => {
      waveHeader().findUnique.mockResolvedValue(null);
      await expect(complete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // cancel
  // ########################################################################

  describe('cancel', () => {
    it('should cancel a planning wave', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'planning' }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'cancelled' }));

      const result = await cancel('wave-001');
      expect(result.status).toBe('cancelled');
    });

    it('should cancel a released wave', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'released' }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'cancelled' }));

      const result = await cancel('wave-001');
      expect(result.status).toBe('cancelled');
    });

    it('should cancel a picking wave', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'picking' }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'cancelled' }));

      const result = await cancel('wave-001');
      expect(result.status).toBe('cancelled');
    });

    it('should throw error when status is completed', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'completed' }));
      await expect(cancel('wave-001')).rejects.toThrow("Cannot cancel wave in status 'completed'.");
    });

    it('should throw error when status is already cancelled', async () => {
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'cancelled' }));
      await expect(cancel('wave-001')).rejects.toThrow("Cannot cancel wave in status 'cancelled'.");
    });

    it('should throw NotFoundError when not found', async () => {
      waveHeader().findUnique.mockResolvedValue(null);
      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getStats
  // ########################################################################

  describe('getStats', () => {
    it('should return all zero stats when no records exist', async () => {
      waveHeader().count.mockResolvedValue(0);

      const stats = await getStats();

      expect(stats).toEqual({
        planning: 0,
        released: 0,
        picking: 0,
        completed: 0,
        cancelled: 0,
      });
    });

    it('should compute correct counts by status', async () => {
      waveHeader()
        .count.mockResolvedValueOnce(5) // planning
        .mockResolvedValueOnce(3) // released
        .mockResolvedValueOnce(2) // picking
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(1); // cancelled

      const stats = await getStats();

      expect(stats.planning).toBe(5);
      expect(stats.released).toBe(3);
      expect(stats.picking).toBe(2);
      expect(stats.completed).toBe(10);
      expect(stats.cancelled).toBe(1);
    });

    it('should filter by warehouseId when provided', async () => {
      waveHeader().count.mockResolvedValue(0);

      await getStats(WH_ID);

      expect(waveHeader().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID }),
        }),
      );
    });
  });

  // ########################################################################
  // Full lifecycle
  // ########################################################################

  describe('full lifecycle', () => {
    it('should transition through all happy-path states', async () => {
      // planning -> released
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'planning', totalLines: 5 }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'released' }));
      const r1 = await release('wave-001');
      expect(r1.status).toBe('released');

      // released -> picking
      waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status: 'released' }));
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'picking' }));
      const r2 = await startPicking('wave-001');
      expect(r2.status).toBe('picking');

      // picking -> completed
      waveHeader().findUnique.mockResolvedValue(
        makeWaveRecord({ status: 'picking', lines: [{ id: 'wl-1', status: 'picked' }] }),
      );
      waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'completed' }));
      const r3 = await complete('wave-001');
      expect(r3.status).toBe('completed');
    });

    it('should allow cancellation at any non-terminal state', async () => {
      for (const status of ['planning', 'released', 'picking']) {
        waveHeader().findUnique.mockResolvedValue(makeWaveRecord({ status }));
        waveHeader().update.mockResolvedValue(makeWaveRecord({ status: 'cancelled' }));

        const result = await cancel('wave-001');
        expect(result.status).toBe('cancelled');
      }
    });
  });
});
