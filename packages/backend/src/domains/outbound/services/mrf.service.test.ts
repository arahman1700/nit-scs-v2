/**
 * Tests for mrf.service.ts — V1 backward-compat re-export wrapper.
 *
 * mrf.service.ts re-exports every public function from mr.service.ts.
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
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../inventory/services/inventory.service.js', () => ({ getStockLevelsBatch: vi.fn() }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

// Import from the V1 re-export wrapper
import * as mrfService from './mrf.service.js';

// Import from the V2 canonical service
import * as mrService from './mr.service.js';

// ── Expected exports ────────────────────────────────────────────────────
const expectedExports = [
  'list',
  'getById',
  'create',
  'update',
  'submit',
  'review',
  'approve',
  'checkStock',
  'convertToImsf',
  'convertToMirv',
  'fulfill',
  'reject',
  'cancel',
  'convertToJo',
] as const;

describe('mrf.service (V1 re-export wrapper)', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Export existence and type checks
  // ─────────────────────────────────────────────────────────────────────
  describe('exports', () => {
    it.each(expectedExports)('should export "%s" as a function', name => {
      expect(mrfService).toHaveProperty(name);
      expect(typeof (mrfService as Record<string, unknown>)[name]).toBe('function');
    });

    it('should export exactly the expected set of functions', () => {
      const exportedKeys = Object.keys(mrfService).sort();
      const expected = [...expectedExports].sort();
      expect(exportedKeys).toEqual(expected);
    });

    it('should not export any additional functions beyond the expected set', () => {
      const extraKeys = Object.keys(mrfService).filter(k => !(expectedExports as readonly string[]).includes(k));
      expect(extraKeys).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Identity checks — re-exports point to the same function references
  // ─────────────────────────────────────────────────────────────────────
  describe('identity with mr.service', () => {
    it.each(expectedExports)('"%s" should be the exact same reference as mr.service.%s', name => {
      expect((mrfService as Record<string, unknown>)[name]).toBe((mrService as Record<string, unknown>)[name]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Functional pass-through tests
  // ─────────────────────────────────────────────────────────────────────
  describe('functional pass-through', () => {
    it('list() should delegate to mr.service.list and return the same result', async () => {
      const rows = [{ id: 'mrf-1' }];
      mockPrisma.materialRequisition.findMany.mockResolvedValue(rows);
      mockPrisma.materialRequisition.count.mockResolvedValue(1);

      const result = await mrfService.list({
        sortBy: 'createdAt',
        sortDir: 'desc',
        skip: 0,
        pageSize: 25,
      });

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('getById() should delegate to mr.service.getById', async () => {
      const mrf = { id: 'mrf-1', mrfNumber: 'MRF-2025-0001' };
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);

      const result = await mrfService.getById('mrf-1');

      expect(result).toEqual(mrf);
    });

    it('getById() should throw NotFoundError for missing records', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(mrfService.getById('nonexistent')).rejects.toThrow('not found');
    });

    it('create() should delegate to mr.service.create', async () => {
      const { generateDocumentNumber } = await import('../../system/services/document-number.service.js');
      (generateDocumentNumber as ReturnType<typeof vi.fn>).mockResolvedValue('MRF-2025-0042');
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.create.mockResolvedValue({
        id: 'mrf-1',
        mrfNumber: 'MRF-2025-0042',
        status: 'draft',
      });

      const result = await mrfService.create(
        { requestDate: '2025-06-01', projectId: 'proj-1', priority: 'high' as const },
        [{ itemId: 'item-1', qtyRequested: 10, uomId: 'uom-1', itemDescription: 'Steel pipe' }],
        'user-1',
      );

      expect(result).toEqual(expect.objectContaining({ id: 'mrf-1', mrfNumber: 'MRF-2025-0042' }));
    });

    it('update() should delegate to mr.service.update', async () => {
      const existing = { id: 'mrf-1', status: 'draft' };
      const updated = { ...existing, notes: 'Updated' };
      mockPrisma.materialRequisition.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      mockPrisma.materialRequisition.update.mockResolvedValue(updated);

      const result = await mrfService.update('mrf-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('update() should throw BusinessRuleError when MRF is not draft', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue({ id: 'mrf-1', status: 'submitted' });

      await expect(mrfService.update('mrf-1', { notes: 'x' })).rejects.toThrow('Only draft MRs can be updated');
    });

    it('submit() should delegate to mr.service.submit', async () => {
      const mrf = { id: 'mrf-1', status: 'draft' };
      mockPrisma.materialRequisition.findUnique
        .mockResolvedValueOnce(mrf)
        .mockResolvedValueOnce({ ...mrf, status: 'submitted' });
      mockPrisma.materialRequisition.updateMany.mockResolvedValue({ count: 1 });

      const result = await mrfService.submit('mrf-1');

      expect(result.status).toBe('submitted');
    });

    it('cancel() should delegate to mr.service.cancel', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue({ id: 'mrf-1', status: 'draft' });
      mockPrisma.materialRequisition.update.mockResolvedValue({ id: 'mrf-1', status: 'cancelled' });

      const result = await mrfService.cancel('mrf-1');

      expect(result.status).toBe('cancelled');
    });

    it('cancel() should throw for fulfilled status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue({ id: 'mrf-1', status: 'fulfilled' });

      await expect(mrfService.cancel('mrf-1')).rejects.toThrow();
    });

    it('reject() should delegate to mr.service.reject', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue({ id: 'mrf-1', status: 'submitted' });
      mockPrisma.materialRequisition.update.mockResolvedValue({ id: 'mrf-1', status: 'rejected' });

      const result = await mrfService.reject('mrf-1');

      expect(result.status).toBe('rejected');
    });

    it('reject() should throw for non-rejectable status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue({ id: 'mrf-1', status: 'approved' });

      await expect(mrfService.reject('mrf-1')).rejects.toThrow();
    });
  });
});
