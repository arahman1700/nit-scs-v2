import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./approval.service.js', () => ({ submitForApproval: vi.fn(), processApproval: vi.fn() }));
vi.mock('./inventory.service.js', () => ({
  reserveStockBatch: vi.fn(),
  consumeReservationBatch: vi.fn(),
  releaseReservation: vi.fn(),
}));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../utils/cache.js', () => ({ invalidateCachePattern: vi.fn() }));
vi.mock('@nit-scs/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, submit, approve, issue, cancel } from './mirv.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { submitForApproval, processApproval } from './approval.service.js';
import { reserveStockBatch, consumeReservationBatch, releaseReservation } from './inventory.service.js';
import { assertTransition } from '@nit-scs/shared';

const mockedGenerateDocNumber = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedSubmitForApproval = submitForApproval as ReturnType<typeof vi.fn>;
const mockedProcessApproval = processApproval as ReturnType<typeof vi.fn>;
const mockedReserveStockBatch = reserveStockBatch as ReturnType<typeof vi.fn>;
const mockedConsumeReservationBatch = consumeReservationBatch as ReturnType<typeof vi.fn>;
const mockedReleaseReservation = releaseReservation as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

describe('mirv.service', () => {
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
      const rows = [{ id: 'mirv-1' }];
      mockPrisma.mirv.findMany.mockResolvedValue(rows);
      mockPrisma.mirv.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.mirv.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'MIRV-001' });

      const where = mockPrisma.mirv.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('should apply status filter', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.mirv.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'draft' });

      const where = mockPrisma.mirv.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('draft');
    });

    it('should apply scope filters', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.mirv.count.mockResolvedValue(0);

      await list({ ...baseParams, warehouseId: 'wh-1', projectId: 'proj-1', requestedById: 'user-1' });

      const where = mockPrisma.mirv.findMany.mock.calls[0][0].where;
      expect(where.warehouseId).toBe('wh-1');
      expect(where.projectId).toBe('proj-1');
      expect(where.requestedById).toBe('user-1');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.mirv.findMany.mockResolvedValue([]);
      mockPrisma.mirv.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.mirv.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the MIRV when found', async () => {
      const mirv = { id: 'mirv-1', mirvNumber: 'MIRV-001' };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);

      const result = await getById('mirv-1');

      expect(result).toEqual(mirv);
      expect(mockPrisma.mirv.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mirv-1' } }));
    });

    it('should throw NotFoundError when MIRV not found', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const headerData = {
      projectId: 'proj-1',
      warehouseId: 'wh-1',
      requestDate: '2026-03-01T00:00:00Z',
      priority: 'normal' as const,
    };
    const lines = [
      { itemId: 'item-1', qtyRequested: 10 },
      { itemId: 'item-2', qtyRequested: 5 },
    ];

    it('should generate document number and create MIRV with lines', async () => {
      mockedGenerateDocNumber.mockResolvedValue('MIRV-001');
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', standardCost: 100 },
        { id: 'item-2', standardCost: 100 },
      ]);
      mockPrisma.mirv.create.mockResolvedValue({ id: 'mirv-1', mirvNumber: 'MIRV-001' });

      const result = await create(headerData, lines, 'user-1');

      expect(result).toEqual({ id: 'mirv-1', mirvNumber: 'MIRV-001' });
      expect(mockedGenerateDocNumber).toHaveBeenCalledWith('mirv');
    });

    it('should calculate estimatedValue from standardCost * qtyRequested', async () => {
      mockedGenerateDocNumber.mockResolvedValue('MIRV-002');
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', standardCost: 50 }, // 50 * 10 = 500
        { id: 'item-2', standardCost: 200 }, // 200 * 5 = 1000
      ]);
      mockPrisma.mirv.create.mockResolvedValue({ id: 'mirv-2' });

      await create(headerData, lines, 'user-1');

      const createArgs = mockPrisma.mirv.create.mock.calls[0][0];
      expect(createArgs.data.estimatedValue).toBe(1500);
    });

    it('should handle items without standardCost', async () => {
      mockedGenerateDocNumber.mockResolvedValue('MIRV-003');
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', standardCost: null },
        { id: 'item-2', standardCost: null },
      ]);
      mockPrisma.mirv.create.mockResolvedValue({ id: 'mirv-3' });

      await create(headerData, lines, 'user-1');

      const createArgs = mockPrisma.mirv.create.mock.calls[0][0];
      expect(createArgs.data.estimatedValue).toBe(0);
    });

    it('should set status to draft', async () => {
      mockedGenerateDocNumber.mockResolvedValue('MIRV-004');
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', standardCost: 10 },
        { id: 'item-2', standardCost: 10 },
      ]);
      mockPrisma.mirv.create.mockResolvedValue({ id: 'mirv-4' });

      await create(headerData, lines, 'user-1');

      const createArgs = mockPrisma.mirv.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
      expect(createArgs.data.requestedById).toBe('user-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a draft MIRV', async () => {
      const existing = { id: 'mirv-1', status: 'draft' };
      const updated = { id: 'mirv-1', status: 'draft', notes: 'Updated' };
      mockPrisma.mirv.findUnique.mockResolvedValue(existing);
      mockPrisma.mirv.update.mockResolvedValue(updated);

      const result = await update('mirv-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when MIRV not found', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when MIRV is not draft', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue({ id: 'mirv-1', status: 'approved' });

      await expect(update('mirv-1', {})).rejects.toThrow('Only draft MIRVs can be updated');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // submit
  // ─────────────────────────────────────────────────────────────────────────
  describe('submit', () => {
    it('should submit MIRV for approval', async () => {
      const mirv = { id: 'mirv-1', status: 'draft', estimatedValue: 5000 };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
      mockedAssertTransition.mockReturnValue(undefined);
      mockedSubmitForApproval.mockResolvedValue({ approverRole: 'warehouse_manager', slaHours: 24 });

      const result = await submit('mirv-1', 'user-1');

      expect(result).toEqual({ id: 'mirv-1', approverRole: 'warehouse_manager', slaHours: 24 });
      expect(mockedAssertTransition).toHaveBeenCalledWith('mirv', 'draft', 'pending_approval');
    });

    it('should throw NotFoundError when MIRV not found', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(submit('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should call submitForApproval with correct params', async () => {
      const mirv = { id: 'mirv-1', status: 'draft', estimatedValue: 3000 };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
      mockedAssertTransition.mockReturnValue(undefined);
      mockedSubmitForApproval.mockResolvedValue({ approverRole: 'admin', slaHours: 48 });

      await submit('mirv-1', 'user-1');

      expect(mockedSubmitForApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'mirv',
          documentId: 'mirv-1',
          amount: 3000,
          submittedById: 'user-1',
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approve
  // ─────────────────────────────────────────────────────────────────────────
  describe('approve', () => {
    const pendingMirv = {
      id: 'mirv-1',
      status: 'pending_approval',
      warehouseId: 'wh-1',
      mirvLines: [
        { id: 'line-1', itemId: 'item-1', qtyRequested: 10 },
        { id: 'line-2', itemId: 'item-2', qtyRequested: 5 },
      ],
    };

    it('should approve and reserve stock via batch call', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(pendingMirv);
      mockedProcessApproval.mockResolvedValue(undefined);
      mockedReserveStockBatch.mockResolvedValue({ success: true, failedItems: [] });
      mockPrisma.mirvLine.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});

      const result = await approve('mirv-1', 'approve', 'user-1', 'Looks good');

      expect(result).toEqual({
        id: 'mirv-1',
        action: 'approve',
        status: 'approved',
        warehouseId: 'wh-1',
      });
      expect(mockedReserveStockBatch).toHaveBeenCalledTimes(1);
      expect(mockedReserveStockBatch).toHaveBeenCalledWith([
        { itemId: 'item-1', warehouseId: 'wh-1', qty: 10 },
        { itemId: 'item-2', warehouseId: 'wh-1', qty: 5 },
      ]);
      expect(mockPrisma.mirvLine.update).toHaveBeenCalledTimes(2);
    });

    it('should set reservationStatus to "none" when stock reservation fails', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(pendingMirv);
      mockedProcessApproval.mockResolvedValue(undefined);
      mockedReserveStockBatch.mockResolvedValue({ success: false, failedItems: ['item-1'] });
      mockPrisma.mirvLine.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});

      await approve('mirv-1', 'approve', 'user-1');

      const mirvUpdate = mockPrisma.mirv.update.mock.calls[0][0];
      expect(mirvUpdate.data.reservationStatus).toBe('none');
    });

    it('should reject without reserving stock', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(pendingMirv);
      mockedProcessApproval.mockResolvedValue(undefined);

      const result = await approve('mirv-1', 'reject', 'user-1', 'Not needed');

      expect(result.status).toBe('rejected');
      expect(mockedReserveStockBatch).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when MIRV not found', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(approve('nonexistent', 'approve', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when not pending_approval', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue({
        id: 'mirv-1',
        status: 'draft',
        mirvLines: [],
      });

      await expect(approve('mirv-1', 'approve', 'user-1')).rejects.toThrow('MIRV must be pending approval');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // issue
  // ─────────────────────────────────────────────────────────────────────────
  describe('issue', () => {
    const approvedMirv = {
      id: 'mirv-1',
      status: 'approved',
      warehouseId: 'wh-1',
      projectId: 'proj-1',
      locationOfWork: 'Site A',
      mirvLines: [
        { id: 'line-1', itemId: 'item-1', qtyRequested: 10, qtyApproved: 8 },
        { id: 'line-2', itemId: 'item-2', qtyRequested: 5, qtyApproved: null },
      ],
    };

    it('should issue materials, consume reservations via batch, and create gate pass', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(approvedMirv);
      mockedConsumeReservationBatch.mockResolvedValue({
        totalCost: 1000,
        lineCosts: new Map([
          ['line-1', 800],
          ['line-2', 200],
        ]),
      });
      mockPrisma.mirvLine.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});
      mockedGenerateDocNumber.mockResolvedValue('GP-001');
      mockPrisma.gatePass.create.mockResolvedValue({});

      const result = await issue('mirv-1', 'user-1');

      expect(result.id).toBe('mirv-1');
      expect(result.totalCost).toBe(1000);
      expect(mockedConsumeReservationBatch).toHaveBeenCalledTimes(1);
      expect(mockedConsumeReservationBatch).toHaveBeenCalledWith([
        { itemId: 'item-1', warehouseId: 'wh-1', qty: 8, mirvLineId: 'line-1' },
        { itemId: 'item-2', warehouseId: 'wh-1', qty: 5, mirvLineId: 'line-2' },
      ]);
      expect(mockPrisma.gatePass.create).toHaveBeenCalledTimes(1);
    });

    it('should use qtyApproved when available, fallback to qtyRequested', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(approvedMirv);
      mockedConsumeReservationBatch.mockResolvedValue({
        totalCost: 500,
        lineCosts: new Map([
          ['line-1', 400],
          ['line-2', 100],
        ]),
      });
      mockPrisma.mirvLine.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});
      mockedGenerateDocNumber.mockResolvedValue('GP-002');
      mockPrisma.gatePass.create.mockResolvedValue({});

      await issue('mirv-1', 'user-1');

      // Batch call should include: line-1 qty=8 (qtyApproved), line-2 qty=5 (fallback to qtyRequested)
      const batchArg = mockedConsumeReservationBatch.mock.calls[0][0];
      expect(batchArg[0]).toEqual({ itemId: 'item-1', warehouseId: 'wh-1', qty: 8, mirvLineId: 'line-1' });
      expect(batchArg[1]).toEqual({ itemId: 'item-2', warehouseId: 'wh-1', qty: 5, mirvLineId: 'line-2' });
    });

    it('should update mirv status to issued', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(approvedMirv);
      mockedConsumeReservationBatch.mockResolvedValue({
        totalCost: 0,
        lineCosts: new Map(),
      });
      mockPrisma.mirvLine.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});
      mockedGenerateDocNumber.mockResolvedValue('GP-003');
      mockPrisma.gatePass.create.mockResolvedValue({});

      await issue('mirv-1', 'user-1');

      const mirvUpdate = mockPrisma.mirv.update.mock.calls[0][0];
      expect(mirvUpdate.data.status).toBe('issued');
      expect(mirvUpdate.data.issuedById).toBe('user-1');
      expect(mirvUpdate.data.reservationStatus).toBe('released');
    });

    it('should throw NotFoundError when MIRV not found', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(issue('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when status is invalid', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue({
        id: 'mirv-1',
        status: 'draft',
        mirvLines: [],
      });

      await expect(issue('mirv-1', 'user-1')).rejects.toThrow(
        'MIRV must be approved or partially issued to issue materials',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('should cancel an approved MIRV with reserved stock', async () => {
      const mirv = {
        id: 'mirv-1',
        status: 'approved',
        warehouseId: 'wh-1',
        reservationStatus: 'reserved',
        mirvLines: [{ id: 'line-1', itemId: 'item-1', qtyApproved: 10, qtyRequested: 10 }],
      };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
      mockedReleaseReservation.mockResolvedValue(undefined);
      mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

      const result = await cancel('mirv-1');

      expect(result.wasReserved).toBe(true);
      expect(mockedReleaseReservation).toHaveBeenCalledWith('item-1', 'wh-1', 10);
    });

    it('should cancel without releasing when not reserved', async () => {
      const mirv = {
        id: 'mirv-1',
        status: 'pending_approval',
        warehouseId: 'wh-1',
        reservationStatus: 'none',
        mirvLines: [],
      };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
      mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

      const result = await cancel('mirv-1');

      expect(result.wasReserved).toBe(false);
      expect(mockedReleaseReservation).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when MIRV not found', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when status is not cancellable', async () => {
      mockPrisma.mirv.findUnique.mockResolvedValue({
        id: 'mirv-1',
        status: 'issued',
        mirvLines: [],
      });

      await expect(cancel('mirv-1')).rejects.toThrow('MIRV cannot be cancelled from status: issued');
    });

    it('should update status to cancelled and reservationStatus to released', async () => {
      const mirv = {
        id: 'mirv-1',
        status: 'approved',
        warehouseId: 'wh-1',
        reservationStatus: 'none',
        mirvLines: [],
      };
      mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
      mockPrisma.mirv.update.mockResolvedValue({});

      await cancel('mirv-1');

      const updateArgs = mockPrisma.mirv.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe('cancelled');
      expect(updateArgs.data.reservationStatus).toBe('released');
    });
  });
});
