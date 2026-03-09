/**
 * Tests for mirv.service.ts — V1 backward-compat re-export wrapper.
 *
 * mirv.service.ts re-exports every public function from mi.service.ts.
 * These tests verify:
 *   1. Each expected export exists and is a function.
 *   2. The re-exported reference is identical to the V2 service export.
 *   3. Calling through the re-export produces the same result as the V2 service.
 */
import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../workflow/services/approval.service.js', () => ({
  submitForApproval: vi.fn(),
  processApproval: vi.fn(),
}));
vi.mock('../../inventory/services/inventory.service.js', () => ({
  reserveStockBatch: vi.fn(),
  consumeReservationBatch: vi.fn(),
  releaseReservation: vi.fn(),
}));
vi.mock('../../../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../utils/cache.js', () => ({ invalidateCachePattern: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

// Import from the V1 re-export wrapper
import * as mirvService from './mirv.service.js';

// Import from the V2 canonical service
import * as miService from './mi.service.js';

// ── Expected exports ────────────────────────────────────────────────────
const expectedExports = [
  'list',
  'getById',
  'create',
  'update',
  'submit',
  'approve',
  'signQc',
  'issue',
  'cancel',
] as const;

describe('mirv.service (V1 re-export wrapper)', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Export existence and type checks
  // ─────────────────────────────────────────────────────────────────────
  describe('exports', () => {
    it.each(expectedExports)('should export "%s" as a function', name => {
      expect(mirvService).toHaveProperty(name);
      expect(typeof (mirvService as Record<string, unknown>)[name]).toBe('function');
    });

    it('should export exactly the expected set of functions', () => {
      const exportedKeys = Object.keys(mirvService).sort();
      const expected = [...expectedExports].sort();
      expect(exportedKeys).toEqual(expected);
    });

    it('should not export any additional functions beyond the expected set', () => {
      const extraKeys = Object.keys(mirvService).filter(k => !(expectedExports as readonly string[]).includes(k));
      expect(extraKeys).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Identity checks — re-exports point to the same function references
  // ─────────────────────────────────────────────────────────────────────
  describe('identity with mi.service', () => {
    it.each(expectedExports)('"%s" should be the exact same reference as mi.service.%s', name => {
      expect((mirvService as Record<string, unknown>)[name]).toBe((miService as Record<string, unknown>)[name]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Functional pass-through tests
  // ─────────────────────────────────────────────────────────────────────
  describe('functional pass-through', () => {
    it('list() should delegate to mi.service.list and return the same result', async () => {
      const rows = [{ id: 'mirv-1' }];
      mockPrisma.mirv.findMany.mockResolvedValue(rows);
      mockPrisma.mirv.count.mockResolvedValue(1);

      const result = await mirvService.list({
        sortBy: 'createdAt',
        sortDir: 'desc',
        skip: 0,
        pageSize: 25,
      });

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('getById() should delegate to mi.service.getById', async () => {
      const mirv = { id: 'mirv-1', mirvNumber: 'MIRV-001' };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);

      const result = await mirvService.getById('mirv-1');

      expect(result).toEqual(mirv);
    });

    it('getById() should throw NotFoundError for missing records', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(mirvService.getById('nonexistent')).rejects.toThrow('not found');
    });

    it('create() should delegate to mi.service.create', async () => {
      const { generateDocumentNumber } = await import('../../system/services/document-number.service.js');
      (generateDocumentNumber as ReturnType<typeof vi.fn>).mockResolvedValue('MIRV-001');
      mockPrisma.item.findMany.mockResolvedValue([{ id: 'item-1', standardCost: 100 }]);
      mockPrisma.mirv.create.mockResolvedValue({ id: 'mirv-1', mirvNumber: 'MIRV-001' });

      const result = await mirvService.create(
        { projectId: 'proj-1', warehouseId: 'wh-1', requestDate: '2026-03-01', priority: 'normal' as const },
        [{ itemId: 'item-1', qtyRequested: 10 }],
        'user-1',
      );

      expect(result).toEqual({ id: 'mirv-1', mirvNumber: 'MIRV-001' });
    });

    it('update() should delegate to mi.service.update', async () => {
      const existing = { id: 'mirv-1', status: 'draft' };
      const updated = { id: 'mirv-1', status: 'draft', notes: 'Updated' };
      mockPrisma.mirv.findUnique.mockResolvedValue(existing);
      mockPrisma.mirv.update.mockResolvedValue(updated);

      const result = await mirvService.update('mirv-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('update() should throw BusinessRuleError for non-draft status', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue({ id: 'mirv-1', status: 'approved' });

      await expect(mirvService.update('mirv-1', {})).rejects.toThrow('Only draft MIs can be updated');
    });

    it('cancel() should delegate to mi.service.cancel', async () => {
      const mirv = {
        id: 'mirv-1',
        status: 'pending_approval',
        warehouseId: 'wh-1',
        reservationStatus: 'none',
        mirvLines: [],
      };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
      mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

      const result = await mirvService.cancel('mirv-1');

      expect(result.wasReserved).toBe(false);
    });

    it('cancel() should throw for non-cancellable status', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue({
        id: 'mirv-1',
        status: 'issued',
        mirvLines: [],
      });

      await expect(mirvService.cancel('mirv-1')).rejects.toThrow('MIRV cannot be cancelled from status: issued');
    });
  });
});
