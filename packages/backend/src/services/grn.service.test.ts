import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./inventory.service.js', () => ({ addStockBatch: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return {
    ...actual,
    assertTransition: vi.fn(),
  };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';
import { list, getById, create, update, submit, approveQc, receive, store } from './mrrv.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAddStockBatch = addStockBatch as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMrrv(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mrrv-1',
    mrrvNumber: 'MRRV-2025-0001',
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    projectId: 'proj-1',
    poNumber: 'PO-001',
    receivedById: 'user-1',
    receiveDate: new Date('2025-06-01'),
    rfimRequired: false,
    hasOsd: false,
    totalValue: 1000,
    status: 'draft',
    notes: null,
    ...overrides,
  };
}

function makeMrrvLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    mrrvId: 'mrrv-1',
    itemId: 'item-1',
    uomId: 'uom-1',
    qtyOrdered: 10,
    qtyReceived: 10,
    qtyDamaged: 0,
    unitCost: 100,
    condition: 'good',
    storageLocation: null,
    expiryDate: null,
    notes: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('mrrv.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' };

    it('returns data and total', async () => {
      const rows = [makeMrrv()];
      mockPrisma.mrrv.findMany.mockResolvedValue(rows);
      mockPrisma.mrrv.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies search filter to mrrvNumber and supplierName', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'test' });

      const call = mockPrisma.mrrv.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { mrrvNumber: { contains: 'test', mode: 'insensitive' } },
        { supplier: { supplierName: { contains: 'test', mode: 'insensitive' } } },
      ]);
    });

    it('applies status filter', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'pending_qc' });

      const call = mockPrisma.mrrv.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('pending_qc');
    });

    it('applies scope filters (warehouseId, projectId, receivedById)', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({
        ...baseParams,
        warehouseId: 'wh-2',
        projectId: 'proj-3',
        receivedById: 'user-5',
      });

      const call = mockPrisma.mrrv.findMany.mock.calls[0][0];
      expect(call.where.warehouseId).toBe('wh-2');
      expect(call.where.projectId).toBe('proj-3');
      expect(call.where.receivedById).toBe('user-5');
    });

    it('applies pagination and sorting', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.mrrv.count.mockResolvedValue(0);

      await list({ skip: 20, pageSize: 10, sortBy: 'mrrvNumber', sortDir: 'asc' });

      const call = mockPrisma.mrrv.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
      expect(call.orderBy).toEqual({ mrrvNumber: 'asc' });
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the mrrv with detail includes', async () => {
      const mrrv = makeMrrv();
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);

      const result = await getById('mrrv-1');

      expect(result).toEqual(mrrv);
      expect(mockPrisma.mrrv.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mrrv-1' } }));
    });

    it('throws NotFoundError when mrrv does not exist', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    const headerData = {
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      receiveDate: '2025-06-01',
      rfimRequired: false,
    };

    const lines = [
      { itemId: 'item-1', qtyReceived: 10, qtyDamaged: 0, uomId: 'uom-1', unitCost: 50 },
      { itemId: 'item-2', qtyReceived: 5, qtyDamaged: 2, uomId: 'uom-2', unitCost: 100 },
    ];

    it('generates a document number', async () => {
      mockedGenDoc.mockResolvedValue('MRRV-2025-0042');
      mockPrisma.mrrv.create.mockResolvedValue(makeMrrv({ mrrvNumber: 'MRRV-2025-0042' }));

      await create(headerData, lines, 'user-1');

      expect(mockedGenDoc).toHaveBeenCalledWith('mrrv');
    });

    it('calculates totalValue from lines', async () => {
      mockedGenDoc.mockResolvedValue('MRRV-2025-0043');
      mockPrisma.mrrv.create.mockResolvedValue(makeMrrv());

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      // line1: 50*10 = 500, line2: 100*5 = 500, total = 1000
      expect(call.data.totalValue).toBe(1000);
    });

    it('sets hasOsd to true when damaged lines exist', async () => {
      mockedGenDoc.mockResolvedValue('MRRV-2025-0044');
      mockPrisma.mrrv.create.mockResolvedValue(makeMrrv({ hasOsd: true }));

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(call.data.hasOsd).toBe(true);
    });

    it('sets hasOsd to false when no damaged lines', async () => {
      mockedGenDoc.mockResolvedValue('MRRV-2025-0045');
      mockPrisma.mrrv.create.mockResolvedValue(makeMrrv());
      const cleanLines = [{ itemId: 'item-1', qtyReceived: 10, qtyDamaged: 0, uomId: 'uom-1', unitCost: 50 }];

      await create(headerData, cleanLines, 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(call.data.hasOsd).toBe(false);
    });

    it('creates mrrv with nested mrrvLines', async () => {
      mockedGenDoc.mockResolvedValue('MRRV-2025-0046');
      mockPrisma.mrrv.create.mockResolvedValue(makeMrrv());

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(call.data.mrrvLines.create).toHaveLength(2);
      expect(call.data.mrrvLines.create[0]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          qtyReceived: 10,
          uomId: 'uom-1',
          unitCost: 50,
        }),
      );
    });

    it('sets status to draft', async () => {
      mockedGenDoc.mockResolvedValue('MRRV-2025-0047');
      mockPrisma.mrrv.create.mockResolvedValue(makeMrrv());

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(call.data.status).toBe('draft');
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a draft MRRV successfully', async () => {
      const existing = makeMrrv({ status: 'draft' });
      mockPrisma.mrrv.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, notes: 'Updated notes' };
      mockPrisma.mrrv.update.mockResolvedValue(updated);

      const result = await update('mrrv-1', { notes: 'Updated notes' });

      expect(result).toEqual({ existing, updated });
      expect(mockPrisma.mrrv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrrv-1' },
          data: expect.objectContaining({ notes: 'Updated notes' }),
        }),
      );
    });

    it('throws NotFoundError when mrrv does not exist', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { notes: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when mrrv is not in draft status', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(makeMrrv({ status: 'pending_qc' }));

      await expect(update('mrrv-1', { notes: 'x' })).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─── submit ──────────────────────────────────────────────────────────

  describe('submit', () => {
    it('calls assertTransition and updates to pending_qc', async () => {
      const mrrv = makeMrrv({ status: 'draft', mrrvLines: [], rfimRequired: false });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({});

      const result = await submit('mrrv-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrrv', 'draft', 'pending_qc');
      expect(mockPrisma.mrrv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrrv-1' },
          data: { status: 'pending_qc' },
        }),
      );
      expect(result).toEqual({ id: 'mrrv-1', rfimRequired: false });
    });

    it('throws NotFoundError when mrrv not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(submit('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('creates RFIM when rfimRequired is true', async () => {
      const mrrv = makeMrrv({ status: 'draft', rfimRequired: true, mrrvLines: [] });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({});
      mockPrisma.rfim.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('RFIM-2025-0001');

      const result = await submit('mrrv-1');

      expect(mockedGenDoc).toHaveBeenCalledWith('rfim');
      expect(mockPrisma.rfim.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rfimNumber: 'RFIM-2025-0001',
            mrrvId: 'mrrv-1',
            status: 'pending',
          }),
        }),
      );
      expect(result.rfimRequired).toBe(true);
    });

    it('does not create RFIM when rfimRequired is false', async () => {
      const mrrv = makeMrrv({ status: 'draft', rfimRequired: false, mrrvLines: [] });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({});

      await submit('mrrv-1');

      expect(mockPrisma.rfim.create).not.toHaveBeenCalled();
    });

    it('creates OSD report for damaged lines', async () => {
      const damagedLine = makeMrrvLine({ id: 'line-dmg', qtyDamaged: 3 });
      const mrrv = makeMrrv({ status: 'draft', rfimRequired: false, mrrvLines: [damagedLine] });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({});
      mockPrisma.osdReport.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('OSD-2025-0001');

      await submit('mrrv-1');

      expect(mockedGenDoc).toHaveBeenCalledWith('osd');
      expect(mockPrisma.osdReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            osdNumber: 'OSD-2025-0001',
            mrrvId: 'mrrv-1',
            supplierId: 'sup-1',
            warehouseId: 'wh-1',
            reportTypes: ['damage'],
            status: 'draft',
            osdLines: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  itemId: 'item-1',
                  mrrvLineId: 'line-dmg',
                  qtyDamaged: 3,
                  damageType: 'physical',
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('sets hasOsd to true when damaged lines exist', async () => {
      const damagedLine = makeMrrvLine({ qtyDamaged: 1 });
      const mrrv = makeMrrv({ status: 'draft', rfimRequired: false, mrrvLines: [damagedLine] });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({});
      mockPrisma.osdReport.create.mockResolvedValue({});
      mockedGenDoc.mockResolvedValue('OSD-001');

      await submit('mrrv-1');

      // Second update call sets hasOsd
      const updateCalls = mockPrisma.mrrv.update.mock.calls;
      const hasOsdCall = updateCalls.find(
        (c: unknown[]) =>
          (c[0] as Record<string, unknown>).data &&
          ((c[0] as Record<string, unknown>).data as Record<string, unknown>).hasOsd === true,
      );
      expect(hasOsdCall).toBeDefined();
    });

    it('does not create OSD when no damaged lines', async () => {
      const cleanLine = makeMrrvLine({ qtyDamaged: 0 });
      const mrrv = makeMrrv({ status: 'draft', rfimRequired: false, mrrvLines: [cleanLine] });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({});

      await submit('mrrv-1');

      expect(mockPrisma.osdReport.create).not.toHaveBeenCalled();
    });
  });

  // ─── approveQc ───────────────────────────────────────────────────────

  describe('approveQc', () => {
    it('transitions to qc_approved and sets qcInspectorId', async () => {
      const mrrv = makeMrrv({ status: 'pending_qc' });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      const updated = { ...mrrv, status: 'qc_approved', qcInspectorId: 'inspector-1' };
      mockPrisma.mrrv.update.mockResolvedValue(updated);

      const result = await approveQc('mrrv-1', 'inspector-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrrv', 'pending_qc', 'qc_approved');
      expect(mockPrisma.mrrv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrrv-1' },
          data: expect.objectContaining({
            status: 'qc_approved',
            qcInspectorId: 'inspector-1',
          }),
        }),
      );
      expect(result.status).toBe('qc_approved');
    });

    it('throws NotFoundError when mrrv not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(approveQc('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('sets qcApprovedDate', async () => {
      const mrrv = makeMrrv({ status: 'pending_qc' });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({ ...mrrv, status: 'qc_approved' });

      await approveQc('mrrv-1', 'inspector-1');

      const call = mockPrisma.mrrv.update.mock.calls[0][0];
      expect(call.data.qcApprovedDate).toBeInstanceOf(Date);
    });
  });

  // ─── receive ─────────────────────────────────────────────────────────

  describe('receive', () => {
    it('transitions to received', async () => {
      const mrrv = makeMrrv({ status: 'qc_approved' });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      const updated = { ...mrrv, status: 'received' };
      mockPrisma.mrrv.update.mockResolvedValue(updated);

      const result = await receive('mrrv-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrrv', 'qc_approved', 'received');
      expect(mockPrisma.mrrv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrrv-1' },
          data: { status: 'received' },
        }),
      );
      expect(result.status).toBe('received');
    });

    it('throws NotFoundError when mrrv not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(receive('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── store ───────────────────────────────────────────────────────────

  describe('store', () => {
    it('transitions to stored', async () => {
      const mrrv = makeMrrv({ status: 'received', mrrvLines: [] });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({ ...mrrv, status: 'stored' });

      await store('mrrv-1', 'user-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrrv', 'received', 'stored');
      expect(mockPrisma.mrrv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrrv-1' },
          data: { status: 'stored' },
        }),
      );
    });

    it('throws NotFoundError when mrrv not found', async () => {
      mockPrisma.mrrv.findUnique.mockResolvedValue(null);

      await expect(store('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('calls addStockBatch with filtered lines (qtyToStore > 0)', async () => {
      const lines = [
        makeMrrvLine({
          id: 'line-a',
          itemId: 'item-1',
          qtyReceived: 10,
          qtyDamaged: 2,
          unitCost: 50,
          expiryDate: new Date('2027-01-01'),
        }),
        makeMrrvLine({
          id: 'line-b',
          itemId: 'item-2',
          qtyReceived: 5,
          qtyDamaged: 0,
          unitCost: 100,
          expiryDate: null,
        }),
      ];
      const mrrv = makeMrrv({ status: 'received', mrrvLines: lines });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({ ...mrrv, status: 'stored' });
      mockedAddStockBatch.mockResolvedValue(undefined);

      await store('mrrv-1', 'user-1');

      expect(mockedAddStockBatch).toHaveBeenCalledTimes(1);
      const batchArg = mockedAddStockBatch.mock.calls[0][0];
      expect(batchArg).toHaveLength(2);

      // First line: qtyToStore = 10 - 2 = 8
      expect(batchArg[0]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          warehouseId: 'wh-1',
          qty: 8,
          unitCost: 50,
          supplierId: 'sup-1',
          mrrvLineId: 'line-a',
          expiryDate: new Date('2027-01-01'),
          performedById: 'user-1',
        }),
      );

      // Second line: qtyToStore = 5 - 0 = 5
      expect(batchArg[1]).toEqual(
        expect.objectContaining({
          itemId: 'item-2',
          warehouseId: 'wh-1',
          qty: 5,
          unitCost: 100,
          supplierId: 'sup-1',
          mrrvLineId: 'line-b',
          performedById: 'user-1',
        }),
      );
    });

    it('calls addStockBatch with empty array when all qtyToStore is 0', async () => {
      const lines = [
        makeMrrvLine({ qtyReceived: 5, qtyDamaged: 5 }), // net 0
      ];
      const mrrv = makeMrrv({ status: 'received', mrrvLines: lines });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({ ...mrrv, status: 'stored' });
      mockedAddStockBatch.mockResolvedValue(undefined);

      await store('mrrv-1', 'user-1');

      expect(mockedAddStockBatch).toHaveBeenCalledWith([]);
    });

    it('returns id, warehouseId, and linesStored count', async () => {
      const lines = [makeMrrvLine(), makeMrrvLine({ id: 'line-2' })];
      const mrrv = makeMrrv({ status: 'received', mrrvLines: lines });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({ ...mrrv, status: 'stored' });
      mockedAddStockBatch.mockResolvedValue(undefined);

      const result = await store('mrrv-1', 'user-1');

      expect(result).toEqual({
        id: 'mrrv-1',
        warehouseId: 'wh-1',
        linesStored: 2,
      });
    });

    it('passes undefined for unitCost when line has no unitCost', async () => {
      const lines = [makeMrrvLine({ unitCost: null, qtyReceived: 10, qtyDamaged: 0 })];
      const mrrv = makeMrrv({ status: 'received', mrrvLines: lines });
      mockPrisma.mrrv.findUnique.mockResolvedValue(mrrv);
      mockPrisma.mrrv.update.mockResolvedValue({ ...mrrv, status: 'stored' });
      mockedAddStockBatch.mockResolvedValue(undefined);

      await store('mrrv-1', 'user-1');

      const batchArg = mockedAddStockBatch.mock.calls[0][0];
      expect(batchArg[0]).toEqual(expect.objectContaining({ unitCost: undefined }));
    });
  });
});
