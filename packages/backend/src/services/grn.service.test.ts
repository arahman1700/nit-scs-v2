import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./inventory.service.js', () => ({ addStockBatch: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, submit, approveQc, receive, store } from './grn.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch } from './inventory.service.js';
import { assertTransition } from '@nit-scs-v2/shared';

const mockedGenerateDocNumber = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAddStockBatch = addStockBatch as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

describe('grn.service', () => {
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
      const rows = [{ id: 'grn-1' }];
      mockPrisma.mrrv.findMany.mockResolvedValue(rows);
      mockPrisma.mrrv.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'GRN-001' });

      const where = mockPrisma.mrrv.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('should apply status filter', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'draft' });

      const where = mockPrisma.mrrv.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('draft');
    });

    it('should apply projectId filter', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ ...baseParams, projectId: 'proj-1' });

      const where = mockPrisma.mrrv.findMany.mock.calls[0][0].where;
      expect(where.projectId).toBe('proj-1');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.mrrv.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the GRN when found', async () => {
      const grn = { id: 'grn-1', mrrvNumber: 'GRN-001' };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);

      const result = await getById('grn-1');

      expect(result).toEqual(grn);
      expect(mockPrisma.mrrv.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'grn-1' } }));
    });

    it('should throw NotFoundError when GRN not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const headerData = {
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      receiveDate: '2026-03-01T00:00:00Z',
    };
    const lines = [
      { itemId: 'item-1', qtyReceived: 10, unitCost: 50, uomId: 'uom-1' },
      { itemId: 'item-2', qtyReceived: 5, unitCost: 200, uomId: 'uom-2' },
    ];

    it('should generate document number and create GRN', async () => {
      mockedGenerateDocNumber.mockResolvedValue('GRN-001');
      mockPrisma.mrrv.create.mockResolvedValue({ id: 'grn-1', mrrvNumber: 'GRN-001' });

      const result = await create(headerData, lines, 'user-1');

      expect(result).toEqual({ id: 'grn-1', mrrvNumber: 'GRN-001' });
      expect(mockedGenerateDocNumber).toHaveBeenCalledWith('grn');
    });

    it('should calculate totalValue from unitCost * qtyReceived', async () => {
      mockedGenerateDocNumber.mockResolvedValue('GRN-002');
      mockPrisma.mrrv.create.mockResolvedValue({ id: 'grn-2' });

      await create(headerData, lines, 'user-1');

      const createArgs = mockPrisma.mrrv.create.mock.calls[0][0];
      // 50*10 + 200*5 = 500 + 1000 = 1500
      expect(createArgs.data.totalValue).toBe(1500);
    });

    it('should set status to draft and receivedById', async () => {
      mockedGenerateDocNumber.mockResolvedValue('GRN-003');
      mockPrisma.mrrv.create.mockResolvedValue({ id: 'grn-3' });

      await create(headerData, lines, 'user-1');

      const createArgs = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
      expect(createArgs.data.receivedById).toBe('user-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a draft GRN', async () => {
      const existing = { id: 'grn-1', status: 'draft' };
      const updated = { id: 'grn-1', status: 'draft', notes: 'Updated' };
      mockPrisma.mrrv.findUnique.mockResolvedValue(existing);
      mockPrisma.mrrv.update.mockResolvedValue(updated);

      const result = await update('grn-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when GRN not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when GRN is not draft', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue({ id: 'grn-1', status: 'pending_qc' });

      await expect(update('grn-1', {})).rejects.toThrow('Only draft GRNs can be updated');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // submit (draft -> pending_qc)
  // ─────────────────────────────────────────────────────────────────────────
  describe('submit', () => {
    it('should transition GRN from draft to pending_qc', async () => {
      const grn = { id: 'grn-1', status: 'draft', rfimRequired: false, mrrvLines: [] };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.mrrv.update.mockResolvedValue({});

      const result = await submit('grn-1');

      expect(result).toEqual({ id: 'grn-1', qciRequired: false });
      expect(mockedAssertTransition).toHaveBeenCalledWith('grn', 'draft', 'pending_qc');
    });

    it('should auto-create QCI when rfimRequired is true', async () => {
      const grn = { id: 'grn-1', status: 'draft', rfimRequired: true, mrrvLines: [] };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockedGenerateDocNumber.mockResolvedValue('QCI-001');
      mockPrisma.mrrv.update.mockResolvedValue({});
      mockPrisma.rfim.create.mockResolvedValue({});

      const result = await submit('grn-1');

      expect(result.qciRequired).toBe(true);
      expect(mockPrisma.rfim.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.rfim.create.mock.calls[0][0].data.rfimNumber).toBe('QCI-001');
      expect(mockPrisma.rfim.create.mock.calls[0][0].data.mrrvId).toBe('grn-1');
    });

    it('should not create QCI when rfimRequired is false', async () => {
      const grn = { id: 'grn-1', status: 'draft', rfimRequired: false, mrrvLines: [] };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.mrrv.update.mockResolvedValue({});

      await submit('grn-1');

      expect(mockPrisma.rfim.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when GRN not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(submit('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approveQc (pending_qc -> qc_approved)
  // ─────────────────────────────────────────────────────────────────────────
  describe('approveQc', () => {
    it('should approve QC and set inspector', async () => {
      const grn = { id: 'grn-1', status: 'pending_qc' };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.mrrv.update.mockResolvedValue({ ...grn, status: 'qc_approved' });

      const result = await approveQc('grn-1', 'inspector-1');

      expect(result.status).toBe('qc_approved');
      expect(mockedAssertTransition).toHaveBeenCalledWith('grn', 'pending_qc', 'qc_approved');
      const updateData = mockPrisma.mrrv.update.mock.calls[0][0].data;
      expect(updateData.qcInspectorId).toBe('inspector-1');
      expect(updateData.qcApprovedDate).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError when GRN not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(approveQc('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // receive (qc_approved -> received)
  // ─────────────────────────────────────────────────────────────────────────
  describe('receive', () => {
    it('should transition to received', async () => {
      const grn = { id: 'grn-1', status: 'qc_approved' };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.mrrv.update.mockResolvedValue({ ...grn, status: 'received' });

      const result = await receive('grn-1');

      expect(result.status).toBe('received');
      expect(mockedAssertTransition).toHaveBeenCalledWith('grn', 'qc_approved', 'received');
    });

    it('should throw NotFoundError when GRN not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(receive('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // store (received -> stored) -- adds stock
  // ─────────────────────────────────────────────────────────────────────────
  describe('store', () => {
    it('should transition to stored and add stock', async () => {
      const grn = {
        id: 'grn-1',
        status: 'received',
        warehouseId: 'wh-1',
        supplierId: 'sup-1',
        mrrvLines: [
          { id: 'line-1', itemId: 'item-1', qtyReceived: 10, qtyDamaged: 2, unitCost: 50, expiryDate: null },
          { id: 'line-2', itemId: 'item-2', qtyReceived: 5, qtyDamaged: 0, unitCost: 100, expiryDate: null },
        ],
      };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.mrrv.update.mockResolvedValue({});
      mockedAddStockBatch.mockResolvedValue(undefined);

      const result = await store('grn-1', 'user-1');

      expect(result).toEqual({ id: 'grn-1', warehouseId: 'wh-1', linesStored: 2 });
      expect(mockedAssertTransition).toHaveBeenCalledWith('grn', 'received', 'stored');
      expect(mockedAddStockBatch).toHaveBeenCalledTimes(1);

      // Check stock items: qty = qtyReceived - qtyDamaged
      const stockItems = mockedAddStockBatch.mock.calls[0][0];
      expect(stockItems).toHaveLength(2);
      expect(stockItems[0].qty).toBe(8); // 10 - 2
      expect(stockItems[1].qty).toBe(5); // 5 - 0
    });

    it('should filter out lines with zero usable qty', async () => {
      const grn = {
        id: 'grn-1',
        status: 'received',
        warehouseId: 'wh-1',
        supplierId: 'sup-1',
        mrrvLines: [{ id: 'line-1', itemId: 'item-1', qtyReceived: 5, qtyDamaged: 5, unitCost: 50, expiryDate: null }],
      };
      mockPrisma.mrrv.findUnique.mockResolvedValue(grn);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.mrrv.update.mockResolvedValue({});
      mockedAddStockBatch.mockResolvedValue(undefined);

      await store('grn-1', 'user-1');

      const stockItems = mockedAddStockBatch.mock.calls[0][0];
      expect(stockItems).toHaveLength(0);
    });

    it('should throw NotFoundError when GRN not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(store('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });
});
