/**
 * Tests for mrv.service.ts — V1 backward-compat re-export wrapper.
 *
 * mrv.service.ts re-exports every public function from mrn.service.ts.
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
vi.mock('../../inventory/services/inventory.service.js', () => ({ addStockBatch: vi.fn() }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../utils/safe-status-transition.js', () => ({ safeStatusUpdate: vi.fn(), safeStatusUpdateTx: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { assertTransition } from '@nit-scs-v2/shared';
import { safeStatusUpdate } from '../../../utils/safe-status-transition.js';

// Import from the V1 re-export wrapper
import * as mrvService from './mrv.service.js';

// Import from the V2 canonical service
import * as mrnService from './mrn.service.js';

// ── Expected exports ────────────────────────────────────────────────────
const expectedExports = ['list', 'getById', 'create', 'update', 'submit', 'receive', 'complete'] as const;

describe('mrv.service (V1 re-export wrapper)', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Export existence and type checks
  // ─────────────────────────────────────────────────────────────────────
  describe('exports', () => {
    it.each(expectedExports)('should export "%s" as a function', name => {
      expect(mrvService).toHaveProperty(name);
      expect(typeof (mrvService as Record<string, unknown>)[name]).toBe('function');
    });

    it('should export exactly the expected set of functions', () => {
      const exportedKeys = Object.keys(mrvService).sort();
      const expected = [...expectedExports].sort();
      expect(exportedKeys).toEqual(expected);
    });

    it('should not export any additional functions beyond the expected set', () => {
      const extraKeys = Object.keys(mrvService).filter(k => !(expectedExports as readonly string[]).includes(k));
      expect(extraKeys).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Identity checks — re-exports point to the same function references
  // ─────────────────────────────────────────────────────────────────────
  describe('identity with mrn.service', () => {
    it.each(expectedExports)('"%s" should be the exact same reference as mrn.service.%s', name => {
      expect((mrvService as Record<string, unknown>)[name]).toBe((mrnService as Record<string, unknown>)[name]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Functional pass-through tests
  // ─────────────────────────────────────────────────────────────────────
  describe('functional pass-through', () => {
    it('list() should delegate to mrn.service.list and return the same result', async () => {
      const rows = [{ id: 'mrv-1' }];
      mockPrisma.mrv.findMany.mockResolvedValue(rows);
      mockPrisma.mrv.count.mockResolvedValue(1);

      const result = await mrvService.list({
        sortBy: 'createdAt',
        sortDir: 'desc',
        skip: 0,
        pageSize: 25,
      });

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('getById() should delegate to mrn.service.getById', async () => {
      const mrv = { id: 'mrv-1', mrvNumber: 'MRV-0001' };
      mockPrisma.mrv.findUnique.mockResolvedValue(mrv);

      const result = await mrvService.getById('mrv-1');

      expect(result).toEqual(mrv);
    });

    it('getById() should throw NotFoundError for missing records', async () => {
      mockPrisma.mrv.findUnique.mockResolvedValue(null);

      await expect(mrvService.getById('nonexistent')).rejects.toThrow('not found');
    });

    it('create() should delegate to mrn.service.create', async () => {
      const { generateDocumentNumber } = await import('../../system/services/document-number.service.js');
      (generateDocumentNumber as ReturnType<typeof vi.fn>).mockResolvedValue('MRV-0001');
      const created = { id: 'mrv-1', mrvNumber: 'MRV-0001', status: 'draft', mrvLines: [] };
      mockPrisma.mrv.create.mockResolvedValue(created);

      const header = {
        returnType: 'site_return',
        projectId: 'proj-1',
        toWarehouseId: 'wh-1',
        returnDate: '2026-01-15',
      };
      const lines = [{ itemId: 'item-1', qtyReturned: 10, uomId: 'uom-1', condition: 'good' }];

      const result = await mrvService.create(header as any, lines as any, 'user-1');

      expect(result).toEqual(created);
    });

    it('update() should delegate to mrn.service.update', async () => {
      const existing = { id: 'mrv-1', status: 'draft', mrvLines: [] };
      const updated = { ...existing, notes: 'Updated' };
      mockPrisma.mrv.findUnique.mockResolvedValue(existing);
      mockPrisma.mrv.update.mockResolvedValue(updated);

      const result = await mrvService.update('mrv-1', { notes: 'Updated' } as any);

      expect(result).toEqual({ existing, updated });
    });

    it('update() should throw BusinessRuleError when MRN is not draft', async () => {
      mockPrisma.mrv.findUnique.mockResolvedValue({ id: 'mrv-1', status: 'pending' });

      await expect(mrvService.update('mrv-1', {} as any)).rejects.toThrow('Only draft MRNs can be updated');
    });

    it('submit() should delegate to mrn.service.submit', async () => {
      const mrv = { id: 'mrv-1', status: 'draft', mrvLines: [] };
      mockPrisma.mrv.findUnique.mockResolvedValueOnce(mrv).mockResolvedValueOnce({ ...mrv, status: 'pending' });

      const result = await mrvService.submit('mrv-1');

      expect(assertTransition).toHaveBeenCalledWith('mrn', 'draft', 'pending');
      expect(result.status).toBe('pending');
    });

    it('receive() should delegate to mrn.service.receive', async () => {
      const mrv = { id: 'mrv-1', status: 'pending', mrvLines: [] };
      const received = { ...mrv, status: 'received', receivedById: 'user-1' };
      mockPrisma.mrv.findUnique.mockResolvedValueOnce(mrv).mockResolvedValueOnce(received);

      const result = await mrvService.receive('mrv-1', 'user-1');

      expect(assertTransition).toHaveBeenCalledWith('mrn', 'pending', 'received');
      expect(result).toEqual(received);
    });

    it('receive() should throw NotFoundError for missing records', async () => {
      mockPrisma.mrv.findUnique.mockResolvedValue(null);

      await expect(mrvService.receive('nonexistent', 'user-1')).rejects.toThrow('not found');
    });

    it('submit() should throw NotFoundError for missing records', async () => {
      mockPrisma.mrv.findUnique.mockResolvedValue(null);

      await expect(mrvService.submit('nonexistent')).rejects.toThrow('not found');
    });
  });
});
