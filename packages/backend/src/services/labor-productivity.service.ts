import { prisma } from '../utils/prisma.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface WorkerProductivity {
  employeeId: string;
  fullName: string;
  role: string;
  metrics: {
    grnsProcessed: number;
    misIssued: number;
    wtsTransferred: number;
    tasksCompleted: number;
    avgTaskDurationMinutes: number | null;
  };
}

export interface DailyThroughput {
  date: string;
  grns: number;
  mis: number;
  wts: number;
  tasks: number;
}

export interface ProductivitySummary {
  period: { from: string; to: string };
  totals: {
    grnsProcessed: number;
    misIssued: number;
    wtsTransferred: number;
    tasksCompleted: number;
  };
  workers: WorkerProductivity[];
  dailyThroughput: DailyThroughput[];
}

// ── Service ─────────────────────────────────────────────────────────────

/**
 * Derives labor productivity metrics from the AuditLog table.
 * Counts document-level actions (create/update on mrrv, mirv, stock_transfers)
 * grouped by performer, plus task completion time from the Task model.
 */
export async function getProductivitySummary(days: number = 30, warehouseId?: string): Promise<ProductivitySummary> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const toDate = new Date();

  // 1. Count document actions per worker from audit_log
  // GRN = mrrv table with action 'create'
  // MI = mirv table with status transitions (action 'update')
  // WT = stock_transfers table with action 'create'
  const documentCounts = await prisma.$queryRaw<
    Array<{
      performed_by_id: string;
      full_name: string;
      system_role: string;
      table_name: string;
      cnt: bigint;
    }>
  >`
    SELECT
      al.performed_by_id,
      e.full_name,
      e.system_role,
      al.table_name,
      COUNT(*) as cnt
    FROM audit_log al
    JOIN employees e ON e.id = al.performed_by_id
    WHERE al.performed_at >= ${fromDate}
      AND al.performed_at <= ${toDate}
      AND al.table_name IN ('mrrv', 'mirv', 'stock_transfers')
      AND al.action = 'create'
      AND al.performed_by_id IS NOT NULL
    GROUP BY al.performed_by_id, e.full_name, e.system_role, al.table_name
    ORDER BY e.full_name
  `;

  // 2. Task completion metrics (avg duration)
  const taskMetrics = await prisma.$queryRaw<
    Array<{
      assignee_id: string;
      full_name: string;
      system_role: string;
      completed_count: bigint;
      avg_duration_minutes: number | null;
    }>
  >`
    SELECT
      t.assignee_id,
      e.full_name,
      e.system_role,
      COUNT(*) as completed_count,
      AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60)::float as avg_duration_minutes
    FROM tasks t
    JOIN employees e ON e.id = t.assignee_id
    WHERE t.status = 'completed'
      AND t.completed_at >= ${fromDate}
      AND t.completed_at <= ${toDate}
      AND t.assignee_id IS NOT NULL
    GROUP BY t.assignee_id, e.full_name, e.system_role
  `;

  // 3. Daily throughput
  const dailyData = await prisma.$queryRaw<Array<{ day: string; table_name: string; cnt: bigint }>>`
    SELECT
      TO_CHAR(al.performed_at, 'YYYY-MM-DD') as day,
      al.table_name,
      COUNT(*) as cnt
    FROM audit_log al
    WHERE al.performed_at >= ${fromDate}
      AND al.performed_at <= ${toDate}
      AND al.table_name IN ('mrrv', 'mirv', 'stock_transfers', 'tasks')
      AND al.action IN ('create', 'update')
      AND al.performed_by_id IS NOT NULL
    GROUP BY day, al.table_name
    ORDER BY day
  `;

  // 4. Also count task completions per day
  const dailyTasks = await prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>`
    SELECT
      TO_CHAR(completed_at, 'YYYY-MM-DD') as day,
      COUNT(*) as cnt
    FROM tasks
    WHERE status = 'completed'
      AND completed_at >= ${fromDate}
      AND completed_at <= ${toDate}
    GROUP BY day
    ORDER BY day
  `;

  // ── Aggregate workers ─────────────────────────────────────────────────
  const workerMap = new Map<string, WorkerProductivity>();

  for (const row of documentCounts) {
    const id = row.performed_by_id;
    if (!workerMap.has(id)) {
      workerMap.set(id, {
        employeeId: id,
        fullName: row.full_name,
        role: row.system_role,
        metrics: { grnsProcessed: 0, misIssued: 0, wtsTransferred: 0, tasksCompleted: 0, avgTaskDurationMinutes: null },
      });
    }
    const w = workerMap.get(id)!;
    const count = Number(row.cnt);
    if (row.table_name === 'mrrv') w.metrics.grnsProcessed = count;
    else if (row.table_name === 'mirv') w.metrics.misIssued = count;
    else if (row.table_name === 'stock_transfers') w.metrics.wtsTransferred = count;
  }

  for (const row of taskMetrics) {
    const id = row.assignee_id;
    if (!workerMap.has(id)) {
      workerMap.set(id, {
        employeeId: id,
        fullName: row.full_name,
        role: row.system_role,
        metrics: { grnsProcessed: 0, misIssued: 0, wtsTransferred: 0, tasksCompleted: 0, avgTaskDurationMinutes: null },
      });
    }
    const w = workerMap.get(id)!;
    w.metrics.tasksCompleted = Number(row.completed_count);
    w.metrics.avgTaskDurationMinutes = row.avg_duration_minutes ? Math.round(row.avg_duration_minutes * 10) / 10 : null;
  }

  // ── Aggregate daily throughput ────────────────────────────────────────
  const dayMap = new Map<string, DailyThroughput>();

  for (const row of dailyData) {
    if (!dayMap.has(row.day)) {
      dayMap.set(row.day, { date: row.day, grns: 0, mis: 0, wts: 0, tasks: 0 });
    }
    const d = dayMap.get(row.day)!;
    const count = Number(row.cnt);
    if (row.table_name === 'mrrv') d.grns = count;
    else if (row.table_name === 'mirv') d.mis = count;
    else if (row.table_name === 'stock_transfers') d.wts = count;
  }

  for (const row of dailyTasks) {
    if (!dayMap.has(row.day)) {
      dayMap.set(row.day, { date: row.day, grns: 0, mis: 0, wts: 0, tasks: 0 });
    }
    dayMap.get(row.day)!.tasks = Number(row.cnt);
  }

  // ── Totals ────────────────────────────────────────────────────────────
  const workers = [...workerMap.values()];
  const totals = workers.reduce(
    (acc, w) => ({
      grnsProcessed: acc.grnsProcessed + w.metrics.grnsProcessed,
      misIssued: acc.misIssued + w.metrics.misIssued,
      wtsTransferred: acc.wtsTransferred + w.metrics.wtsTransferred,
      tasksCompleted: acc.tasksCompleted + w.metrics.tasksCompleted,
    }),
    { grnsProcessed: 0, misIssued: 0, wtsTransferred: 0, tasksCompleted: 0 },
  );

  return {
    period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
    totals,
    workers: workers.sort((a, b) => {
      const aTotal =
        a.metrics.grnsProcessed + a.metrics.misIssued + a.metrics.wtsTransferred + a.metrics.tasksCompleted;
      const bTotal =
        b.metrics.grnsProcessed + b.metrics.misIssued + b.metrics.wtsTransferred + b.metrics.tasksCompleted;
      return bTotal - aTotal;
    }),
    dailyThroughput: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
