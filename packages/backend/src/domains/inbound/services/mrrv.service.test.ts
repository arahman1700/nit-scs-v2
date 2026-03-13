/**
 * Tests for mrrv.service.ts — V1 backward-compat re-export wrapper.
 *
 * mrrv.service.ts re-exports every public function from grn.service.ts.
 * These tests verify:
 *   1. Each expected export exists and is a function.
 *   2. The re-exported reference is identical to the V2 service export (same object identity).
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
vi.mock('../../inventory/services/inventory.service.js', () => ({ addStockBatch: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

// Import from the V1 re-export wrapper
import * as mrrvService from './mrrv.service.js';

// Import from the V2 canonical service
import * as grnService from './grn.service.js';

// ── Expected exports ────────────────────────────────────────────────────
const expectedExports = ['list', 'getById', 'create', 'update', 'submit', 'approveQc', 'receive', 'store'] as const;

describe('mrrv.service (V1 re-export wrapper)', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Export existence and type checks
  // ─────────────────────────────────────────────────────────────────────
  describe('exports', () => {
    it.each(expectedExports)('should export "%s" as a function', name => {
      expect(mrrvService).toHaveProperty(name);
      expect(typeof (mrrvService as Record<string, unknown>)[name]).toBe('function');
    });

    it('should export exactly the expected set of functions', () => {
      const exportedKeys = Object.keys(mrrvService).sort();
      const expected = [...expectedExports].sort();
      expect(exportedKeys).toEqual(expected);
    });

    it('should not export any additional functions beyond the expected set', () => {
      const extraKeys = Object.keys(mrrvService).filter(k => !(expectedExports as readonly string[]).includes(k));
      expect(extraKeys).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Identity checks — re-exports point to the same function references
  // ─────────────────────────────────────────────────────────────────────
  describe('identity with grn.service', () => {
    it.each(expectedExports)('"%s" should be the exact same reference as grn.service.%s', name => {
      expect((mrrvService as Record<string, unknown>)[name]).toBe((grnService as Record<string, unknown>)[name]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Functional pass-through tests
  // ─────────────────────────────────────────────────────────────────────
  describe('functional pass-through', () => {
    it('list() should delegate to grn.service.list and return the same result', async () => {
      const rows = [{ id: 'grn-1' }];
      mockPrisma.mrrv.findMany.mockResolvedValue(rows);
      mockPrisma.mrrv.count.mockResolvedValue(1);

      const result = await mrrvService.list({
        sortBy: 'createdAt',
        sortDir: 'desc',
        skip: 0,
        pageSize: 25,
      });

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('getById() should delegate to grn.service.getById', async () => {
      const grn = { id: 'grn-1', mrrvNumber: 'GRN-001' };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);

      const result = await mrrvService.getById('grn-1');

      expect(result).toEqual(grn);
    });

    it('getById() should throw NotFoundError for missing records', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(mrrvService.getById('nonexistent')).rejects.toThrow('not found');
    });

    it('create() should delegate to grn.service.create', async () => {
      const { generateDocumentNumber } = await import('../../system/services/document-number.service.js');
      (generateDocumentNumber as ReturnType<typeof vi.fn>).mockResolvedValue('GRN-001');
      mockPrisma.mrrv.create.mockResolvedValue({ id: 'grn-1', mrrvNumber: 'GRN-001' });

      const { grn } = await mrrvService.create(
        { supplierId: 'sup-1', warehouseId: 'wh-1', receiveDate: '2026-03-01T00:00:00Z' },
        [{ itemId: 'item-1', qtyReceived: 10, unitCost: 50, uomId: 'uom-1' }],
        'user-1',
      );

      expect(grn).toEqual({ id: 'grn-1', mrrvNumber: 'GRN-001' });
    });

    it('update() should delegate to grn.service.update', async () => {
      const existing = { id: 'grn-1', status: 'draft' };
      const updated = { id: 'grn-1', status: 'draft', notes: 'Updated' };
      mockPrisma.mrrv.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      mockPrisma.mrrv.update.mockResolvedValue(updated);

      const result = await mrrvService.update('grn-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('submit() should delegate to grn.service.submit', async () => {
      const grn = { id: 'grn-1', status: 'draft', rfimRequired: false, mrrvLines: [] };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockPrisma.mrrv.updateMany.mockResolvedValue({ count: 1 });

      const result = await mrrvService.submit('grn-1');

      expect(result).toEqual({ id: 'grn-1', qciRequired: false });
    });
  });
});
