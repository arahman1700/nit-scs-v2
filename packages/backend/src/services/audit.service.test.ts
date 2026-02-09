import type { PrismaMock } from '../test-utils/prisma-mock.js';

const MockJsonNull = vi.hoisted(() => Symbol('JsonNull'));

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('@prisma/client', () => ({
  Prisma: {
    JsonNull: MockJsonNull,
    InputJsonValue: null,
  },
}));

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { createAuditLog, getAuditLogs, type AuditEntry } from './audit.service.js';

describe('audit.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
  });

  // ---------------------------------------------------------------------------
  // createAuditLog
  // ---------------------------------------------------------------------------
  describe('createAuditLog', () => {
    const baseEntry: AuditEntry = {
      tableName: 'mrrv',
      recordId: 'rec-001',
      action: 'create',
      changedFields: { status: 'draft' },
      oldValues: { status: 'pending' },
      newValues: { status: 'draft' },
      performedById: 'user-001',
      ipAddress: '192.168.1.1',
    };

    it('should call prisma.auditLog.create with correctly mapped data', async () => {
      const created = { id: 'audit-1', ...baseEntry };
      mockPrisma.auditLog.create.mockResolvedValue(created);

      await createAuditLog(baseEntry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tableName: 'mrrv',
          recordId: 'rec-001',
          action: 'create',
          changedFields: { status: 'draft' },
          oldValues: { status: 'pending' },
          newValues: { status: 'draft' },
          performedById: 'user-001',
          ipAddress: '192.168.1.1',
        },
      });
    });

    it('should return the created record', async () => {
      const created = { id: 'audit-2', tableName: 'mrrv', recordId: 'rec-002' };
      mockPrisma.auditLog.create.mockResolvedValue(created);

      const result = await createAuditLog(baseEntry);

      expect(result).toBe(created);
    });

    it('should use Prisma.JsonNull when changedFields is undefined', async () => {
      const entry: AuditEntry = {
        tableName: 'mirv',
        recordId: 'rec-003',
        action: 'delete',
        performedById: 'user-002',
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-3' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.changedFields).toBe(MockJsonNull);
    });

    it('should use Prisma.JsonNull when oldValues is undefined', async () => {
      const entry: AuditEntry = {
        tableName: 'mirv',
        recordId: 'rec-003',
        action: 'create',
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-4' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.oldValues).toBe(MockJsonNull);
    });

    it('should use Prisma.JsonNull when newValues is undefined', async () => {
      const entry: AuditEntry = {
        tableName: 'mirv',
        recordId: 'rec-003',
        action: 'delete',
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-5' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.newValues).toBe(MockJsonNull);
    });

    it('should use provided JSON values when changedFields is defined', async () => {
      const fields = { name: 'updated' };
      const entry: AuditEntry = {
        tableName: 'item',
        recordId: 'rec-004',
        action: 'update',
        changedFields: fields,
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-6' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.changedFields).toEqual(fields);
    });

    it('should pass performedById as undefined when not provided', async () => {
      const entry: AuditEntry = {
        tableName: 'mrrv',
        recordId: 'rec-005',
        action: 'create',
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-7' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.performedById).toBeUndefined();
    });

    it('should pass ipAddress as undefined when not provided', async () => {
      const entry: AuditEntry = {
        tableName: 'mrrv',
        recordId: 'rec-006',
        action: 'update',
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-8' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.ipAddress).toBeUndefined();
    });

    it('should pass ipAddress when provided', async () => {
      const entry: AuditEntry = {
        tableName: 'mrrv',
        recordId: 'rec-007',
        action: 'update',
        ipAddress: '10.0.0.1',
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-9' });

      await createAuditLog(entry);

      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.ipAddress).toBe('10.0.0.1');
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(createAuditLog(baseEntry)).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // getAuditLogs
  // ---------------------------------------------------------------------------
  describe('getAuditLogs', () => {
    it('should build where clause with all filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({
        tableName: 'mrrv',
        recordId: 'rec-001',
        action: 'create',
        performedById: 'user-001',
        page: 1,
        pageSize: 10,
      });

      const expectedWhere = {
        tableName: 'mrrv',
        recordId: 'rec-001',
        action: 'create',
        performedById: 'user-001',
      };

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('should build empty where clause when no filters provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({ page: 1, pageSize: 20 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should build where with partial filters (tableName only)', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({ tableName: 'mirv', page: 1, pageSize: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tableName: 'mirv' } }),
      );
    });

    it('should apply pagination correctly for page 1', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({ page: 1, pageSize: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });

    it('should apply pagination correctly for page 3', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({ page: 3, pageSize: 15 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 15 }));
    });

    it('should order by performedAt desc', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({ page: 1, pageSize: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { performedAt: 'desc' } }),
      );
    });

    it('should include performedBy with select fullName and email', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await getAuditLogs({ page: 1, pageSize: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { performedBy: { select: { fullName: true, email: true } } },
        }),
      );
    });

    it('should return { data, total }', async () => {
      const logs = [{ id: 'log-1' }, { id: 'log-2' }];
      mockPrisma.auditLog.findMany.mockResolvedValue(logs);
      mockPrisma.auditLog.count.mockResolvedValue(42);

      const result = await getAuditLogs({ page: 1, pageSize: 10 });

      expect(result).toEqual({ data: logs, total: 42 });
    });
  });
});
