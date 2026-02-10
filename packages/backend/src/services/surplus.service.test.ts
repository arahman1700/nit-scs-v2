import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, evaluate, approve, scmApprove, action, close } from './surplus.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { assertTransition } from '@nit-scs-v2/shared';

const mockedGenerateDocNumber = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

describe('surplus.service', () => {
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
      const rows = [{ id: 'surplus-1' }];
      mockPrisma.surplusItem.findMany.mockResolvedValue(rows);
      mockPrisma.surplusItem.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter', async () => {
      mockPrisma.surplusItem.findMany.mockResolvedValue([]);
      mockPrisma.surplusItem.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'SURPLUS-001' });

      const where = mockPrisma.surplusItem.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(1);
    });

    it('should apply status and warehouseId filters', async () => {
      mockPrisma.surplusItem.findMany.mockResolvedValue([]);
      mockPrisma.surplusItem.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'identified', warehouseId: 'wh-1' });

      const where = mockPrisma.surplusItem.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('identified');
      expect(where.warehouseId).toBe('wh-1');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.surplusItem.findMany.mockResolvedValue([]);
      mockPrisma.surplusItem.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 15, pageSize: 10 });

      const args = mockPrisma.surplusItem.findMany.mock.calls[0][0];
      expect(args.skip).toBe(15);
      expect(args.take).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the surplus item when found', async () => {
      const surplus = { id: 'surplus-1', surplusNumber: 'SURPLUS-001' };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);

      const result = await getById('surplus-1');

      expect(result).toEqual(surplus);
      expect(mockPrisma.surplusItem.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'surplus-1' } }),
      );
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const data = {
      itemId: 'item-1',
      warehouseId: 'wh-1',
      qty: 50,
      condition: 'good',
    };

    it('should generate document number and create surplus item', async () => {
      mockedGenerateDocNumber.mockResolvedValue('SURPLUS-001');
      mockPrisma.surplusItem.create.mockResolvedValue({ id: 'surplus-1', surplusNumber: 'SURPLUS-001' });

      const result = await create(data, 'user-1');

      expect(result).toEqual({ id: 'surplus-1', surplusNumber: 'SURPLUS-001' });
      expect(mockedGenerateDocNumber).toHaveBeenCalledWith('surplus');
    });

    it('should set status to identified and createdById', async () => {
      mockedGenerateDocNumber.mockResolvedValue('SURPLUS-002');
      mockPrisma.surplusItem.create.mockResolvedValue({ id: 'surplus-2' });

      await create(data, 'user-1');

      const createArgs = mockPrisma.surplusItem.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('identified');
      expect(createArgs.data.createdById).toBe('user-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a surplus item in identified status', async () => {
      const existing = { id: 'surplus-1', status: 'identified' };
      const updated = { id: 'surplus-1', status: 'identified', condition: 'fair' };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(existing);
      mockPrisma.surplusItem.update.mockResolvedValue(updated);

      const result = await update('surplus-1', { condition: 'fair' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when surplus is not identified', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue({ id: 'surplus-1', status: 'evaluated' });

      await expect(update('surplus-1', {})).rejects.toThrow('Only surplus items in "identified" status can be updated');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // evaluate (identified -> evaluated)
  // ─────────────────────────────────────────────────────────────────────────
  describe('evaluate', () => {
    it('should transition to evaluated', async () => {
      const surplus = { id: 'surplus-1', status: 'identified' };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.surplusItem.update.mockResolvedValue({ ...surplus, status: 'evaluated' });

      const result = await evaluate('surplus-1');

      expect(result.status).toBe('evaluated');
      expect(mockedAssertTransition).toHaveBeenCalledWith('surplus', 'identified', 'evaluated');
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(evaluate('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approve (evaluated -> approved) -- sets ouHeadApprovalDate
  // ─────────────────────────────────────────────────────────────────────────
  describe('approve', () => {
    it('should transition to approved and set ouHeadApprovalDate', async () => {
      const surplus = { id: 'surplus-1', status: 'evaluated' };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.surplusItem.update.mockResolvedValue({ ...surplus, status: 'approved' });

      const result = await approve('surplus-1');

      expect(result.status).toBe('approved');
      expect(mockedAssertTransition).toHaveBeenCalledWith('surplus', 'evaluated', 'approved');
      const updateData = mockPrisma.surplusItem.update.mock.calls[0][0].data;
      expect(updateData.ouHeadApprovalDate).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(approve('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // scmApprove -- validates 14-day timeout
  // ─────────────────────────────────────────────────────────────────────────
  describe('scmApprove', () => {
    it('should approve when 14+ days have passed since OU Head approval', async () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const surplus = {
        id: 'surplus-1',
        status: 'approved',
        ouHeadApprovalDate: fifteenDaysAgo,
      };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockPrisma.surplusItem.update.mockResolvedValue(surplus);

      await scmApprove('surplus-1', 'scm-user-1');

      expect(mockPrisma.surplusItem.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when 14-day timeout has not elapsed', async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const surplus = {
        id: 'surplus-1',
        status: 'approved',
        ouHeadApprovalDate: fiveDaysAgo,
      };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);

      await expect(scmApprove('surplus-1', 'scm-user-1')).rejects.toThrow('2-week timeout period has not elapsed');
    });

    it('should throw when surplus is not in approved status', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue({
        id: 'surplus-1',
        status: 'evaluated',
        ouHeadApprovalDate: new Date(),
      });

      await expect(scmApprove('surplus-1', 'scm-user-1')).rejects.toThrow(
        'Surplus must be in approved status for SCM approval',
      );
    });

    it('should throw when ouHeadApprovalDate is missing', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue({
        id: 'surplus-1',
        status: 'approved',
        ouHeadApprovalDate: null,
      });

      await expect(scmApprove('surplus-1', 'scm-user-1')).rejects.toThrow(
        'OU Head approval date is required before SCM can approve',
      );
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(scmApprove('nonexistent', 'scm-user-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // action -- transfer creates WT, return creates MRN, sell does nothing extra
  // ─────────────────────────────────────────────────────────────────────────
  describe('action', () => {
    it('should create a warehouse transfer for disposition=transfer', async () => {
      const surplus = {
        id: 'surplus-1',
        status: 'approved',
        disposition: 'transfer',
        warehouseId: 'wh-1',
        surplusNumber: 'SURPLUS-001',
        projectId: null,
      };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);
      mockedGenerateDocNumber.mockResolvedValue('WT-001');
      mockPrisma.stockTransfer.create.mockResolvedValue({ id: 'wt-1' });
      mockPrisma.surplusItem.update.mockResolvedValue({ ...surplus, status: 'actioned' });

      const result = await action('surplus-1', 'user-1');

      expect(result.linkedDocumentId).toBe('wt-1');
      expect(result.linkedDocumentType).toBe('wt');
      expect(mockPrisma.stockTransfer.create).toHaveBeenCalledTimes(1);
    });

    it('should create an MRN for disposition=return', async () => {
      const surplus = {
        id: 'surplus-1',
        status: 'approved',
        disposition: 'return',
        warehouseId: 'wh-1',
        surplusNumber: 'SURPLUS-001',
        projectId: 'proj-1',
      };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);
      mockedGenerateDocNumber.mockResolvedValue('MRV-001');
      mockPrisma.mrv.create.mockResolvedValue({ id: 'mrn-1' });
      mockPrisma.surplusItem.update.mockResolvedValue({ ...surplus, status: 'actioned' });

      const result = await action('surplus-1', 'user-1');

      expect(result.linkedDocumentId).toBe('mrn-1');
      expect(result.linkedDocumentType).toBe('mrn');
      expect(mockPrisma.mrv.create).toHaveBeenCalledTimes(1);
      const mrnData = mockPrisma.mrv.create.mock.calls[0][0].data;
      expect(mrnData.returnType).toBe('return_to_supplier');
    });

    it('should not create a downstream document for disposition=sell', async () => {
      const surplus = {
        id: 'surplus-1',
        status: 'approved',
        disposition: 'sell',
        warehouseId: 'wh-1',
        surplusNumber: 'SURPLUS-001',
        projectId: null,
      };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.surplusItem.update.mockResolvedValue({ ...surplus, status: 'actioned' });

      const result = await action('surplus-1', 'user-1');

      expect(result.linkedDocumentId).toBeNull();
      expect(result.linkedDocumentType).toBeNull();
      expect(mockPrisma.stockTransfer.create).not.toHaveBeenCalled();
      expect(mockPrisma.mrv.create).not.toHaveBeenCalled();
    });

    it('should throw when disposition is not set', async () => {
      const surplus = {
        id: 'surplus-1',
        status: 'approved',
        disposition: null,
        warehouseId: 'wh-1',
        surplusNumber: 'SURPLUS-001',
      };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(action('surplus-1', 'user-1')).rejects.toThrow(
        'Disposition must be set before actioning surplus item',
      );
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(action('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // close (actioned -> closed)
  // ─────────────────────────────────────────────────────────────────────────
  describe('close', () => {
    it('should transition to closed', async () => {
      const surplus = { id: 'surplus-1', status: 'actioned' };
      mockPrisma.surplusItem.findUnique.mockResolvedValue(surplus);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.surplusItem.update.mockResolvedValue({ ...surplus, status: 'closed' });

      const result = await close('surplus-1');

      expect(result.status).toBe('closed');
      expect(mockedAssertTransition).toHaveBeenCalledWith('surplus', 'actioned', 'closed');
    });

    it('should throw NotFoundError when surplus not found', async () => {
      mockPrisma.surplusItem.findUnique.mockResolvedValue(null);

      await expect(close('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
