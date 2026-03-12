/**
 * WMS Task Queue Service — V2
 *
 * Manages warehouse management system tasks: receive, putaway, pick, pack,
 * replenish, count, move, load, unload. Handles the full lifecycle:
 * pending -> assigned -> in_progress -> completed (or cancelled / on_hold).
 */
import type { Prisma, WmsTask } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WmsTaskFilters {
  warehouseId?: string;
  status?: string;
  taskType?: string;
  assignedToId?: string;
  priority?: number;
  page?: number;
  pageSize?: number;
}

export interface WmsTaskStats {
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  onHold: number;
  avgCompletionMins: number;
}

// ---------------------------------------------------------------------------
// Include presets
// ---------------------------------------------------------------------------

const DETAIL_INCLUDE = {
  warehouse: true,
  assignedTo: { select: { id: true, fullName: true } },
  item: true,
  fromZone: true,
  toZone: true,
  fromBin: true,
  toBin: true,
} satisfies Prisma.WmsTaskInclude;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createTask(data: Prisma.WmsTaskUncheckedCreateInput): Promise<WmsTask> {
  return prisma.wmsTask.create({
    data,
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

export async function getTaskById(id: string) {
  const record = await prisma.wmsTask.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('WmsTask', id);
  return record;
}

export async function getTasks(filters: WmsTaskFilters) {
  const where: Prisma.WmsTaskWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.status) where.status = filters.status;
  if (filters.taskType) where.taskType = filters.taskType;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.priority) where.priority = filters.priority;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.wmsTask.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.wmsTask.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export async function assignTask(id: string, employeeId: string): Promise<WmsTask> {
  const record = await prisma.wmsTask.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('WmsTask', id);
  if (record.status !== 'pending') {
    throw new Error(`Cannot assign task in status '${record.status}'. Must be 'pending'.`);
  }

  return prisma.wmsTask.update({
    where: { id },
    data: {
      status: 'assigned',
      assignedToId: employeeId,
      assignedAt: new Date(),
    },
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

export async function startTask(id: string): Promise<WmsTask> {
  const record = await prisma.wmsTask.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('WmsTask', id);
  if (record.status !== 'assigned') {
    throw new Error(`Cannot start task in status '${record.status}'. Must be 'assigned'.`);
  }

  return prisma.wmsTask.update({
    where: { id },
    data: {
      status: 'in_progress',
      startedAt: new Date(),
    },
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

export async function completeTask(id: string): Promise<WmsTask> {
  const record = await prisma.wmsTask.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('WmsTask', id);
  if (record.status !== 'in_progress') {
    throw new Error(`Cannot complete task in status '${record.status}'. Must be 'in_progress'.`);
  }

  const completedAt = new Date();
  let actualMins: number | null = null;
  if (record.startedAt) {
    const diffMs = completedAt.getTime() - record.startedAt.getTime();
    actualMins = Math.round((diffMs / (1000 * 60)) * 100) / 100;
  }

  return prisma.wmsTask.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt,
      ...(actualMins !== null && { actualMins }),
    },
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

export async function cancelTask(id: string): Promise<WmsTask> {
  const record = await prisma.wmsTask.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('WmsTask', id);
  if (record.status === 'completed' || record.status === 'cancelled') {
    throw new Error(`Cannot cancel task in status '${record.status}'.`);
  }

  return prisma.wmsTask.update({
    where: { id },
    data: { status: 'cancelled' },
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

export async function holdTask(id: string): Promise<WmsTask> {
  const record = await prisma.wmsTask.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('WmsTask', id);
  if (record.status !== 'in_progress') {
    throw new Error(`Cannot hold task in status '${record.status}'. Must be 'in_progress'.`);
  }

  return prisma.wmsTask.update({
    where: { id },
    data: { status: 'on_hold' },
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

export async function resumeTask(id: string): Promise<WmsTask> {
  const record = await prisma.wmsTask.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('WmsTask', id);
  if (record.status !== 'on_hold') {
    throw new Error(`Cannot resume task in status '${record.status}'. Must be 'on_hold'.`);
  }

  return prisma.wmsTask.update({
    where: { id },
    data: { status: 'in_progress' },
    include: DETAIL_INCLUDE,
  }) as unknown as WmsTask;
}

// ---------------------------------------------------------------------------
// My Tasks
// ---------------------------------------------------------------------------

export async function getMyTasks(employeeId: string, status?: string) {
  const where: Prisma.WmsTaskWhereInput = { assignedToId: employeeId };
  if (status) where.status = status;

  return prisma.wmsTask.findMany({
    where,
    include: DETAIL_INCLUDE,
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export async function getStats(warehouseId?: string): Promise<WmsTaskStats> {
  const where: Prisma.WmsTaskWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const [pending, assigned, inProgress, completed, cancelled, onHold, completedRecords] = await Promise.all([
    prisma.wmsTask.count({ where: { ...where, status: 'pending' } }),
    prisma.wmsTask.count({ where: { ...where, status: 'assigned' } }),
    prisma.wmsTask.count({ where: { ...where, status: 'in_progress' } }),
    prisma.wmsTask.count({ where: { ...where, status: 'completed' } }),
    prisma.wmsTask.count({ where: { ...where, status: 'cancelled' } }),
    prisma.wmsTask.count({ where: { ...where, status: 'on_hold' } }),
    prisma.wmsTask.findMany({
      where: { ...where, status: 'completed', actualMins: { not: null } },
      select: { actualMins: true },
    }),
  ]);

  let avgCompletionMins = 0;
  if (completedRecords.length > 0) {
    let totalMins = 0;
    for (const rec of completedRecords) {
      totalMins += Number(rec.actualMins);
    }
    avgCompletionMins = Math.round((totalMins / completedRecords.length) * 10) / 10;
  }

  return {
    pending,
    assigned,
    inProgress,
    completed,
    cancelled,
    onHold,
    avgCompletionMins,
  };
}

// ---------------------------------------------------------------------------
// Bulk Assign
// ---------------------------------------------------------------------------

export async function bulkAssign(taskIds: string[], employeeId: string): Promise<WmsTask[]> {
  const now = new Date();
  const results: WmsTask[] = [];

  for (const taskId of taskIds) {
    const record = await prisma.wmsTask.findUnique({ where: { id: taskId } });
    if (!record) throw new NotFoundError('WmsTask', taskId);
    if (record.status !== 'pending') {
      throw new Error(`Cannot assign task '${taskId}' in status '${record.status}'. Must be 'pending'.`);
    }

    const updated = await prisma.wmsTask.update({
      where: { id: taskId },
      data: {
        status: 'assigned',
        assignedToId: employeeId,
        assignedAt: now,
      },
      include: DETAIL_INCLUDE,
    });
    results.push(updated as unknown as WmsTask);
  }

  return results;
}
