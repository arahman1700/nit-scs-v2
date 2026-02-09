import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, update, start, complete } from './rfim.service.js';
import { assertTransition } from '@nit-scs-v2/shared';

const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

describe('rfim.service', () => {
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
    it('should return the RFIM when found', async () => {
      const rfim = { id: 'rfim-1', rfimNumber: 'RFIM-001' };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);

      const result = await getById('rfim-1');

      expect(result).toEqual(rfim);
      expect(mockPrisma.rfim.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rfim-1' } }));
    });

    it('should throw NotFoundError when RFIM not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update an existing RFIM', async () => {
      const existing = { id: 'rfim-1', comments: null };
      const updated = { id: 'rfim-1', comments: 'Updated' };
      mockPrisma.rfim.findUnique.mockResolvedValue(existing);
      mockPrisma.rfim.update.mockResolvedValue(updated);

      const result = await update('rfim-1', { comments: 'Updated' });

      expect(result).toEqual({ existing, updated });
      expect(mockPrisma.rfim.update).toHaveBeenCalledWith({
        where: { id: 'rfim-1' },
        data: { comments: 'Updated' },
      });
    });

    it('should throw NotFoundError when RFIM not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // start
  // ─────────────────────────────────────────────────────────────────────────
  describe('start', () => {
    it('should transition RFIM to in_progress and set inspectorId', async () => {
      const rfim = { id: 'rfim-1', status: 'pending' };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.rfim.update.mockResolvedValue({ ...rfim, status: 'in_progress', inspectorId: 'user-1' });

      const result = await start('rfim-1', 'user-1');

      expect(result.status).toBe('in_progress');
      expect(mockedAssertTransition).toHaveBeenCalledWith('rfim', 'pending', 'in_progress');
      expect(mockPrisma.rfim.update).toHaveBeenCalledWith({
        where: { id: 'rfim-1' },
        data: expect.objectContaining({
          status: 'in_progress',
          inspectorId: 'user-1',
        }),
      });
    });

    it('should throw NotFoundError when RFIM not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(start('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should call assertTransition before updating', async () => {
      const rfim = { id: 'rfim-1', status: 'completed' };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);
      mockedAssertTransition.mockImplementation(() => {
        throw new BusinessRuleError('Invalid transition');
      });

      await expect(start('rfim-1', 'user-1')).rejects.toThrow('Invalid transition');
      expect(mockPrisma.rfim.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // complete
  // ─────────────────────────────────────────────────────────────────────────
  describe('complete', () => {
    it('should complete RFIM with pass result', async () => {
      const rfim = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);
      mockedAssertTransition.mockReturnValue(undefined);
      const updated = { ...rfim, status: 'completed', result: 'pass' };
      mockPrisma.rfim.update.mockResolvedValue(updated);

      const result = await complete('rfim-1', 'pass', 'All good');

      expect(result).toEqual({ updated, mrrvId: 'mrrv-1' });
      expect(mockPrisma.rfim.update).toHaveBeenCalledWith({
        where: { id: 'rfim-1' },
        data: { status: 'completed', result: 'pass', comments: 'All good' },
      });
    });

    it('should complete RFIM with fail result', async () => {
      const rfim = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: 'existing' };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.rfim.update.mockResolvedValue({ ...rfim, status: 'completed', result: 'fail' });

      await complete('rfim-1', 'fail');

      const updateArgs = mockPrisma.rfim.update.mock.calls[0][0];
      expect(updateArgs.data.result).toBe('fail');
      // comments should fall back to existing when not provided
      expect(updateArgs.data.comments).toBe('existing');
    });

    it('should throw NotFoundError when RFIM not found', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(complete('nonexistent', 'pass')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError for invalid result', async () => {
      const rfim = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(complete('rfim-1', 'invalid')).rejects.toThrow(
        'Inspection result is required (pass, fail, or conditional)',
      );
    });

    it('should throw BusinessRuleError for empty result', async () => {
      const rfim = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      mockPrisma.rfim.findUnique.mockResolvedValue(rfim);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(complete('rfim-1', '')).rejects.toThrow(
        'Inspection result is required (pass, fail, or conditional)',
      );
    });
  });
});
