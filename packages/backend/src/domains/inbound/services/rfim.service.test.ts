/**
 * Tests for rfim.service.ts — V1 backward-compat re-export wrapper.
 *
 * rfim.service.ts re-exports every public function from qci.service.ts.
 * These tests verify:
 *   1. Each expected export exists and is a function.
 *   2. The re-exported reference is identical to the V2 service export.
 *   3. Calling through the re-export produces the same result as the V2 service.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

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
import { assertTransition } from '@nit-scs-v2/shared';

// Import from the V1 re-export wrapper
import * as rfimService from './rfim.service.js';

// Import from the V2 canonical service
import * as qciService from './qci.service.js';

const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── Expected exports ────────────────────────────────────────────────────
const expectedExports = ['list', 'getById', 'update', 'start', 'complete', 'completeConditional', 'pmApprove'] as const;

describe('rfim.service (V1 re-export wrapper)', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Export existence and type checks
  // ─────────────────────────────────────────────────────────────────────
  describe('exports', () => {
    it.each(expectedExports)('should export "%s" as a function', name => {
      expect(rfimService).toHaveProperty(name);
      expect(typeof (rfimService as Record<string, unknown>)[name]).toBe('function');
    });

    it('should export exactly the expected set of functions', () => {
      const exportedKeys = Object.keys(rfimService).sort();
      const expected = [...expectedExports].sort();
      expect(exportedKeys).toEqual(expected);
    });

    it('should not export any additional functions beyond the expected set', () => {
      const extraKeys = Object.keys(rfimService).filter(k => !(expectedExports as readonly string[]).includes(k));
      expect(extraKeys).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Identity checks — re-exports point to the same function references
  // ─────────────────────────────────────────────────────────────────────
  describe('identity with qci.service', () => {
    it.each(expectedExports)('"%s" should be the exact same reference as qci.service.%s', name => {
      expect((rfimService as Record<string, unknown>)[name]).toBe((qciService as Record<string, unknown>)[name]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Functional pass-through tests
  // ─────────────────────────────────────────────────────────────────────
  describe('functional pass-through', () => {
    it('list() should delegate to qci.service.list and return the same result', async () => {
      const rows = [{ id: 'rfim-1' }];
      mockPrisma.rfim.findMany.mockResolvedValue(rows);
      mockPrisma.rfim.count.mockResolvedValue(1);

      const result = await rfimService.list({
        sortBy: 'createdAt',
        sortDir: 'desc',
        skip: 0,
        pageSize: 25,
      });

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('getById() should delegate to qci.service.getById', async () => {
      const qci = { id: 'rfim-1', rfimNumber: 'RFIM-001' };
      mockPrisma.rfim.findUnique.mockResolvedValue(qci);

      const result = await rfimService.getById('rfim-1');

      expect(result).toEqual(qci);
    });

    it('getById() should throw NotFoundError for missing records', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(rfimService.getById('nonexistent')).rejects.toThrow('not found');
    });

    it('update() should delegate to qci.service.update', async () => {
      const existing = { id: 'rfim-1', comments: null };
      const updated = { id: 'rfim-1', comments: 'Updated' };
      mockPrisma.rfim.findUnique.mockResolvedValue(existing);
      mockPrisma.rfim.update.mockResolvedValue(updated);

      const result = await rfimService.update('rfim-1', { comments: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('start() should delegate to qci.service.start', async () => {
      const qci = { id: 'rfim-1', status: 'pending' };
      mockPrisma.rfim.findUnique
        .mockResolvedValueOnce(qci)
        .mockResolvedValueOnce({ ...qci, status: 'in_progress', inspectorId: 'user-1' });
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.rfim.updateMany.mockResolvedValue({ count: 1 });

      const result = await rfimService.start('rfim-1', 'user-1');

      expect(result.status).toBe('in_progress');
    });

    it('complete() should delegate to qci.service.complete', async () => {
      const qci = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      const updated = { ...qci, status: 'completed', result: 'pass' };
      mockPrisma.rfim.findUnique.mockResolvedValueOnce(qci).mockResolvedValueOnce(updated);
      mockedAssertTransition.mockReturnValue(undefined);
      const { canTransition } = await import('@nit-scs-v2/shared');
      (canTransition as ReturnType<typeof vi.fn>).mockReturnValue(false);
      mockPrisma.rfim.updateMany.mockResolvedValue({ count: 1 });

      const result = await rfimService.complete('rfim-1', 'pass', 'All good');

      expect(result).toEqual({ updated, mrrvId: 'mrrv-1' });
    });

    it('complete() should throw for invalid result value', async () => {
      const qci = { id: 'rfim-1', status: 'in_progress', mrrvId: 'mrrv-1', comments: null };
      mockPrisma.rfim.findUnique.mockResolvedValue(qci);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(rfimService.complete('rfim-1', 'invalid')).rejects.toThrow(
        'Inspection result is required (pass, fail, or conditional)',
      );
    });

    it('start() should throw NotFoundError for missing QCI', async () => {
      mockPrisma.rfim.findUnique.mockResolvedValue(null);

      await expect(rfimService.start('nonexistent', 'user-1')).rejects.toThrow('not found');
    });
  });
});
