import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./inventory.service.js', () => ({ getStockLevel: vi.fn() }));
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
import { getStockLevel } from './inventory.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';
import {
  list,
  getById,
  create,
  update,
  submit,
  review,
  approve,
  checkStock,
  convertToMirv,
  fulfill,
  reject,
  cancel,
} from './mrf.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedGetStockLevel = getStockLevel as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMrf(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mrf-1',
    mrfNumber: 'MRF-2025-0001',
    requestDate: new Date('2025-06-01'),
    requiredDate: null,
    projectId: 'proj-1',
    department: null,
    requestedById: 'user-1',
    deliveryPoint: null,
    workOrder: null,
    drawingReference: null,
    priority: 'medium',
    totalEstimatedValue: 0,
    status: 'draft',
    notes: null,
    reviewedById: null,
    reviewDate: null,
    approvedById: null,
    approvalDate: null,
    mirvId: null,
    fulfillmentDate: null,
    ...overrides,
  };
}

function makeMrfLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    mrfId: 'mrf-1',
    itemId: 'item-1',
    itemDescription: 'Steel pipe',
    category: null,
    qtyRequested: 10,
    uomId: 'uom-1',
    source: 'tbd',
    qtyFromStock: null,
    qtyFromPurchase: null,
    mirvLineId: null,
    notes: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('mrf.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' as const };

    it('returns data and total', async () => {
      const rows = [makeMrf()];
      mockPrisma.materialRequisition.findMany.mockResolvedValue(rows);
      mockPrisma.materialRequisition.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies search filter to mrfNumber and projectName', async () => {
      mockPrisma.materialRequisition.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'test' });

      const call = mockPrisma.materialRequisition.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { mrfNumber: { contains: 'test', mode: 'insensitive' } },
        { project: { projectName: { contains: 'test', mode: 'insensitive' } } },
      ]);
    });

    it('applies status filter', async () => {
      mockPrisma.materialRequisition.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'approved' });

      const call = mockPrisma.materialRequisition.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('approved');
    });

    it('applies projectId scope filter', async () => {
      mockPrisma.materialRequisition.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.count.mockResolvedValue(0);

      await list({ ...baseParams, projectId: 'proj-5' });

      const call = mockPrisma.materialRequisition.findMany.mock.calls[0][0];
      expect(call.where.projectId).toBe('proj-5');
    });

    it('applies requestedById scope filter', async () => {
      mockPrisma.materialRequisition.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.count.mockResolvedValue(0);

      await list({ ...baseParams, requestedById: 'user-5' });

      const call = mockPrisma.materialRequisition.findMany.mock.calls[0][0];
      expect(call.where.requestedById).toBe('user-5');
    });

    it('applies pagination and sorting', async () => {
      mockPrisma.materialRequisition.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.count.mockResolvedValue(0);

      await list({ skip: 20, pageSize: 5, sortBy: 'mrfNumber', sortDir: 'asc' });

      const call = mockPrisma.materialRequisition.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(5);
      expect(call.orderBy).toEqual({ mrfNumber: 'asc' });
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the MRF with detail includes', async () => {
      const mrf = makeMrf();
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);

      const result = await getById('mrf-1');

      expect(result).toEqual(mrf);
      expect(mockPrisma.materialRequisition.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mrf-1' } }),
      );
    });

    it('throws NotFoundError when MRF does not exist', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    const headerData = {
      requestDate: '2025-06-01',
      projectId: 'proj-1',
      priority: 'high' as const,
    };

    const lines = [
      { itemId: 'item-1', qtyRequested: 10, uomId: 'uom-1', itemDescription: 'Steel pipe' },
      { itemId: 'item-2', qtyRequested: 5, uomId: 'uom-2', itemDescription: 'Bolts' },
    ];

    it('generates a document number', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0042');
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf({ mrfNumber: 'MRF-2025-0042' }));

      await create(headerData, lines, 'user-1');

      expect(mockedGenDoc).toHaveBeenCalledWith('mrf');
    });

    it('calculates totalEstimatedValue from item standardCost', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0043');
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', standardCost: 50 }, // 50 * 10 = 500
        { id: 'item-2', standardCost: 20 }, // 20 * 5  = 100
      ]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf({ totalEstimatedValue: 600 }));

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.materialRequisition.create.mock.calls[0][0];
      expect(call.data.totalEstimatedValue).toBe(600);
    });

    it('handles lines without itemId (no cost lookup)', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0044');
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf());

      const linesWithoutItem = [{ qtyRequested: 10, itemDescription: 'Custom widget' }];
      await create(headerData, linesWithoutItem, 'user-1');

      const call = mockPrisma.materialRequisition.create.mock.calls[0][0];
      expect(call.data.totalEstimatedValue).toBe(0);
    });

    it('sets totalEstimatedValue to 0 when items have no standardCost', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0045');
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', standardCost: null },
        { id: 'item-2', standardCost: null },
      ]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf());

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.materialRequisition.create.mock.calls[0][0];
      expect(call.data.totalEstimatedValue).toBe(0);
    });

    it('creates MRF with nested mrfLines', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0046');
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf());

      await create(headerData, lines, 'user-1');

      const call = mockPrisma.materialRequisition.create.mock.calls[0][0];
      expect(call.data.mrfLines.create).toHaveLength(2);
      expect(call.data.mrfLines.create[0]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          qtyRequested: 10,
          uomId: 'uom-1',
        }),
      );
    });

    it('sets status to draft and requestedById to userId', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0047');
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf());

      await create(headerData, lines, 'user-42');

      const call = mockPrisma.materialRequisition.create.mock.calls[0][0];
      expect(call.data.status).toBe('draft');
      expect(call.data.requestedById).toBe('user-42');
    });

    it('converts requestDate and requiredDate to Date objects', async () => {
      mockedGenDoc.mockResolvedValue('MRF-2025-0048');
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.materialRequisition.create.mockResolvedValue(makeMrf());

      await create({ ...headerData, requiredDate: '2025-07-01' }, lines, 'user-1');

      const call = mockPrisma.materialRequisition.create.mock.calls[0][0];
      expect(call.data.requestDate).toEqual(new Date('2025-06-01'));
      expect(call.data.requiredDate).toEqual(new Date('2025-07-01'));
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a draft MRF successfully', async () => {
      const existing = makeMrf({ status: 'draft' });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, notes: 'Updated' };
      mockPrisma.materialRequisition.update.mockResolvedValue(updated);

      const result = await update('mrf-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('throws NotFoundError when MRF does not exist', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { notes: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when MRF is not draft', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'submitted' }));

      await expect(update('mrf-1', { notes: 'x' })).rejects.toThrow(BusinessRuleError);
      await expect(update('mrf-1', { notes: 'x' })).rejects.toThrow('Only draft MRFs can be updated');
    });

    it('transforms date fields to Date objects', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'draft' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf());

      await update('mrf-1', { requestDate: '2025-07-01', requiredDate: '2025-08-01' });

      const call = mockPrisma.materialRequisition.update.mock.calls[0][0];
      expect(call.data.requestDate).toEqual(new Date('2025-07-01'));
      expect(call.data.requiredDate).toEqual(new Date('2025-08-01'));
    });
  });

  // ─── submit ──────────────────────────────────────────────────────────

  describe('submit', () => {
    it('calls assertTransition and updates to submitted', async () => {
      const mrf = makeMrf({ status: 'draft' });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockPrisma.materialRequisition.update.mockResolvedValue({ ...mrf, status: 'submitted' });

      await submit('mrf-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrf', 'draft', 'submitted');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrf-1' },
          data: { status: 'submitted' },
        }),
      );
    });

    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(submit('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── review ──────────────────────────────────────────────────────────

  describe('review', () => {
    it('calls assertTransition and sets reviewedById and reviewDate', async () => {
      const mrf = makeMrf({ status: 'submitted' });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockPrisma.materialRequisition.update.mockResolvedValue({ ...mrf, status: 'under_review' });

      await review('mrf-1', 'reviewer-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrf', 'submitted', 'under_review');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'under_review',
            reviewedById: 'reviewer-1',
            reviewDate: expect.any(Date),
          }),
        }),
      );
    });

    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(review('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── approve ─────────────────────────────────────────────────────────

  describe('approve', () => {
    it('calls assertTransition and sets approvedById and approvalDate', async () => {
      const mrf = makeMrf({ status: 'under_review' });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockPrisma.materialRequisition.update.mockResolvedValue({ ...mrf, status: 'approved' });

      await approve('mrf-1', 'approver-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('mrf', 'under_review', 'approved');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            approvedById: 'approver-1',
            approvalDate: expect.any(Date),
          }),
        }),
      );
    });

    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(approve('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── checkStock ──────────────────────────────────────────────────────

  describe('checkStock', () => {
    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(checkStock('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when MRF is not approved', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(
        makeMrf({ status: 'draft', mrfLines: [], project: { id: 'proj-1', warehouses: [] } }),
      );

      await expect(checkStock('mrf-1')).rejects.toThrow(BusinessRuleError);
      await expect(checkStock('mrf-1')).rejects.toThrow('MRF must be approved to check stock');
    });

    it('checks stock for each line across project warehouses', async () => {
      const mrf = makeMrf({
        status: 'approved',
        mrfLines: [makeMrfLine({ id: 'line-1', itemId: 'item-1', qtyRequested: 10 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }, { id: 'wh-2' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGetStockLevel
        .mockResolvedValueOnce({ available: 6 }) // wh-1
        .mockResolvedValueOnce({ available: 4 }); // wh-2
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'checking_stock' });

      const result = await checkStock('mrf-1');

      expect(mockedGetStockLevel).toHaveBeenCalledTimes(2);
      expect(mockedGetStockLevel).toHaveBeenCalledWith('item-1', 'wh-1');
      expect(mockedGetStockLevel).toHaveBeenCalledWith('item-1', 'wh-2');
      expect(result.stockResults[0]).toEqual(
        expect.objectContaining({ lineId: 'line-1', available: 10, source: 'from_stock' }),
      );
    });

    it('marks source as from_stock when enough stock', async () => {
      const mrf = makeMrf({
        status: 'approved',
        mrfLines: [makeMrfLine({ qtyRequested: 5 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGetStockLevel.mockResolvedValue({ available: 10 });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'checking_stock' });

      const result = await checkStock('mrf-1');

      expect(result.stockResults[0].source).toBe('from_stock');
      expect(mockPrisma.mrfLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: 'from_stock', qtyFromStock: 5, qtyFromPurchase: 0 }),
        }),
      );
    });

    it('marks source as both when partial stock', async () => {
      const mrf = makeMrf({
        status: 'approved',
        mrfLines: [makeMrfLine({ qtyRequested: 10 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGetStockLevel.mockResolvedValue({ available: 3 });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'checking_stock' });

      const result = await checkStock('mrf-1');

      expect(result.stockResults[0].source).toBe('both');
      expect(mockPrisma.mrfLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: 'both', qtyFromStock: 3, qtyFromPurchase: 7 }),
        }),
      );
    });

    it('marks source as purchase_required when no stock', async () => {
      const mrf = makeMrf({
        status: 'approved',
        mrfLines: [makeMrfLine({ qtyRequested: 10 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGetStockLevel.mockResolvedValue({ available: 0 });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'checking_stock' });

      const result = await checkStock('mrf-1');

      expect(result.stockResults[0].source).toBe('purchase_required');
    });

    it('marks lines without itemId as purchase_required without checking stock', async () => {
      const mrf = makeMrf({
        status: 'approved',
        mrfLines: [makeMrfLine({ itemId: null, qtyRequested: 5 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'checking_stock' });

      const result = await checkStock('mrf-1');

      expect(mockedGetStockLevel).not.toHaveBeenCalled();
      expect(result.stockResults[0]).toEqual(
        expect.objectContaining({ itemId: null, available: 0, source: 'purchase_required' }),
      );
    });

    it('updates MRF status to checking_stock', async () => {
      const mrf = makeMrf({
        status: 'approved',
        mrfLines: [],
        project: { id: 'proj-1', warehouses: [] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'checking_stock' });

      const result = await checkStock('mrf-1');

      expect(result.status).toBe('checking_stock');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'checking_stock' },
        }),
      );
    });
  });

  // ─── convertToMirv ───────────────────────────────────────────────────

  describe('convertToMirv', () => {
    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(convertToMirv('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is invalid', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(
        makeMrf({ status: 'draft', mrfLines: [], project: { id: 'proj-1', warehouses: [] } }),
      );

      await expect(convertToMirv('mrf-1', 'user-1')).rejects.toThrow(BusinessRuleError);
    });

    it('returns needs_purchase when no fromStock lines', async () => {
      const mrf = makeMrf({
        status: 'checking_stock',
        mrfLines: [makeMrfLine({ source: 'purchase_required' })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockPrisma.materialRequisition.update.mockResolvedValue({ status: 'needs_purchase' });

      const result = await convertToMirv('mrf-1', 'user-1');

      expect(result.mirv).toBeNull();
      expect(result.status).toBe('needs_purchase');
    });

    it('creates MIRV with from_stock lines', async () => {
      const mrf = makeMrf({
        status: 'checking_stock',
        mrfNumber: 'MRF-2025-0001',
        priority: 'normal',
        mrfLines: [
          makeMrfLine({ id: 'line-1', source: 'from_stock', itemId: 'item-1', qtyFromStock: 5, qtyRequested: 5 }),
          makeMrfLine({ id: 'line-2', source: 'purchase_required', itemId: 'item-2' }),
        ],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGenDoc.mockResolvedValue('MIRV-2025-0001');
      mockPrisma.mirv.create.mockResolvedValue({
        id: 'mirv-1',
        mirvNumber: 'MIRV-2025-0001',
        mirvLines: [{ id: 'mirv-line-1' }],
      });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({});

      const result = await convertToMirv('mrf-1', 'user-1');

      expect(mockedGenDoc).toHaveBeenCalledWith('mirv');
      expect(mockPrisma.mirv.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mirvNumber: 'MIRV-2025-0001',
            projectId: 'proj-1',
            warehouseId: 'wh-1',
            requestedById: 'user-1',
            status: 'draft',
            mrfId: 'mrf-1',
          }),
        }),
      );
      expect(result.mirv).toEqual({ id: 'mirv-1', mirvNumber: 'MIRV-2025-0001' });
    });

    it('uses warehouseIdOverride when provided', async () => {
      const mrf = makeMrf({
        status: 'checking_stock',
        mrfLines: [makeMrfLine({ source: 'from_stock', qtyFromStock: 5 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGenDoc.mockResolvedValue('MIRV-2025-0002');
      mockPrisma.mirv.create.mockResolvedValue({
        id: 'mirv-2',
        mirvNumber: 'MIRV-2025-0002',
        mirvLines: [{ id: 'ml-1' }],
      });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({});

      await convertToMirv('mrf-1', 'user-1', 'wh-override');

      const call = mockPrisma.mirv.create.mock.calls[0][0];
      expect(call.data.warehouseId).toBe('wh-override');
    });

    it('throws BusinessRuleError when no warehouse available', async () => {
      const mrf = makeMrf({
        status: 'checking_stock',
        mrfLines: [makeMrfLine({ source: 'from_stock', qtyFromStock: 5 })],
        project: { id: 'proj-1', warehouses: [] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);

      await expect(convertToMirv('mrf-1', 'user-1')).rejects.toThrow(BusinessRuleError);
    });

    it('sets newStatus to from_stock when all lines are from_stock', async () => {
      const mrf = makeMrf({
        status: 'checking_stock',
        mrfLines: [makeMrfLine({ source: 'from_stock', qtyFromStock: 10 })],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGenDoc.mockResolvedValue('MIRV-2025-0003');
      mockPrisma.mirv.create.mockResolvedValue({
        id: 'mirv-3',
        mirvNumber: 'MIRV-2025-0003',
        mirvLines: [{ id: 'ml-1' }],
      });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({});

      const result = await convertToMirv('mrf-1', 'user-1');

      expect(result.status).toBe('from_stock');
    });

    it('sets newStatus to needs_purchase when some lines need purchase', async () => {
      const mrf = makeMrf({
        status: 'checking_stock',
        mrfLines: [
          makeMrfLine({ id: 'line-1', source: 'from_stock', qtyFromStock: 10 }),
          makeMrfLine({ id: 'line-2', source: 'purchase_required' }),
        ],
        project: { id: 'proj-1', warehouses: [{ id: 'wh-1' }] },
      });
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(mrf);
      mockedGenDoc.mockResolvedValue('MIRV-2025-0004');
      mockPrisma.mirv.create.mockResolvedValue({
        id: 'mirv-4',
        mirvNumber: 'MIRV-2025-0004',
        mirvLines: [{ id: 'ml-1' }],
      });
      mockPrisma.mrfLine.update.mockResolvedValue({});
      mockPrisma.materialRequisition.update.mockResolvedValue({});

      const result = await convertToMirv('mrf-1', 'user-1');

      expect(result.status).toBe('needs_purchase');
    });
  });

  // ─── fulfill ─────────────────────────────────────────────────────────

  describe('fulfill', () => {
    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(fulfill('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is not fulfillable', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'draft' }));

      await expect(fulfill('mrf-1')).rejects.toThrow(BusinessRuleError);
    });

    it('fulfills from from_stock status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'from_stock' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf({ status: 'fulfilled' }));

      const result = await fulfill('mrf-1');

      expect(result.status).toBe('fulfilled');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'fulfilled',
            fulfillmentDate: expect.any(Date),
          }),
        }),
      );
    });

    it('fulfills from needs_purchase status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'needs_purchase' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf({ status: 'fulfilled' }));

      const result = await fulfill('mrf-1');

      expect(result.status).toBe('fulfilled');
    });
  });

  // ─── reject ──────────────────────────────────────────────────────────

  describe('reject', () => {
    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(reject('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is not rejectable', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'approved' }));

      await expect(reject('mrf-1')).rejects.toThrow(BusinessRuleError);
    });

    it('rejects from submitted status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'submitted' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf({ status: 'rejected' }));

      const result = await reject('mrf-1');

      expect(result.status).toBe('rejected');
    });

    it('rejects from under_review status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'under_review' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf({ status: 'rejected' }));

      const result = await reject('mrf-1');

      expect(result.status).toBe('rejected');
    });
  });

  // ─── cancel ──────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws NotFoundError when MRF not found', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is fulfilled', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'fulfilled' }));

      await expect(cancel('mrf-1')).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when status is already cancelled', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'cancelled' }));

      await expect(cancel('mrf-1')).rejects.toThrow(BusinessRuleError);
    });

    it('cancels from draft status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'draft' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf({ status: 'cancelled' }));

      const result = await cancel('mrf-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'cancelled' },
        }),
      );
    });

    it('cancels from submitted status', async () => {
      mockPrisma.materialRequisition.findUnique.mockResolvedValue(makeMrf({ status: 'submitted' }));
      mockPrisma.materialRequisition.update.mockResolvedValue(makeMrf({ status: 'cancelled' }));

      const result = await cancel('mrf-1');

      expect(result.status).toBe('cancelled');
    });
  });
});
