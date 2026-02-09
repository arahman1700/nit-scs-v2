import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { cached, CacheTTL } from '../utils/cache.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET /stats — Overall dashboard statistics ───────────────────────────

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cached('dashboard:stats', CacheTTL.DASHBOARD_STATS, async () => {
      const [totalProjects, totalItems, totalWarehouses, totalEmployees, pendingMirv, pendingJo, lowStockAlerts] =
        await Promise.all([
          prisma.project.count({ where: { status: 'active' } }),
          prisma.item.count({ where: { status: 'active' } }),
          prisma.warehouse.count({ where: { status: 'active' } }),
          prisma.employee.count({ where: { isActive: true } }),
          prisma.mirv.count({ where: { status: 'pending_approval' } }),
          prisma.jobOrder.count({ where: { status: 'pending_approval' } }),
          prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM inventory_levels
          WHERE qty_on_hand <= COALESCE(min_level, 0)
            AND min_level IS NOT NULL
            AND min_level > 0
        `,
        ]);

      const lowStockCount = Number(lowStockAlerts[0]?.count ?? 0);

      return {
        totalProjects,
        totalItems,
        totalWarehouses,
        totalEmployees,
        pendingApprovals: pendingMirv + pendingJo,
        lowStockAlerts: lowStockCount,
      };
    });

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /recent-activity — Recent audit log entries grouped by day ──────

router.get('/recent-activity', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cached('dashboard:recent-activity', CacheTTL.RECENT_ACTIVITY, async () => {
      const recentLogs = await prisma.auditLog.findMany({
        orderBy: { performedAt: 'desc' },
        take: 20,
        include: {
          performedBy: { select: { fullName: true, email: true } },
        },
      });

      // Group by day
      const grouped: Record<string, typeof recentLogs> = {};
      for (const log of recentLogs) {
        const day = log.performedAt.toISOString().split('T')[0];
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(log);
      }

      return Object.entries(grouped).map(([date, entries]) => ({
        date,
        entries,
      }));
    });

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /inventory-summary — Inventory overview stats ───────────────────

router.get('/inventory-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cached('dashboard:inventory-summary', CacheTTL.INVENTORY_SUMMARY, async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const [totalValueResult, totalItems, lowStockCount, expiringCount] = await Promise.all([
        prisma.$queryRaw<{ total_value: number }[]>`
          SELECT COALESCE(SUM(available_qty * unit_cost), 0)::float as total_value
          FROM inventory_lots
          WHERE status = 'active'
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT item_id) as count
          FROM inventory_levels
          WHERE qty_on_hand > 0
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM inventory_levels
          WHERE qty_on_hand <= COALESCE(min_level, 0)
            AND min_level IS NOT NULL
            AND min_level > 0
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM inventory_lots
          WHERE expiry_date <= ${thirtyDaysFromNow}
            AND status = 'active'
        `,
      ]);

      return {
        totalValue: totalValueResult[0]?.total_value ?? 0,
        totalItems: Number(totalItems[0]?.count ?? 0),
        lowStockCount: Number(lowStockCount[0]?.count ?? 0),
        expiringCount: Number(expiringCount[0]?.count ?? 0),
      };
    });

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /document-counts — Document stats with status breakdowns ────────

router.get('/document-counts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cached('dashboard:document-counts', CacheTTL.DOCUMENT_COUNTS, async () => {
      const [mrrvData, mirvData, mrvData, joData] = await Promise.all([
        prisma.mrrv.groupBy({ by: ['status'], _count: true }),
        prisma.mirv.groupBy({ by: ['status'], _count: true }),
        prisma.mrv.groupBy({ by: ['status'], _count: true }),
        prisma.jobOrder.groupBy({ by: ['status'], _count: true }),
      ]);

      const buildBreakdown = (data: { status: string; _count: number }[]) => {
        const breakdown: Record<string, number> = {};
        let total = 0;
        for (const row of data) {
          breakdown[row.status] = row._count;
          total += row._count;
        }
        return { total, breakdown };
      };

      return {
        mrrv: buildBreakdown(mrrvData),
        mirv: buildBreakdown(mirvData),
        mrv: buildBreakdown(mrvData),
        jo: buildBreakdown(joData),
      };
    });

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /sla-compliance — SLA metrics per document type ─────────────────

router.get('/sla-compliance', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cached('dashboard:sla-compliance', CacheTTL.SLA_COMPLIANCE, async () => {
      const now = new Date();

      // MIRV SLA compliance (uses slaDueDate on mirv table)
      const [mirvTotal, mirvOnTime, mirvBreached, mirvPending] = await Promise.all([
        prisma.mirv.count({ where: { slaDueDate: { not: null } } }),
        prisma.mirv.count({
          where: {
            slaDueDate: { not: null },
            status: { in: ['issued', 'completed'] },
            issuedDate: { not: null },
          },
        }),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM mirv
          WHERE sla_due_date IS NOT NULL
            AND sla_due_date < ${now}
            AND status NOT IN ('issued', 'completed', 'cancelled', 'rejected')
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM mirv
          WHERE sla_due_date IS NOT NULL
            AND sla_due_date >= ${now}
            AND status IN ('draft', 'pending_approval', 'approved', 'partially_issued')
        `,
      ]);

      // JO SLA compliance (uses jo_sla_tracking table)
      const [joTotal, joOnTime, joBreached, joPending] = await Promise.all([
        prisma.joSlaTracking.count({ where: { slaDueDate: { not: null } } }),
        prisma.joSlaTracking.count({ where: { slaMet: true } }),
        prisma.joSlaTracking.count({ where: { slaMet: false } }),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM jo_sla_tracking jst
          JOIN job_orders jo ON jo.id = jst.job_order_id
          WHERE jst.sla_due_date IS NOT NULL
            AND jst.sla_due_date >= ${now}
            AND jst.sla_met IS NULL
            AND jo.status NOT IN ('completed', 'invoiced', 'cancelled', 'rejected')
        `,
      ]);

      const calcPercentages = (total: number, onTime: number, breached: number, pending: number) => {
        if (total === 0) return { total: 0, onTime: 0, breached: 0, pending: 0 };
        return {
          total,
          onTime: Math.round((onTime / total) * 100),
          breached: Math.round((breached / total) * 100),
          pending: Math.round((pending / total) * 100),
        };
      };

      return {
        mirv: calcPercentages(
          mirvTotal,
          mirvOnTime,
          Number(mirvBreached[0]?.count ?? 0),
          Number(mirvPending[0]?.count ?? 0),
        ),
        jo: calcPercentages(joTotal, joOnTime, joBreached, Number(joPending[0]?.count ?? 0)),
      };
    });

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /top-projects — Top 5 projects by active documents ──────────────

router.get('/top-projects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cached('dashboard:top-projects', CacheTTL.TOP_PROJECTS, async () => {
      const topProjects = await prisma.$queryRaw<
        { id: string; project_code: string; project_name: string; doc_count: bigint }[]
      >`
        SELECT
          p.id,
          p.project_code,
          p.project_name,
          (
            COALESCE(jo_cnt.cnt, 0) + COALESCE(mirv_cnt.cnt, 0)
          ) as doc_count
        FROM projects p
        LEFT JOIN (
          SELECT project_id, COUNT(*) as cnt
          FROM job_orders
          WHERE status NOT IN ('completed', 'invoiced', 'cancelled', 'rejected')
          GROUP BY project_id
        ) jo_cnt ON jo_cnt.project_id = p.id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as cnt
          FROM mirv
          WHERE status NOT IN ('completed', 'cancelled', 'rejected')
          GROUP BY project_id
        ) mirv_cnt ON mirv_cnt.project_id = p.id
        WHERE p.status = 'active'
        ORDER BY doc_count DESC
        LIMIT 5
      `;

      return topProjects.map(p => ({
        id: p.id,
        projectCode: p.project_code,
        projectName: p.project_name,
        activeDocuments: Number(p.doc_count),
      }));
    });

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
