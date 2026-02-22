import { prisma } from '../utils/prisma.js';

export async function listStandards() {
  return prisma.laborStandard.findMany({ orderBy: { taskType: 'asc' } });
}

export async function upsertStandard(
  taskType: string,
  standardMinutes: number,
  description?: string,
  unitOfMeasure?: string,
) {
  return prisma.laborStandard.upsert({
    where: { taskType },
    create: { taskType, standardMinutes, description, unitOfMeasure: unitOfMeasure || 'document' },
    update: {
      standardMinutes,
      ...(description !== undefined && { description }),
      ...(unitOfMeasure !== undefined && { unitOfMeasure }),
    },
  });
}

export async function getPerformanceReport(days: number = 30, _warehouseId?: string) {
  // Get standards
  const standards = await prisma.laborStandard.findMany();
  const standardMap = new Map(standards.map(s => [s.taskType, s]));

  // Get productivity data from audit log
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Task type to audit action mapping
  const TASK_ACTION_MAP: Record<string, string[]> = {
    grn_receive: ['mrrv.create', 'mrrv.submit'],
    mi_issue: ['mirv.create', 'mirv.submit'],
    wt_transfer: ['stockTransfer.create', 'stockTransfer.submit'],
    qci_inspect: ['rfim.create', 'rfim.complete'],
    putaway: ['inventoryLot.create'],
    picking: ['mirv.issue'],
    packing: ['packingSession.complete'],
    cycle_count: ['cycleCount.complete'],
  };

  // Count actions per user for each task type
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      performedAt: { gte: since },
      action: { in: Object.values(TASK_ACTION_MAP).flat() },
    },
    select: { performedById: true, action: true, performedAt: true },
  });

  // Group by performedById
  const workerMap = new Map<string, { taskCounts: Record<string, number>; totalTasks: number }>();

  for (const entry of auditLogs) {
    if (!entry.performedById) continue;
    if (!workerMap.has(entry.performedById)) {
      workerMap.set(entry.performedById, { taskCounts: {}, totalTasks: 0 });
    }
    const worker = workerMap.get(entry.performedById)!;

    for (const [taskType, actions] of Object.entries(TASK_ACTION_MAP)) {
      if (actions.includes(entry.action)) {
        worker.taskCounts[taskType] = (worker.taskCounts[taskType] || 0) + 1;
        worker.totalTasks++;
      }
    }
  }

  // Compute efficiency for each worker
  const workers = await prisma.employee.findMany({
    where: { id: { in: [...workerMap.keys()] } },
    select: { id: true, fullName: true },
  });

  const report = workers
    .map(emp => {
      const data = workerMap.get(emp.id);
      if (!data) return null;

      let totalStandardMinutes = 0;
      const taskBreakdown: Array<{ taskType: string; count: number; standardMinutes: number }> = [];

      for (const [taskType, count] of Object.entries(data.taskCounts)) {
        const std = standardMap.get(taskType);
        const stdMinutes = std ? Number(std.standardMinutes) * count : 0;
        totalStandardMinutes += stdMinutes;
        taskBreakdown.push({ taskType, count, standardMinutes: stdMinutes });
      }

      // Assume 8-hour workday, calculate actual minutes worked
      const actualMinutesWorked = days * 8 * 60; // Simplified: full working days
      const efficiency = actualMinutesWorked > 0 ? (totalStandardMinutes / actualMinutesWorked) * 100 : 0;

      return {
        employeeId: emp.id,
        employeeName: emp.fullName,
        totalTasks: data.totalTasks,
        totalStandardMinutes,
        efficiency: Math.round(efficiency * 10) / 10,
        taskBreakdown,
      };
    })
    .filter(Boolean);

  return {
    period: { days, since: since.toISOString() },
    standards: standards.map(s => ({
      taskType: s.taskType,
      standardMinutes: s.standardMinutes,
      unit: s.unitOfMeasure,
    })),
    workers: report.sort((a, b) => (b?.efficiency || 0) - (a?.efficiency || 0)),
  };
}
