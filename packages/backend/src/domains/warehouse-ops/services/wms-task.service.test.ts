import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  createTask,
  getTaskById,
  getTasks,
  assignTask,
  startTask,
  completeTask,
  cancelTask,
  holdTask,
  resumeTask,
  getMyTasks,
  getStats,
  bulkAssign,
} from './wms-task.service.js';

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WH_ID = 'wh-001';
const EMP_ID = 'emp-001';

function makeTaskRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-001',
    taskNumber: 'TSK-0001',
    warehouseId: WH_ID,
    taskType: 'pick',
    priority: 3,
    status: 'pending',
    assignedToId: null,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    sourceDocType: null,
    sourceDocId: null,
    fromZoneId: null,
    fromBinId: null,
    toZoneId: null,
    toBinId: null,
    itemId: 'item-001',
    lpnId: null,
    quantity: 10,
    estimatedMins: 15,
    actualMins: null,
    notes: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-01T10:00:00Z'),
    warehouse: { id: WH_ID, warehouseName: 'Main WH', warehouseCode: 'WH-01' },
    assignedTo: null,
    item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
    fromZone: null,
    toZone: null,
    fromBin: null,
    toBin: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('wms-task.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).wmsTask = createModelMock();
  });

  const wmsTask = () => (mockPrisma as unknown as { wmsTask: PrismaModelMock }).wmsTask;

  // ########################################################################
  // createTask
  // ########################################################################

  describe('createTask', () => {
    it('should create a task with given data', async () => {
      const input = {
        taskNumber: 'TSK-0001',
        warehouseId: WH_ID,
        taskType: 'pick',
        priority: 3,
        itemId: 'item-001',
        quantity: 10,
      };
      const created = makeTaskRecord();
      wmsTask().create.mockResolvedValue(created);

      const result = await createTask(input as never);

      expect(wmsTask().create).toHaveBeenCalledWith({
        data: input,
        include: expect.objectContaining({
          warehouse: true,
          assignedTo: expect.any(Object),
          item: true,
        }),
      });
      expect(result).toEqual(created);
    });
  });

  // ########################################################################
  // getTaskById
  // ########################################################################

  describe('getTaskById', () => {
    it('should return the record when found', async () => {
      const record = makeTaskRecord();
      wmsTask().findUnique.mockResolvedValue(record);

      const result = await getTaskById('task-001');

      expect(wmsTask().findUnique).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result).toEqual(record);
    });

    it('should throw NotFoundError when record does not exist', async () => {
      wmsTask().findUnique.mockResolvedValue(null);

      await expect(getTaskById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getTasks
  // ########################################################################

  describe('getTasks', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeTaskRecord()];
      wmsTask().findMany.mockResolvedValue(records);
      wmsTask().count.mockResolvedValue(1);

      const result = await getTasks({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
      expect(wmsTask().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
        }),
      );
    });

    it('should apply all filters', async () => {
      wmsTask().findMany.mockResolvedValue([]);
      wmsTask().count.mockResolvedValue(0);

      await getTasks({
        warehouseId: WH_ID,
        status: 'pending',
        taskType: 'pick',
        assignedToId: EMP_ID,
        priority: 1,
      });

      expect(wmsTask().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: WH_ID,
            status: 'pending',
            taskType: 'pick',
            assignedToId: EMP_ID,
            priority: 1,
          }),
        }),
      );
    });

    it('should handle custom page and pageSize', async () => {
      wmsTask().findMany.mockResolvedValue([]);
      wmsTask().count.mockResolvedValue(50);

      const result = await getTasks({ page: 3, pageSize: 10 });

      expect(wmsTask().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });
  });

  // ########################################################################
  // assignTask
  // ########################################################################

  describe('assignTask', () => {
    it('should assign a pending task to an employee', async () => {
      const record = makeTaskRecord({ status: 'pending' });
      const assigned = makeTaskRecord({
        status: 'assigned',
        assignedToId: EMP_ID,
        assignedAt: new Date(),
      });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(assigned);

      const result = await assignTask('task-001', EMP_ID);

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: expect.objectContaining({
          status: 'assigned',
          assignedToId: EMP_ID,
          assignedAt: expect.any(Date),
        }),
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('assigned');
    });

    it('should throw NotFoundError when task does not exist', async () => {
      wmsTask().findUnique.mockResolvedValue(null);
      await expect(assignTask('nonexistent', EMP_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw error when task is not pending', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'in_progress' }));
      await expect(assignTask('task-001', EMP_ID)).rejects.toThrow(
        "Cannot assign task in status 'in_progress'. Must be 'pending'.",
      );
    });
  });

  // ########################################################################
  // startTask
  // ########################################################################

  describe('startTask', () => {
    it('should start an assigned task', async () => {
      const record = makeTaskRecord({ status: 'assigned', assignedToId: EMP_ID });
      const started = makeTaskRecord({ status: 'in_progress', startedAt: new Date() });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(started);

      const result = await startTask('task-001');

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: expect.objectContaining({
          status: 'in_progress',
          startedAt: expect.any(Date),
        }),
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('in_progress');
    });

    it('should throw NotFoundError when task does not exist', async () => {
      wmsTask().findUnique.mockResolvedValue(null);
      await expect(startTask('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when task is not assigned', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'pending' }));
      await expect(startTask('task-001')).rejects.toThrow("Cannot start task in status 'pending'. Must be 'assigned'.");
    });
  });

  // ########################################################################
  // completeTask
  // ########################################################################

  describe('completeTask', () => {
    it('should complete an in_progress task and calculate actualMins', async () => {
      const startedAt = new Date('2026-03-01T10:00:00Z');
      const record = makeTaskRecord({ status: 'in_progress', startedAt });
      const completed = makeTaskRecord({
        status: 'completed',
        startedAt,
        completedAt: new Date('2026-03-01T10:30:00Z'),
        actualMins: 30,
      });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(completed);

      const result = await completeTask('task-001');

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
          actualMins: expect.any(Number),
        }),
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('completed');
    });

    it('should complete task without actualMins when startedAt is null', async () => {
      const record = makeTaskRecord({ status: 'in_progress', startedAt: null });
      const completed = makeTaskRecord({ status: 'completed', completedAt: new Date() });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(completed);

      const result = await completeTask('task-001');

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
        },
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('completed');
    });

    it('should throw NotFoundError when task does not exist', async () => {
      wmsTask().findUnique.mockResolvedValue(null);
      await expect(completeTask('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when task is not in_progress', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'assigned' }));
      await expect(completeTask('task-001')).rejects.toThrow(
        "Cannot complete task in status 'assigned'. Must be 'in_progress'.",
      );
    });
  });

  // ########################################################################
  // cancelTask
  // ########################################################################

  describe('cancelTask', () => {
    it('should cancel a pending task', async () => {
      const record = makeTaskRecord({ status: 'pending' });
      const cancelled = makeTaskRecord({ status: 'cancelled' });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(cancelled);

      const result = await cancelTask('task-001');
      expect(result.status).toBe('cancelled');
    });

    it('should cancel an assigned task', async () => {
      const record = makeTaskRecord({ status: 'assigned' });
      const cancelled = makeTaskRecord({ status: 'cancelled' });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(cancelled);

      const result = await cancelTask('task-001');
      expect(result.status).toBe('cancelled');
    });

    it('should cancel an in_progress task', async () => {
      const record = makeTaskRecord({ status: 'in_progress' });
      const cancelled = makeTaskRecord({ status: 'cancelled' });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(cancelled);

      const result = await cancelTask('task-001');

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: { status: 'cancelled' },
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundError when task does not exist', async () => {
      wmsTask().findUnique.mockResolvedValue(null);
      await expect(cancelTask('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when task is already completed', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'completed' }));
      await expect(cancelTask('task-001')).rejects.toThrow("Cannot cancel task in status 'completed'.");
    });

    it('should throw error when task is already cancelled', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'cancelled' }));
      await expect(cancelTask('task-001')).rejects.toThrow("Cannot cancel task in status 'cancelled'.");
    });
  });

  // ########################################################################
  // holdTask
  // ########################################################################

  describe('holdTask', () => {
    it('should put an in_progress task on hold', async () => {
      const record = makeTaskRecord({ status: 'in_progress' });
      const held = makeTaskRecord({ status: 'on_hold' });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(held);

      const result = await holdTask('task-001');

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: { status: 'on_hold' },
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('on_hold');
    });

    it('should throw error when task is not in_progress', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'assigned' }));
      await expect(holdTask('task-001')).rejects.toThrow(
        "Cannot hold task in status 'assigned'. Must be 'in_progress'.",
      );
    });
  });

  // ########################################################################
  // resumeTask
  // ########################################################################

  describe('resumeTask', () => {
    it('should resume an on_hold task to in_progress', async () => {
      const record = makeTaskRecord({ status: 'on_hold' });
      const resumed = makeTaskRecord({ status: 'in_progress' });
      wmsTask().findUnique.mockResolvedValue(record);
      wmsTask().update.mockResolvedValue(resumed);

      const result = await resumeTask('task-001');

      expect(wmsTask().update).toHaveBeenCalledWith({
        where: { id: 'task-001' },
        data: { status: 'in_progress' },
        include: expect.objectContaining({ warehouse: true }),
      });
      expect(result.status).toBe('in_progress');
    });

    it('should throw error when task is not on_hold', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'in_progress' }));
      await expect(resumeTask('task-001')).rejects.toThrow(
        "Cannot resume task in status 'in_progress'. Must be 'on_hold'.",
      );
    });
  });

  // ########################################################################
  // getMyTasks
  // ########################################################################

  describe('getMyTasks', () => {
    it('should return tasks assigned to the employee', async () => {
      const records = [makeTaskRecord({ assignedToId: EMP_ID, status: 'assigned' })];
      wmsTask().findMany.mockResolvedValue(records);

      const result = await getMyTasks(EMP_ID);

      expect(wmsTask().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assignedToId: EMP_ID },
          include: expect.objectContaining({ warehouse: true }),
        }),
      );
      expect(result).toEqual(records);
    });

    it('should filter by status when provided', async () => {
      wmsTask().findMany.mockResolvedValue([]);

      await getMyTasks(EMP_ID, 'in_progress');

      expect(wmsTask().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assignedToId: EMP_ID, status: 'in_progress' },
        }),
      );
    });
  });

  // ########################################################################
  // getStats
  // ########################################################################

  describe('getStats', () => {
    it('should return all zero stats when no records exist', async () => {
      wmsTask().count.mockResolvedValue(0);
      wmsTask().findMany.mockResolvedValue([]);

      const stats = await getStats();

      expect(stats).toEqual({
        pending: 0,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        onHold: 0,
        avgCompletionMins: 0,
      });
    });

    it('should compute correct counts by status', async () => {
      wmsTask()
        .count.mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(3) // assigned
        .mockResolvedValueOnce(2) // in_progress
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(1) // cancelled
        .mockResolvedValueOnce(4); // on_hold
      wmsTask().findMany.mockResolvedValue([]);

      const stats = await getStats();

      expect(stats.pending).toBe(5);
      expect(stats.assigned).toBe(3);
      expect(stats.inProgress).toBe(2);
      expect(stats.completed).toBe(10);
      expect(stats.cancelled).toBe(1);
      expect(stats.onHold).toBe(4);
    });

    it('should calculate avgCompletionMins from completed records', async () => {
      wmsTask().count.mockResolvedValue(1);
      wmsTask().findMany.mockResolvedValue([{ actualMins: 30 }, { actualMins: 60 }]);

      const stats = await getStats();

      // avg = (30 + 60) / 2 = 45.0
      expect(stats.avgCompletionMins).toBe(45);
    });

    it('should filter by warehouseId when provided', async () => {
      wmsTask().count.mockResolvedValue(0);
      wmsTask().findMany.mockResolvedValue([]);

      await getStats(WH_ID);

      expect(wmsTask().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID }),
        }),
      );
    });
  });

  // ########################################################################
  // bulkAssign
  // ########################################################################

  describe('bulkAssign', () => {
    it('should assign multiple pending tasks to an employee', async () => {
      const task1 = makeTaskRecord({ id: 'task-001', status: 'pending' });
      const task2 = makeTaskRecord({ id: 'task-002', status: 'pending' });
      const assigned1 = makeTaskRecord({ id: 'task-001', status: 'assigned', assignedToId: EMP_ID });
      const assigned2 = makeTaskRecord({ id: 'task-002', status: 'assigned', assignedToId: EMP_ID });

      wmsTask().findUnique.mockResolvedValueOnce(task1).mockResolvedValueOnce(task2);
      wmsTask().update.mockResolvedValueOnce(assigned1).mockResolvedValueOnce(assigned2);

      const result = await bulkAssign(['task-001', 'task-002'], EMP_ID);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('assigned');
      expect(result[1].status).toBe('assigned');
      expect(wmsTask().update).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundError when a task does not exist', async () => {
      wmsTask().findUnique.mockResolvedValue(null);

      await expect(bulkAssign(['nonexistent'], EMP_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw error when a task is not pending', async () => {
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ id: 'task-001', status: 'assigned' }));

      await expect(bulkAssign(['task-001'], EMP_ID)).rejects.toThrow(
        "Cannot assign task 'task-001' in status 'assigned'. Must be 'pending'.",
      );
    });
  });

  // ########################################################################
  // Full lifecycle
  // ########################################################################

  describe('full lifecycle', () => {
    it('should transition through all happy-path states', async () => {
      // pending -> assigned
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'pending' }));
      wmsTask().update.mockResolvedValue(makeTaskRecord({ status: 'assigned', assignedToId: EMP_ID }));
      const r1 = await assignTask('task-001', EMP_ID);
      expect(r1.status).toBe('assigned');

      // assigned -> in_progress
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'assigned' }));
      wmsTask().update.mockResolvedValue(makeTaskRecord({ status: 'in_progress', startedAt: new Date() }));
      const r2 = await startTask('task-001');
      expect(r2.status).toBe('in_progress');

      // in_progress -> completed
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'in_progress', startedAt: new Date() }));
      wmsTask().update.mockResolvedValue(
        makeTaskRecord({ status: 'completed', completedAt: new Date(), actualMins: 15 }),
      );
      const r3 = await completeTask('task-001');
      expect(r3.status).toBe('completed');
    });

    it('should support hold and resume cycle', async () => {
      // in_progress -> on_hold
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'in_progress' }));
      wmsTask().update.mockResolvedValue(makeTaskRecord({ status: 'on_hold' }));
      const r1 = await holdTask('task-001');
      expect(r1.status).toBe('on_hold');

      // on_hold -> in_progress
      wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status: 'on_hold' }));
      wmsTask().update.mockResolvedValue(makeTaskRecord({ status: 'in_progress' }));
      const r2 = await resumeTask('task-001');
      expect(r2.status).toBe('in_progress');
    });

    it('should allow cancellation at any non-terminal state', async () => {
      for (const status of ['pending', 'assigned', 'in_progress', 'on_hold']) {
        wmsTask().findUnique.mockResolvedValue(makeTaskRecord({ status }));
        wmsTask().update.mockResolvedValue(makeTaskRecord({ status: 'cancelled' }));

        const result = await cancelTask('task-001');
        expect(result.status).toBe('cancelled');
      }
    });
  });
});
