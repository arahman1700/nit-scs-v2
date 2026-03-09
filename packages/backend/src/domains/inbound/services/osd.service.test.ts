/**
 * Tests for osd.service.ts — V1 backward-compat re-export wrapper.
 *
 * osd.service.ts re-exports every public function from dr.service.ts.
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
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

// Import from the V1 re-export wrapper
import * as osdService from './osd.service.js';

// Import from the V2 canonical service
import * as drService from './dr.service.js';

// ── Expected exports ────────────────────────────────────────────────────
const expectedExports = ['list', 'getById', 'create', 'update', 'sendClaim', 'resolve'] as const;

describe('osd.service (V1 re-export wrapper)', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Export existence and type checks
  // ─────────────────────────────────────────────────────────────────────
  describe('exports', () => {
    it.each(expectedExports)('should export "%s" as a function', name => {
      expect(osdService).toHaveProperty(name);
      expect(typeof (osdService as Record<string, unknown>)[name]).toBe('function');
    });

    it('should export exactly the expected set of functions', () => {
      const exportedKeys = Object.keys(osdService).sort();
      const expected = [...expectedExports].sort();
      expect(exportedKeys).toEqual(expected);
    });

    it('should not export any additional functions beyond the expected set', () => {
      const extraKeys = Object.keys(osdService).filter(k => !(expectedExports as readonly string[]).includes(k));
      expect(extraKeys).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Identity checks — re-exports point to the same function references
  // ─────────────────────────────────────────────────────────────────────
  describe('identity with dr.service', () => {
    it.each(expectedExports)('"%s" should be the exact same reference as dr.service.%s', name => {
      expect((osdService as Record<string, unknown>)[name]).toBe((drService as Record<string, unknown>)[name]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Functional pass-through tests
  // ─────────────────────────────────────────────────────────────────────
  describe('functional pass-through', () => {
    it('list() should delegate to dr.service.list and return the same result', async () => {
      const rows = [{ id: 'osd-1' }];
      mockPrisma.osdReport.findMany.mockResolvedValue(rows);
      mockPrisma.osdReport.count.mockResolvedValue(1);

      const result = await osdService.list({
        sortBy: 'createdAt',
        sortDir: 'desc',
        skip: 0,
        pageSize: 25,
      });

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('getById() should delegate to dr.service.getById', async () => {
      const dr = { id: 'osd-1', osdNumber: 'OSD-001' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(dr);

      const result = await osdService.getById('osd-1');

      expect(result).toEqual(dr);
    });

    it('getById() should throw NotFoundError for missing records', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue(null);

      await expect(osdService.getById('nonexistent')).rejects.toThrow('not found');
    });

    it('create() should delegate to dr.service.create', async () => {
      const { generateDocumentNumber } = await import('../../system/services/document-number.service.js');
      (generateDocumentNumber as ReturnType<typeof vi.fn>).mockResolvedValue('OSD-001');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-1', osdNumber: 'OSD-001' });

      const headerData = {
        grnId: 'mrrv-1',
        supplierId: 'sup-1',
        warehouseId: 'wh-1',
        reportDate: '2026-03-01T00:00:00Z',
        reportTypes: ['shortage', 'damage'],
      };
      const lines = [{ itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 8, unitCost: 50 }];

      const result = await osdService.create(headerData, lines);

      expect(result).toEqual({ id: 'osd-1', osdNumber: 'OSD-001' });
    });

    it('update() should delegate to dr.service.update', async () => {
      const existing = { id: 'osd-1', status: 'draft' };
      const updated = { id: 'osd-1', status: 'draft', poNumber: 'PO-123' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(existing);
      mockPrisma.osdReport.update.mockResolvedValue(updated);

      const result = await osdService.update('osd-1', { poNumber: 'PO-123' });

      expect(result).toEqual({ existing, updated });
    });

    it('sendClaim() should delegate to dr.service.sendClaim', async () => {
      const dr = { id: 'osd-1', status: 'under_review' };
      const updated = { ...dr, status: 'claim_sent', claimReference: 'CLM-001' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(dr);
      mockPrisma.osdReport.update.mockResolvedValue(updated);

      const result = await osdService.sendClaim('osd-1', 'CLM-001');

      expect(result.status).toBe('claim_sent');
    });

    it('resolve() should delegate to dr.service.resolve', async () => {
      const dr = { id: 'osd-1', status: 'awaiting_response' };
      const updated = { ...dr, status: 'resolved' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(dr);
      mockPrisma.osdReport.update.mockResolvedValue(updated);

      const result = await osdService.resolve('osd-1', 'user-1', {
        resolutionType: 'credit_note',
        resolutionAmount: 500,
      });

      expect(result.status).toBe('resolved');
    });

    it('sendClaim() should throw for invalid status', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'resolved' });

      await expect(osdService.sendClaim('osd-1')).rejects.toThrow('DR must be draft or under review to send claim');
    });

    it('resolve() should throw for invalid status', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'draft' });

      await expect(osdService.resolve('osd-1', 'user-1', {})).rejects.toThrow(
        'DR cannot be resolved from status: draft',
      );
    });
  });
});
