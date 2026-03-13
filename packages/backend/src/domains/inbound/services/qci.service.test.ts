import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../utils/safe-status-transition.js', () => ({
  safeStatusUpdate: vi.fn(async (delegate: any, id: string, expectedStatus: string, data: any) => {
    const result = await delegate.updateMany({ where: { id, status: expectedStatus }, data });
    return result.count;
  }),
  safeStatusUpdateTx: vi.fn(async (delegate: any, id: string, expectedStatus: string, data: any) => {
    const result = await delegate.updateMany({ where: { id, status: expectedStatus }, data });
    return result.count;
  }),
}));
vi.mock('../../system/services/document-number.service.js', () => ({
  generateDocumentNumber: vi.fn(),
}));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn(), canTransition: vi.fn() };
});

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { list, getById, update, start, complete } from './qci.service.js';
import { assertTransition, canTransition } from '@nit-scs-v2/shared';

const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;
const mockedCanTransition = canTransition as ReturnType<typeof vi.fn>;

describe('qci.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    const baseParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 25 };

    it('should return data and total', async () => {
      const rows = [{ id: 'rfim-1' }];
      mockPrisma.rfim.findMany.mockResolvedValue(rows);
      mockPrisma.rfim.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter on rfimNumber', async () => {
      mockPrisma.rfim.findMany.mockResolvedValue([]);
      mockPrisma.rfim.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'RFIM-001' });

      const where = mockPrisma.rfim.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR[0]).toEqual({ rfimNumber: { contains: 'RFIM-001', mode: 'insensitive' } });
    });

    it('should apply status filter', async () => {
      mockPrisma.rfim.findMany.mockResolvedValue([]);
      mockPrisma.rfim.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'pending' });

      const where = mockPrisma.rfim.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('pending');
    });

    it('should scope by warehouseId and projectId through mrrv relation', async () => {
      mockPrisma.rfim.findMany.mockResolvedValue([]);
      mockPrisma.rfim.count.mockResolvedValue(0);

      await list({ ...baseParams, warehouseId: 'wh-1', projectId: 'proj-1' });

      const where = mockPrisma.rfim.findMany.mock.calls[0][0].where;
      expect(where.mrrv).toEqual({ warehouseId: 'wh-1', projectId: 'proj-1' });
    });

    it('should apply inspectorId filter', async () => {
      mockPrisma.rfim.findMany.mockResolvedValue([]);
      mockPrisma.rfim.count.mockResolvedValue(0);

      await list({ ...baseParams, inspectorId: 'user-1' });

      const where = mockPrisma.rfim.findMany.mock.calls[0][0].where;
      expect(where.inspectorId).toBe('user-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the QCI when found', async () => {
      const qci = { id: 'rfim-1', rfimNumber: 'RFIM-001' };
      mockPrisma.rfim.findUnique.mockResolvedValue(qci);

      const result = await getById('rfim-1');

      expect(result).toEqual(qci);
      expect(mockPrisma.rfim.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rfim-1' } }));
    });

    it('should throw NotFoundError when QCI not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update an existing QCI', async () => {
      const existing = { id: 'rfim-1', comments: null, version: 0 };
      const updated = { id: 'rfim-1', comments: 'Updated', version: 1 };
      mockPrisma.rfim.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      mockPrisma.rfim.update.mockResolvedValue(updated);

      const result = await update('rfim-1', { comments: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when QCI not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // start
  // ─────────────────────────────────────────────────────────────────────────
  describe('start', () => {
    it('should transition QCI to in_progress and set inspectorId', async () => {
      const qci = { id: 'rfim-1', status: 'pending' };
      mockPrisma.rfim.findUnique
        .mockResolvedValueOnce(qci)
        .mockResolvedValueOnce({ ...qci, status: 'in_progress', inspectorId: 'user-1' });
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.rfim.updateMany.mockResolvedValue({ count: 1 });

      const result = await start('rfim-1', 'user-1');

      expect(result.status).toBe('in_progress');
      expect(mockedAssertTransition).toHaveBeenCalledWith('qci', 'pending', 'in_progress');
      expect(mockPrisma.rfim.updateMany).toHaveBeenCalledWith({
        where: { id: 'rfim-1', status: 'pending' },
        data: expect.objectContaining({
          status: 'in_progress',
          inspectorId: 'user-1',
        }),
      });
    });

    it('should throw NotFoundError when QCI not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(start('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should call assertTransition before updating', async () => {
      const qci = { id: 'rfim-1', status: 'completed' };
      mockPrisma.rfim.findUnique.mockResolvedValue(qci);
      mockedAssertTransition.mockImplementation(() => {
        throw new BusinessRuleError('Invalid transition');
      });

      await expect(start('rfim-1', 'user-1')).rejects.toThrow('Invalid transition');
      expect(mockPrisma.rfim.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // complete
  // ─────────────────────────────────────────────────────────────────────────
  describe('complete', () => {
    it('should complete QCI with pass result', async () => {
      const qci = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      const updated = { ...qci, status: 'completed', result: 'pass' };
      // First findUnique is outside transaction, second is inside (tx.rfim.findUnique)
      mockPrisma.rfim.findUnique.mockResolvedValueOnce(qci).mockResolvedValueOnce(updated);
      mockedAssertTransition.mockReturnValue(undefined);
      mockedCanTransition.mockReturnValue(false); // parent GRN not transitionable
      mockPrisma.rfim.updateMany.mockResolvedValue({ count: 1 });

      const result = await complete('rfim-1', 'pass', 'All good');

      expect(result).toEqual({ updated, mrrvId: 'mrrv-1' });
      expect(mockPrisma.rfim.updateMany).toHaveBeenCalledWith({
        where: { id: 'rfim-1', status: 'in_progress' },
        data: { status: 'completed', result: 'pass', comments: 'All good' },
      });
    });

    it('should complete QCI with fail result', async () => {
      const qci = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: 'existing' };
      mockPrisma.rfim.findUnique
        .mockResolvedValueOnce(qci)
        .mockResolvedValueOnce({ ...qci, status: 'completed', result: 'fail' });
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.rfim.updateMany.mockResolvedValue({ count: 1 });
      // Mock for auto-create DR check: existing DR found, so no new DR created
      mockPrisma.osdReport.findFirst.mockResolvedValue({ id: 'dr-existing' });

      await complete('rfim-1', 'fail');

      const updateArgs = mockPrisma.rfim.updateMany.mock.calls[0][0];
      expect(updateArgs.data.result).toBe('fail');
      // comments should fall back to existing when not provided
      expect(updateArgs.data.comments).toBe('existing');
    });

    it('should throw NotFoundError when QCI not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(complete('nonexistent', 'pass')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError for invalid result', async () => {
      const qci = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      mockPrisma.rfim.findUnique.mockResolvedValue(qci);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(complete('rfim-1', 'invalid')).rejects.toThrow(
        'Inspection result is required (pass, fail, or conditional)',
      );
    });

    it('should throw BusinessRuleError for empty result', async () => {
      const qci = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      mockPrisma.rfim.findUnique.mockResolvedValue(qci);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(complete('rfim-1', '')).rejects.toThrow(
        'Inspection result is required (pass, fail, or conditional)',
      );
    });
  });
});
