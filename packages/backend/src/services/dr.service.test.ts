import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, sendClaim, resolve } from './osd.service.js';
import { generateDocumentNumber } from './document-number.service.js';

const mockedGenerateDocNumber = generateDocumentNumber as ReturnType<typeof vi.fn>;

describe('osd.service', () => {
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
      const rows = [{ id: 'osd-1' }];
      mockPrisma.osdReport.findMany.mockResolvedValue(rows);
      mockPrisma.osdReport.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter on osdNumber', async () => {
      mockPrisma.osdReport.findMany.mockResolvedValue([]);
      mockPrisma.osdReport.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'OSD-001' });

      const where = mockPrisma.osdReport.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ osdNumber: { contains: 'OSD-001', mode: 'insensitive' } }]);
    });

    it('should apply status and warehouseId filters', async () => {
      mockPrisma.osdReport.findMany.mockResolvedValue([]);
      mockPrisma.osdReport.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'draft', warehouseId: 'wh-1' });

      const where = mockPrisma.osdReport.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('draft');
      expect(where.warehouseId).toBe('wh-1');
    });

    it('should pass the same where to findMany and count', async () => {
      mockPrisma.osdReport.findMany.mockResolvedValue([]);
      mockPrisma.osdReport.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'resolved' });

      const findWhere = mockPrisma.osdReport.findMany.mock.calls[0][0].where;
      const countWhere = mockPrisma.osdReport.count.mock.calls[0][0].where;
      expect(findWhere).toEqual(countWhere);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the OSD report when found', async () => {
      const osd = { id: 'osd-1', osdNumber: 'OSD-001' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(osd);

      const result = await getById('osd-1');

      expect(result).toEqual(osd);
    });

    it('should throw NotFoundError when OSD not found', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(getById('nonexistent')).rejects.toThrow("OSD report with id 'nonexistent' not found");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const headerData = {
      mrrvId: 'mrrv-1',
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      reportDate: '2026-03-01T00:00:00Z',
      reportTypes: ['shortage', 'damage'],
    };

    it('should generate doc number and create OSD with lines', async () => {
      mockedGenerateDocNumber.mockResolvedValue('OSD-001');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-1', osdNumber: 'OSD-001' });

      const lines = [{ itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 8, unitCost: 50 }];
      const result = await create(headerData, lines);

      expect(result).toEqual({ id: 'osd-1', osdNumber: 'OSD-001' });
      expect(mockedGenerateDocNumber).toHaveBeenCalledWith('osd');
    });

    it('should calculate shortage value correctly', async () => {
      mockedGenerateDocNumber.mockResolvedValue('OSD-002');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-2' });

      // qtyReceived (8) < qtyInvoice (10) → short = (10-8) * 50 = 100
      const lines = [{ itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 8, unitCost: 50 }];
      await create(headerData, lines);

      const createArgs = mockPrisma.osdReport.create.mock.calls[0][0];
      expect(createArgs.data.totalShortValue).toBe(100);
      expect(createArgs.data.totalOverValue).toBe(0);
    });

    it('should calculate overage value correctly', async () => {
      mockedGenerateDocNumber.mockResolvedValue('OSD-003');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-3' });

      // qtyReceived (12) > qtyInvoice (10) → over = (12-10) * 25 = 50
      const lines = [{ itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 12, unitCost: 25 }];
      await create(headerData, lines);

      const createArgs = mockPrisma.osdReport.create.mock.calls[0][0];
      expect(createArgs.data.totalOverValue).toBe(50);
      expect(createArgs.data.totalShortValue).toBe(0);
    });

    it('should calculate damage value correctly', async () => {
      mockedGenerateDocNumber.mockResolvedValue('OSD-004');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-4' });

      const lines = [
        { itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 10, qtyDamaged: 3, unitCost: 40 },
      ];
      await create(headerData, lines);

      const createArgs = mockPrisma.osdReport.create.mock.calls[0][0];
      expect(createArgs.data.totalDamageValue).toBe(120); // 3 * 40
    });

    it('should handle lines without unitCost (default 0)', async () => {
      mockedGenerateDocNumber.mockResolvedValue('OSD-005');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-5' });

      const lines = [{ itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 5 }];
      await create(headerData, lines);

      const createArgs = mockPrisma.osdReport.create.mock.calls[0][0];
      expect(createArgs.data.totalShortValue).toBe(0); // (10-5) * 0
    });

    it('should set status to draft', async () => {
      mockedGenerateDocNumber.mockResolvedValue('OSD-006');
      mockPrisma.osdReport.create.mockResolvedValue({ id: 'osd-6' });

      const lines = [{ itemId: 'item-1', uomId: 'uom-1', qtyInvoice: 10, qtyReceived: 10 }];
      await create(headerData, lines);

      const createArgs = mockPrisma.osdReport.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update an existing OSD report', async () => {
      const existing = { id: 'osd-1', status: 'draft' };
      const updated = { id: 'osd-1', status: 'draft', poNumber: 'PO-123' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(existing);
      mockPrisma.osdReport.update.mockResolvedValue(updated);

      const result = await update('osd-1', { poNumber: 'PO-123' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when OSD not found', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendClaim
  // ─────────────────────────────────────────────────────────────────────────
  describe('sendClaim', () => {
    it('should send claim from under_review status', async () => {
      const osd = { id: 'osd-1', status: 'under_review' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(osd);
      mockPrisma.osdReport.update.mockResolvedValue({ ...osd, status: 'claim_sent' });

      const result = await sendClaim('osd-1', 'CLM-001');

      expect(result.status).toBe('claim_sent');
      expect(mockPrisma.osdReport.update).toHaveBeenCalledWith({
        where: { id: 'osd-1' },
        data: expect.objectContaining({
          status: 'claim_sent',
          claimReference: 'CLM-001',
        }),
      });
    });

    it('should send claim from under_review status', async () => {
      const osd = { id: 'osd-1', status: 'under_review' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(osd);
      mockPrisma.osdReport.update.mockResolvedValue({ ...osd, status: 'claim_sent' });

      await sendClaim('osd-1');

      const updateArgs = mockPrisma.osdReport.update.mock.calls[0][0];
      expect(updateArgs.data.claimReference).toBeNull();
    });

    it('should throw NotFoundError when OSD not found', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue(null);

      await expect(sendClaim('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw Error when status is invalid for sendClaim', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'resolved' });

      await expect(sendClaim('osd-1')).rejects.toThrow(/Invalid status transition/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // resolve
  // ─────────────────────────────────────────────────────────────────────────
  describe('resolve', () => {
    it('should resolve from awaiting_response status with full data', async () => {
      const osd = { id: 'osd-1', status: 'awaiting_response' };
      mockPrisma.osdReport.findUnique.mockResolvedValue(osd);
      mockPrisma.osdReport.update.mockResolvedValue({ ...osd, status: 'resolved' });

      const result = await resolve('osd-1', 'user-1', {
        resolutionType: 'credit_note',
        resolutionAmount: 500,
        supplierResponse: 'Agreed',
      });

      expect(result.status).toBe('resolved');
      expect(mockPrisma.osdReport.update).toHaveBeenCalledWith({
        where: { id: 'osd-1' },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedById: 'user-1',
          resolutionType: 'credit_note',
          resolutionAmount: 500,
          supplierResponse: 'Agreed',
        }),
      });
    });

    it('should resolve from awaiting_response status', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'awaiting_response' });
      mockPrisma.osdReport.update.mockResolvedValue({ status: 'resolved' });

      const result = await resolve('osd-1', 'user-1', {});

      expect(result.status).toBe('resolved');
    });

    it('should resolve from negotiating status', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'negotiating' });
      mockPrisma.osdReport.update.mockResolvedValue({ status: 'resolved' });

      const result = await resolve('osd-1', 'user-1', {});

      expect(result.status).toBe('resolved');
    });

    it('should throw NotFoundError when OSD not found', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue(null);

      await expect(resolve('nonexistent', 'user-1', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw Error from invalid status for resolve', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'draft' });

      await expect(resolve('osd-1', 'user-1', {})).rejects.toThrow(/Invalid status transition/);
    });

    it('should set responseDate when supplierResponse is provided', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'awaiting_response' });
      mockPrisma.osdReport.update.mockResolvedValue({ status: 'resolved' });

      await resolve('osd-1', 'user-1', { supplierResponse: 'We accept' });

      const updateArgs = mockPrisma.osdReport.update.mock.calls[0][0];
      expect(updateArgs.data.responseDate).toBeInstanceOf(Date);
    });

    it('should set responseDate to null when supplierResponse is not provided', async () => {
      mockPrisma.osdReport.findUnique.mockResolvedValue({ id: 'osd-1', status: 'negotiating' });
      mockPrisma.osdReport.update.mockResolvedValue({ status: 'resolved' });

      await resolve('osd-1', 'user-1', {});

      const updateArgs = mockPrisma.osdReport.update.mock.calls[0][0];
      expect(updateArgs.data.responseDate).toBeNull();
    });
  });
});
