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
import {
  list,
  getById,
  create,
  update,
  report,
  approveBySiteManager,
  approveByQc,
  approveByStorekeeper,
  approve,
  sendToSsc,
  markSold,
  dispose,
  close,
} from './scrap.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { assertTransition } from '@nit-scs-v2/shared';

const mockedGenerateDocNumber = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

describe('scrap.service', () => {
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
      const rows = [{ id: 'scrap-1' }];
      mockPrisma.scrapItem.findMany.mockResolvedValue(rows);
      mockPrisma.scrapItem.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.scrapItem.findMany.mockResolvedValue([]);
      mockPrisma.scrapItem.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'SCRAP-001' });

      const where = mockPrisma.scrapItem.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('should apply status and projectId filters', async () => {
      mockPrisma.scrapItem.findMany.mockResolvedValue([]);
      mockPrisma.scrapItem.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'identified', projectId: 'proj-1' });

      const where = mockPrisma.scrapItem.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('identified');
      expect(where.projectId).toBe('proj-1');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.scrapItem.findMany.mockResolvedValue([]);
      mockPrisma.scrapItem.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 5, pageSize: 10 });

      const args = mockPrisma.scrapItem.findMany.mock.calls[0][0];
      expect(args.skip).toBe(5);
      expect(args.take).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the scrap item when found', async () => {
      const scrap = { id: 'scrap-1', scrapNumber: 'SCRAP-001' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);

      const result = await getById('scrap-1');

      expect(result).toEqual(scrap);
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const data = {
      projectId: 'proj-1',
      materialType: 'metal',
      description: 'Scrap metal',
      qty: 100,
    };

    it('should generate document number and create scrap item', async () => {
      mockedGenerateDocNumber.mockResolvedValue('SCRAP-001');
      mockPrisma.scrapItem.create.mockResolvedValue({ id: 'scrap-1', scrapNumber: 'SCRAP-001' });

      const result = await create(data, 'user-1');

      expect(result).toEqual({ id: 'scrap-1', scrapNumber: 'SCRAP-001' });
      expect(mockedGenerateDocNumber).toHaveBeenCalledWith('scrap');
    });

    it('should set status to identified and createdById', async () => {
      mockedGenerateDocNumber.mockResolvedValue('SCRAP-002');
      mockPrisma.scrapItem.create.mockResolvedValue({ id: 'scrap-2' });

      await create(data, 'user-1');

      const createArgs = mockPrisma.scrapItem.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('identified');
      expect(createArgs.data.createdById).toBe('user-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a scrap item in identified status', async () => {
      const existing = { id: 'scrap-1', status: 'identified' };
      const updated = { id: 'scrap-1', status: 'identified', description: 'Updated' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(existing);
      mockPrisma.scrapItem.update.mockResolvedValue(updated);

      const result = await update('scrap-1', { description: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when scrap is not identified', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue({ id: 'scrap-1', status: 'reported' });

      await expect(update('scrap-1', {})).rejects.toThrow('Only scrap items in "identified" status can be updated');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // report (identified -> reported) -- requires photos (SCRAP-V001)
  // ─────────────────────────────────────────────────────────────────────────
  describe('report', () => {
    it('should transition to reported when photos are present', async () => {
      const scrap = { id: 'scrap-1', status: 'identified', photos: ['photo1.jpg'] };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, status: 'reported' });

      const result = await report('scrap-1');

      expect(result.status).toBe('reported');
      expect(mockedAssertTransition).toHaveBeenCalledWith('scrap', 'identified', 'reported');
    });

    it('should throw BusinessRuleError when photos are missing (SCRAP-V001)', async () => {
      const scrap = { id: 'scrap-1', status: 'identified', photos: [] };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(report('scrap-1')).rejects.toThrow('Photos are required before reporting scrap items (SCRAP-V001)');
    });

    it('should throw BusinessRuleError when photos is null', async () => {
      const scrap = { id: 'scrap-1', status: 'identified', photos: null };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(report('scrap-1')).rejects.toThrow('Photos are required before reporting scrap items (SCRAP-V001)');
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(report('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-approval: approveBySiteManager, approveByQc, approveByStorekeeper
  // ─────────────────────────────────────────────────────────────────────────
  describe('approveBySiteManager', () => {
    it('should set siteManagerApproval to true', async () => {
      const scrap = { id: 'scrap-1', status: 'reported' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, siteManagerApproval: true });

      const result = await approveBySiteManager('scrap-1', 'user-1');

      expect(result.siteManagerApproval).toBe(true);
      const updateData = mockPrisma.scrapItem.update.mock.calls[0][0].data;
      expect(updateData.siteManagerApproval).toBe(true);
    });

    it('should throw BusinessRuleError when not in reported status', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue({ id: 'scrap-1', status: 'identified' });

      await expect(approveBySiteManager('scrap-1', 'user-1')).rejects.toThrow(
        'Scrap item must be in "reported" status for site manager approval',
      );
    });
  });

  describe('approveByQc', () => {
    it('should set qcApproval to true', async () => {
      const scrap = { id: 'scrap-1', status: 'reported' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, qcApproval: true });

      const result = await approveByQc('scrap-1', 'user-1');

      expect(result.qcApproval).toBe(true);
    });

    it('should throw BusinessRuleError when not in reported status', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue({ id: 'scrap-1', status: 'approved' });

      await expect(approveByQc('scrap-1', 'user-1')).rejects.toThrow(
        'Scrap item must be in "reported" status for QC approval',
      );
    });
  });

  describe('approveByStorekeeper', () => {
    it('should set storekeeperApproval to true', async () => {
      const scrap = { id: 'scrap-1', status: 'reported' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, storekeeperApproval: true });

      const result = await approveByStorekeeper('scrap-1', 'user-1');

      expect(result.storekeeperApproval).toBe(true);
    });

    it('should throw BusinessRuleError when not in reported status', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue({ id: 'scrap-1', status: 'identified' });

      await expect(approveByStorekeeper('scrap-1', 'user-1')).rejects.toThrow(
        'Scrap item must be in "reported" status for storekeeper approval',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approve -- requires ALL three approvals
  // ─────────────────────────────────────────────────────────────────────────
  describe('approve', () => {
    it('should approve when all three approvals are present', async () => {
      const scrap = {
        id: 'scrap-1',
        status: 'reported',
        siteManagerApproval: true,
        qcApproval: true,
        storekeeperApproval: true,
      };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, status: 'approved' });

      const result = await approve('scrap-1');

      expect(result.status).toBe('approved');
    });

    it('should throw when site manager approval is missing', async () => {
      const scrap = {
        id: 'scrap-1',
        status: 'reported',
        siteManagerApproval: false,
        qcApproval: true,
        storekeeperApproval: true,
      };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(approve('scrap-1')).rejects.toThrow('Site Manager approval is required before final approval');
    });

    it('should throw when QC approval is missing', async () => {
      const scrap = {
        id: 'scrap-1',
        status: 'reported',
        siteManagerApproval: true,
        qcApproval: false,
        storekeeperApproval: true,
      };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(approve('scrap-1')).rejects.toThrow('QC approval is required before final approval');
    });

    it('should throw when storekeeper approval is missing', async () => {
      const scrap = {
        id: 'scrap-1',
        status: 'reported',
        siteManagerApproval: true,
        qcApproval: true,
        storekeeperApproval: false,
      };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(approve('scrap-1')).rejects.toThrow('Storekeeper approval is required before final approval');
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(approve('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendToSsc (approved -> in_ssc)
  // ─────────────────────────────────────────────────────────────────────────
  describe('sendToSsc', () => {
    it('should transition to in_ssc', async () => {
      const scrap = { id: 'scrap-1', status: 'approved' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, status: 'in_ssc' });

      const result = await sendToSsc('scrap-1');

      expect(result.status).toBe('in_ssc');
      expect(mockedAssertTransition).toHaveBeenCalledWith('scrap', 'approved', 'in_ssc');
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(sendToSsc('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // markSold -- sets 10-day deadline
  // ─────────────────────────────────────────────────────────────────────────
  describe('markSold', () => {
    it('should set status to sold with buyer name and 10-day deadline', async () => {
      const scrap = { id: 'scrap-1', status: 'in_ssc' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, status: 'sold', buyerName: 'Buyer Co.' });

      const result = await markSold('scrap-1', 'Buyer Co.');

      expect(result.status).toBe('sold');
      const updateData = mockPrisma.scrapItem.update.mock.calls[0][0].data;
      expect(updateData.buyerName).toBe('Buyer Co.');
      expect(updateData.buyerPickupDeadline).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(markSold('nonexistent', 'Buyer')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // dispose
  // ─────────────────────────────────────────────────────────────────────────
  describe('dispose', () => {
    it('should transition to disposed', async () => {
      const scrap = { id: 'scrap-1', status: 'in_ssc' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, status: 'disposed' });

      const result = await dispose('scrap-1');

      expect(result.status).toBe('disposed');
      expect(mockedAssertTransition).toHaveBeenCalledWith('scrap', 'in_ssc', 'disposed');
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(dispose('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // close
  // ─────────────────────────────────────────────────────────────────────────
  describe('close', () => {
    it('should transition to closed', async () => {
      const scrap = { id: 'scrap-1', status: 'sold' };
      mockPrisma.scrapItem.findUnique.mockResolvedValue(scrap);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.scrapItem.update.mockResolvedValue({ ...scrap, status: 'closed' });

      const result = await close('scrap-1');

      expect(result.status).toBe('closed');
      expect(mockedAssertTransition).toHaveBeenCalledWith('scrap', 'sold', 'closed');
    });

    it('should throw NotFoundError when scrap not found', async () => {
      mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

      await expect(close('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
