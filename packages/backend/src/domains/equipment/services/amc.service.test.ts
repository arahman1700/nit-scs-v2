import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../notifications/services/notification.service.js', () => ({ createNotification: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { list, getById, create, update, activate, terminate, checkExpiringContracts } from './amc.service.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { eventBus } from '../../../events/event-bus.js';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const AMC_ID = 'amc-1';

function makeAmc(overrides: Record<string, unknown> = {}) {
  return {
    id: AMC_ID,
    contractNumber: 'AMC-001',
    supplierId: 'sup-1',
    equipmentTypeId: 'et-1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    contractValue: 50000,
    coverageType: 'full',
    responseTimeSlaHours: 24,
    preventiveMaintenanceFrequency: 'quarterly',
    includesSpares: false,
    maxCallouts: null,
    notes: null,
    status: 'draft',
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const baseListParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 20 };

// ── setup ────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mockPrisma, createPrismaMock());
});

describe('amc.service', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('should return data and total', async () => {
      const rows = [makeAmc()];
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue(rows);
      mockPrisma.annualMaintenanceContract.count.mockResolvedValue(1);

      const result = await list(baseListParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause on contractNumber, supplier name, and notes', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([]);
      mockPrisma.annualMaintenanceContract.count.mockResolvedValue(0);

      await list({ ...baseListParams, search: 'AMC' });

      const where = mockPrisma.annualMaintenanceContract.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
      expect(where.OR[0]).toEqual({
        contractNumber: { contains: 'AMC', mode: 'insensitive' },
      });
    });

    it('should apply status filter', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([]);
      mockPrisma.annualMaintenanceContract.count.mockResolvedValue(0);

      await list({ ...baseListParams, status: 'active' });

      const where = mockPrisma.annualMaintenanceContract.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('active');
    });

    it('should apply supplierId filter', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([]);
      mockPrisma.annualMaintenanceContract.count.mockResolvedValue(0);

      await list({ ...baseListParams, supplierId: 'sup-1' });

      const where = mockPrisma.annualMaintenanceContract.findMany.mock.calls[0][0].where;
      expect(where.supplierId).toBe('sup-1');
    });

    it('should apply equipmentTypeId filter', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([]);
      mockPrisma.annualMaintenanceContract.count.mockResolvedValue(0);

      await list({ ...baseListParams, equipmentTypeId: 'et-1' });

      const where = mockPrisma.annualMaintenanceContract.findMany.mock.calls[0][0].where;
      expect(where.equipmentTypeId).toBe('et-1');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([]);
      mockPrisma.annualMaintenanceContract.count.mockResolvedValue(0);

      await list({ ...baseListParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.annualMaintenanceContract.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the AMC when found', async () => {
      const amc = makeAmc();
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(amc);

      const result = await getById(AMC_ID);

      expect(result).toEqual(amc);
      expect(mockPrisma.annualMaintenanceContract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: AMC_ID } }),
      );
    });

    it('should throw NotFoundError when AMC not found', async () => {
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const data = {
      supplierId: 'sup-1',
      equipmentTypeId: 'et-1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      contractValue: 50000,
      coverageType: 'full',
      responseTimeSlaHours: 24,
      preventiveMaintenanceFrequency: 'quarterly',
    };

    it('should generate contract number via generateDocumentNumber', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AMC-001');
      mockPrisma.annualMaintenanceContract.create.mockResolvedValue(makeAmc());

      await create(data as any, USER_ID);

      expect(generateDocumentNumber).toHaveBeenCalledWith('amc');
    });

    it('should set status to draft and use generated contractNumber', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AMC-002');
      mockPrisma.annualMaintenanceContract.create.mockResolvedValue(makeAmc({ contractNumber: 'AMC-002' }));

      await create(data as any, USER_ID);

      const createArgs = mockPrisma.annualMaintenanceContract.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
      expect(createArgs.data.contractNumber).toBe('AMC-002');
    });

    it('should throw BusinessRuleError when end date is before start date', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AMC-003');

      const badData = { ...data, startDate: '2026-12-31', endDate: '2026-01-01' };

      await expect(create(badData as any, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when end date equals start date', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AMC-004');

      const badData = { ...data, startDate: '2026-06-15', endDate: '2026-06-15' };

      await expect(create(badData as any, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should publish document:created event', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AMC-005');
      mockPrisma.annualMaintenanceContract.create.mockResolvedValue(makeAmc({ id: 'amc-new' }));

      await create(data as any, USER_ID);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:created',
          entityType: 'amc',
          action: 'create',
          performedById: USER_ID,
        }),
      );
    });

    it('should handle optional fields with defaults', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AMC-006');
      mockPrisma.annualMaintenanceContract.create.mockResolvedValue(makeAmc());

      await create(data as any, USER_ID);

      const createArgs = mockPrisma.annualMaintenanceContract.create.mock.calls[0][0];
      expect(createArgs.data.includesSpares).toBe(false);
      expect(createArgs.data.maxCallouts).toBeNull();
      expect(createArgs.data.notes).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a draft contract', async () => {
      const existing = makeAmc({ status: 'draft' });
      const updated = makeAmc({ status: 'draft', notes: 'Updated notes' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(existing);
      mockPrisma.annualMaintenanceContract.update.mockResolvedValue(updated);

      const result = await update(AMC_ID, { notes: 'Updated notes' } as any);

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when AMC not found', async () => {
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when AMC is not in draft status', async () => {
      const existing = makeAmc({ status: 'active' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(existing);

      await expect(update(AMC_ID, { notes: 'Updated' } as any)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when updated dates are invalid', async () => {
      const existing = makeAmc({ status: 'draft' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(existing);

      await expect(update(AMC_ID, { startDate: '2027-01-01', endDate: '2026-01-01' } as any)).rejects.toThrow(
        BusinessRuleError,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // activate
  // ─────────────────────────────────────────────────────────────────────────
  describe('activate', () => {
    it('should activate a draft contract', async () => {
      const record = makeAmc({ status: 'draft' });
      const activated = makeAmc({ status: 'active' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);
      mockPrisma.annualMaintenanceContract.update.mockResolvedValue(activated);

      const result = await activate(AMC_ID, USER_ID);

      expect(result.status).toBe('active');
      expect(mockPrisma.annualMaintenanceContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AMC_ID },
          data: { status: 'active' },
        }),
      );
    });

    it('should throw NotFoundError when AMC not found', async () => {
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(null);

      await expect(activate('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when AMC is not in draft status', async () => {
      const record = makeAmc({ status: 'active' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);

      await expect(activate(AMC_ID, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should publish status_changed event on activation', async () => {
      const record = makeAmc({ status: 'draft' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);
      mockPrisma.annualMaintenanceContract.update.mockResolvedValue(makeAmc({ status: 'active' }));

      await activate(AMC_ID, USER_ID);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          entityType: 'amc',
          payload: expect.objectContaining({ from: 'draft', to: 'active' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // terminate
  // ─────────────────────────────────────────────────────────────────────────
  describe('terminate', () => {
    it('should terminate an active contract', async () => {
      const record = makeAmc({ status: 'active' });
      const terminated = makeAmc({ status: 'terminated', terminationReason: 'Budget cut' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);
      mockPrisma.annualMaintenanceContract.update.mockResolvedValue(terminated);

      const result = await terminate(AMC_ID, USER_ID, 'Budget cut');

      expect(result.status).toBe('terminated');
    });

    it('should throw NotFoundError when AMC not found', async () => {
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(null);

      await expect(terminate('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when AMC is not active', async () => {
      const record = makeAmc({ status: 'draft' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);

      await expect(terminate(AMC_ID, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should set terminationReason to null when not provided', async () => {
      const record = makeAmc({ status: 'active' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);
      mockPrisma.annualMaintenanceContract.update.mockResolvedValue(makeAmc({ status: 'terminated' }));

      await terminate(AMC_ID, USER_ID);

      const updateArgs = mockPrisma.annualMaintenanceContract.update.mock.calls[0][0];
      expect(updateArgs.data.terminationReason).toBeNull();
    });

    it('should publish status_changed event on termination', async () => {
      const record = makeAmc({ status: 'active' });
      mockPrisma.annualMaintenanceContract.findUnique.mockResolvedValue(record);
      mockPrisma.annualMaintenanceContract.update.mockResolvedValue(makeAmc({ status: 'terminated' }));

      await terminate(AMC_ID, USER_ID, 'Vendor issue');

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          payload: expect.objectContaining({ from: 'active', to: 'terminated', reason: 'Vendor issue' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkExpiringContracts
  // ─────────────────────────────────────────────────────────────────────────
  describe('checkExpiringContracts', () => {
    it('should return early when no contracts are expiring', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([]);

      await checkExpiringContracts();

      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('should return early when no recipients found', async () => {
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([
        {
          id: 'amc-exp',
          contractNumber: 'AMC-EXP-001',
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          supplier: { supplierName: 'Vendor A' },
          equipmentType: { typeName: 'Crane' },
        },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await checkExpiringContracts();

      expect(createNotification).not.toHaveBeenCalled();
    });

    it('should create notifications for expiring contracts', async () => {
      const expiringContract = {
        id: 'amc-exp-1',
        contractNumber: 'AMC-EXP-001',
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        supplier: { supplierName: 'Vendor A' },
        equipmentType: { typeName: 'Crane' },
      };
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([expiringContract]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'mgr-1' }, { id: 'mgr-2' }]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await checkExpiringContracts();

      expect(createNotification).toHaveBeenCalledTimes(2);
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'mgr-1',
          title: 'AMC Expiring Soon',
          notificationType: 'amc_expiring',
          referenceId: 'amc-exp-1',
        }),
      );
    });

    it('should skip contracts that were already notified recently', async () => {
      const expiringContract = {
        id: 'amc-exp-1',
        contractNumber: 'AMC-EXP-001',
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        supplier: { supplierName: 'Vendor A' },
        equipmentType: { typeName: 'Crane' },
      };
      mockPrisma.annualMaintenanceContract.findMany.mockResolvedValue([expiringContract]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'mgr-1' }]);
      mockPrisma.notification.findMany.mockResolvedValue([{ referenceId: 'amc-exp-1' }]);

      await checkExpiringContracts();

      expect(createNotification).not.toHaveBeenCalled();
    });
  });
});
