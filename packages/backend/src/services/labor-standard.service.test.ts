import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { listStandards, upsertStandard, getPerformanceReport } from './labor-standard.service.js';

describe('labor-standard.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // listStandards
  // ---------------------------------------------------------------------------
  describe('listStandards', () => {
    it('should call prisma.laborStandard.findMany with orderBy taskType asc', async () => {
      const standards = [
        { id: '1', taskType: 'cycle_count', standardMinutes: 15, unitOfMeasure: 'count' },
        { id: '2', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      ];
      mockPrisma.laborStandard.findMany.mockResolvedValue(standards);

      const result = await listStandards();

      expect(mockPrisma.laborStandard.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.laborStandard.findMany).toHaveBeenCalledWith({
        orderBy: { taskType: 'asc' },
      });
      expect(result).toEqual(standards);
    });

    it('should return an empty array when no standards exist', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);

      const result = await listStandards();

      expect(result).toEqual([]);
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.laborStandard.findMany.mockRejectedValue(new Error('DB error'));

      await expect(listStandards()).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // upsertStandard
  // ---------------------------------------------------------------------------
  describe('upsertStandard', () => {
    it('should call upsert with correct where clause on taskType', async () => {
      const upserted = { id: '1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' };
      mockPrisma.laborStandard.upsert.mockResolvedValue(upserted);

      await upsertStandard('grn_receive', 20);

      expect(mockPrisma.laborStandard.upsert).toHaveBeenCalledOnce();
      expect(mockPrisma.laborStandard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taskType: 'grn_receive' } }),
      );
    });

    it('should default unitOfMeasure to "document" in create when not provided', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('grn_receive', 20);

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.create).toEqual({
        taskType: 'grn_receive',
        standardMinutes: 20,
        description: undefined,
        unitOfMeasure: 'document',
      });
    });

    it('should use provided unitOfMeasure in create when given', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('cycle_count', 15, 'Count items', 'count');

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.create).toEqual({
        taskType: 'cycle_count',
        standardMinutes: 15,
        description: 'Count items',
        unitOfMeasure: 'count',
      });
    });

    it('should include description in create when provided', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('putaway', 10, 'Store items in warehouse');

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.create.description).toBe('Store items in warehouse');
      expect(callArgs.create.unitOfMeasure).toBe('document');
    });

    it('should only include standardMinutes in update when description and unitOfMeasure are undefined', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('grn_receive', 25);

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.update).toEqual({ standardMinutes: 25 });
      expect(callArgs.update).not.toHaveProperty('description');
      expect(callArgs.update).not.toHaveProperty('unitOfMeasure');
    });

    it('should include description in update when it is provided', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('grn_receive', 25, 'Receive goods');

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.update).toEqual({
        standardMinutes: 25,
        description: 'Receive goods',
      });
    });

    it('should include unitOfMeasure in update when it is provided', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('cycle_count', 15, undefined, 'count');

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.update).toEqual({
        standardMinutes: 15,
        unitOfMeasure: 'count',
      });
      expect(callArgs.update).not.toHaveProperty('description');
    });

    it('should include both description and unitOfMeasure in update when both are provided', async () => {
      mockPrisma.laborStandard.upsert.mockResolvedValue({ id: '1' });

      await upsertStandard('picking', 12, 'Pick items', 'order');

      const callArgs = mockPrisma.laborStandard.upsert.mock.calls[0][0];
      expect(callArgs.update).toEqual({
        standardMinutes: 12,
        description: 'Pick items',
        unitOfMeasure: 'order',
      });
    });

    it('should return the upserted record', async () => {
      const upserted = { id: '1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' };
      mockPrisma.laborStandard.upsert.mockResolvedValue(upserted);

      const result = await upsertStandard('grn_receive', 20);

      expect(result).toBe(upserted);
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.laborStandard.upsert.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(upsertStandard('grn_receive', 20)).rejects.toThrow('Unique constraint failed');
    });
  });

  // ---------------------------------------------------------------------------
  // getPerformanceReport
  // ---------------------------------------------------------------------------
  describe('getPerformanceReport', () => {
    const standardsList = [
      { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      { id: 's2', taskType: 'mi_issue', standardMinutes: 15, unitOfMeasure: 'document' },
      { id: 's3', taskType: 'putaway', standardMinutes: 10, unitOfMeasure: 'document' },
    ];

    it('should return empty workers when no audit logs exist', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue(standardsList);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await getPerformanceReport();

      expect(result.workers).toEqual([]);
      expect(result.standards).toEqual([
        { taskType: 'grn_receive', standardMinutes: 20, unit: 'document' },
        { taskType: 'mi_issue', standardMinutes: 15, unit: 'document' },
        { taskType: 'putaway', standardMinutes: 10, unit: 'document' },
      ]);
    });

    it('should use default days=30 when not specified', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await getPerformanceReport();

      expect(result.period.days).toBe(30);

      // Since is 30 days before 2026-02-15T12:00:00.000Z = 2026-01-16T12:00:00.000Z
      const expectedSince = new Date('2026-02-15T12:00:00.000Z');
      expectedSince.setDate(expectedSince.getDate() - 30);
      expect(result.period.since).toBe(expectedSince.toISOString());
    });

    it('should use custom days parameter when specified', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await getPerformanceReport(7);

      expect(result.period.days).toBe(7);

      const expectedSince = new Date('2026-02-15T12:00:00.000Z');
      expectedSince.setDate(expectedSince.getDate() - 7);
      expect(result.period.since).toBe(expectedSince.toISOString());
    });

    it('should query audit logs with correct date filter and action list', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await getPerformanceReport(30);

      const expectedSince = new Date('2026-02-15T12:00:00.000Z');
      expectedSince.setDate(expectedSince.getDate() - 30);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledOnce();
      const callArgs = mockPrisma.auditLog.findMany.mock.calls[0][0];

      expect(callArgs.where.performedAt).toEqual({ gte: expectedSince });
      expect(callArgs.where.action.in).toEqual(
        expect.arrayContaining([
          'mrrv.create',
          'mrrv.submit',
          'mirv.create',
          'mirv.submit',
          'stockTransfer.create',
          'stockTransfer.submit',
          'rfim.create',
          'rfim.complete',
          'inventoryLot.create',
          'mirv.issue',
          'packingSession.complete',
          'cycleCount.complete',
        ]),
      );
      expect(callArgs.select).toEqual({
        performedById: true,
        action: true,
        performedAt: true,
      });
    });

    it('should filter out audit log entries with null performedById', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue(standardsList);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: null, action: 'mrrv.create', performedAt: new Date() },
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'John Doe' }]);

      const result = await getPerformanceReport();

      // Only user-1 should appear; the null entry is filtered
      expect(result.workers).toHaveLength(1);
      expect(result.workers[0]).toMatchObject({ employeeId: 'user-1' });

      // Employee lookup should only include user-1
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1'] } },
        select: { id: true, fullName: true },
      });
    });

    it('should correctly compute efficiency for a single worker', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      ]);

      // Worker performed 10 grn_receive actions (mrrv.create)
      const auditLogs = Array.from({ length: 10 }, () => ({
        performedById: 'user-1',
        action: 'mrrv.create',
        performedAt: new Date(),
      }));
      mockPrisma.auditLog.findMany.mockResolvedValue(auditLogs);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Alice Smith' }]);

      const result = await getPerformanceReport(30);

      expect(result.workers).toHaveLength(1);
      const worker = result.workers[0];

      // 10 grn_receive tasks * 20 standardMinutes = 200 totalStandardMinutes
      // actualMinutesWorked = 30 days * 8 hours * 60 min = 14400
      // efficiency = (200 / 14400) * 100 = 1.3888... rounded to 1.4
      expect(worker.employeeId).toBe('user-1');
      expect(worker.employeeName).toBe('Alice Smith');
      expect(worker.totalTasks).toBe(10);
      expect(worker.totalStandardMinutes).toBe(200);
      expect(worker.efficiency).toBe(1.4);
      expect(worker.taskBreakdown).toEqual([{ taskType: 'grn_receive', count: 10, standardMinutes: 200 }]);
    });

    it('should compute 0 standard minutes for tasks without a standard definition', async () => {
      // No standards defined
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);

      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Bob Jones' }]);

      const result = await getPerformanceReport(30);

      expect(result.workers).toHaveLength(1);
      const worker = result.workers[0];
      expect(worker.totalStandardMinutes).toBe(0);
      expect(worker.efficiency).toBe(0);
      expect(worker.taskBreakdown).toEqual([{ taskType: 'grn_receive', count: 1, standardMinutes: 0 }]);
    });

    it('should sort workers by efficiency in descending order', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      ]);

      // Worker A: 5 tasks, Worker B: 15 tasks, Worker C: 10 tasks
      const auditLogs = [
        ...Array.from({ length: 5 }, () => ({
          performedById: 'worker-a',
          action: 'mrrv.create',
          performedAt: new Date(),
        })),
        ...Array.from({ length: 15 }, () => ({
          performedById: 'worker-b',
          action: 'mrrv.create',
          performedAt: new Date(),
        })),
        ...Array.from({ length: 10 }, () => ({
          performedById: 'worker-c',
          action: 'mrrv.create',
          performedAt: new Date(),
        })),
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(auditLogs);
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'worker-a', fullName: 'Worker A' },
        { id: 'worker-b', fullName: 'Worker B' },
        { id: 'worker-c', fullName: 'Worker C' },
      ]);

      const result = await getPerformanceReport(30);

      expect(result.workers).toHaveLength(3);
      // B (15 tasks) > C (10 tasks) > A (5 tasks)
      expect(result.workers[0].employeeId).toBe('worker-b');
      expect(result.workers[1].employeeId).toBe('worker-c');
      expect(result.workers[2].employeeId).toBe('worker-a');

      // Verify descending efficiency
      expect(result.workers[0].efficiency).toBeGreaterThan(result.workers[1].efficiency);
      expect(result.workers[1].efficiency).toBeGreaterThan(result.workers[2].efficiency);
    });

    it('should handle multiple task types per worker', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
        { id: 's2', taskType: 'mi_issue', standardMinutes: 15, unitOfMeasure: 'document' },
        { id: 's3', taskType: 'putaway', standardMinutes: 10, unitOfMeasure: 'document' },
      ]);

      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
        { performedById: 'user-1', action: 'mrrv.submit', performedAt: new Date() },
        { performedById: 'user-1', action: 'mirv.create', performedAt: new Date() },
        { performedById: 'user-1', action: 'inventoryLot.create', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Charlie Brown' }]);

      const result = await getPerformanceReport(30);

      expect(result.workers).toHaveLength(1);
      const worker = result.workers[0];

      // 2 grn_receive (mrrv.create + mrrv.submit) * 20 = 40
      // 1 mi_issue (mirv.create) * 15 = 15
      // 1 putaway (inventoryLot.create) * 10 = 10
      // total = 65
      expect(worker.totalTasks).toBe(4);
      expect(worker.totalStandardMinutes).toBe(65);

      // Verify task breakdown contains all three task types
      const grn = worker.taskBreakdown.find(t => t.taskType === 'grn_receive');
      const mi = worker.taskBreakdown.find(t => t.taskType === 'mi_issue');
      const putaway = worker.taskBreakdown.find(t => t.taskType === 'putaway');
      expect(grn).toEqual({ taskType: 'grn_receive', count: 2, standardMinutes: 40 });
      expect(mi).toEqual({ taskType: 'mi_issue', count: 1, standardMinutes: 15 });
      expect(putaway).toEqual({ taskType: 'putaway', count: 1, standardMinutes: 10 });
    });

    it('should return standards mapped with taskType, standardMinutes, and unit', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        {
          id: 's1',
          taskType: 'grn_receive',
          standardMinutes: 20,
          unitOfMeasure: 'document',
          description: 'Receive goods',
        },
        { id: 's2', taskType: 'picking', standardMinutes: 8, unitOfMeasure: 'order', description: 'Pick orders' },
      ]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const result = await getPerformanceReport();

      expect(result.standards).toEqual([
        { taskType: 'grn_receive', standardMinutes: 20, unit: 'document' },
        { taskType: 'picking', standardMinutes: 8, unit: 'order' },
      ]);
    });

    it('should not include workers whose employee record was not found', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      ]);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
        { performedById: 'user-2', action: 'mrrv.create', performedAt: new Date() },
      ]);
      // Only return user-1 from employee lookup; user-2 is missing
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Alice' }]);

      const result = await getPerformanceReport();

      // user-2 has audit logs but no employee record, so data lookup returns undefined
      // which means it returns null from the map and gets filtered by .filter(Boolean)
      expect(result.workers).toHaveLength(1);
      expect(result.workers[0].employeeId).toBe('user-1');
    });

    it('should handle custom days parameter for efficiency calculation', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      ]);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Diana Prince' }]);

      const result = await getPerformanceReport(7);

      // 1 task * 20 min = 20 totalStandardMinutes
      // actualMinutesWorked = 7 * 8 * 60 = 3360
      // efficiency = (20 / 3360) * 100 = 0.5952... rounded to 0.6
      expect(result.workers[0].efficiency).toBe(0.6);
      expect(result.period.days).toBe(7);
    });

    it('should query employees with the correct worker IDs from audit logs', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-a', action: 'mrrv.create', performedAt: new Date() },
        { performedById: 'user-b', action: 'mirv.create', performedAt: new Date() },
        { performedById: 'user-a', action: 'mrrv.submit', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'user-a', fullName: 'User A' },
        { id: 'user-b', fullName: 'User B' },
      ]);

      await getPerformanceReport();

      expect(mockPrisma.employee.findMany).toHaveBeenCalledOnce();
      const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
      expect(callArgs.where.id.in).toEqual(expect.arrayContaining(['user-a', 'user-b']));
      expect(callArgs.where.id.in).toHaveLength(2);
      expect(callArgs.select).toEqual({ id: true, fullName: true });
    });

    it('should propagate prisma errors from laborStandard.findMany', async () => {
      mockPrisma.laborStandard.findMany.mockRejectedValue(new Error('Standards DB error'));

      await expect(getPerformanceReport()).rejects.toThrow('Standards DB error');
    });

    it('should propagate prisma errors from auditLog.findMany', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('Audit DB error'));

      await expect(getPerformanceReport()).rejects.toThrow('Audit DB error');
    });

    it('should propagate prisma errors from employee.findMany', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockRejectedValue(new Error('Employee DB error'));

      await expect(getPerformanceReport()).rejects.toThrow('Employee DB error');
    });

    it('should round efficiency to one decimal place', async () => {
      mockPrisma.laborStandard.findMany.mockResolvedValue([
        { id: 's1', taskType: 'grn_receive', standardMinutes: 20, unitOfMeasure: 'document' },
      ]);

      // 3 tasks * 20 = 60 standard minutes
      // 30 * 8 * 60 = 14400 actual minutes
      // efficiency = (60/14400)*100 = 0.41666... should round to 0.4
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
        { performedById: 'user-1', action: 'mrrv.create', performedAt: new Date() },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Eve' }]);

      const result = await getPerformanceReport(30);

      expect(result.workers[0].efficiency).toBe(0.4);
    });
  });
});
