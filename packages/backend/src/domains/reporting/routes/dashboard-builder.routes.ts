import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../utils/prisma.js';
import { authenticate } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../../../utils/response.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  defaultForRole: z.string().max(100).optional(),
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  defaultForRole: z.string().max(100).nullable().optional(),
});

const createWidgetSchema = z.object({
  widgetType: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  dataSource: z.string().min(1).max(255),
  queryConfig: z.record(z.unknown()).optional(),
  displayConfig: z.record(z.unknown()).optional(),
  gridPosition: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});

const updateWidgetSchema = z.object({
  widgetType: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(255).optional(),
  dataSource: z.string().min(1).max(255).optional(),
  queryConfig: z.record(z.unknown()).optional(),
  displayConfig: z.record(z.unknown()).optional(),
  gridPosition: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});

const layoutUpdateSchema = z.array(
  z.object({
    widgetId: z.string().min(1).max(100),
    gridPosition: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().optional(),
  }),
);

const router = Router();

router.use(authenticate);

const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '25'), 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

// ── GET /api/dashboards — list user's dashboards + defaults for their role ──

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.systemRole;
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);

    const where = {
      OR: [{ ownerId: userId }, { isPublic: true }, { defaultForRole: userRole }],
    };

    const [dashboards, total] = await Promise.all([
      prisma.dashboard.findMany({
        where,
        include: {
          _count: { select: { widgets: true } },
          owner: { select: { fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.dashboard.count({ where }),
    ]);

    sendSuccess(res, dashboards, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/dashboards — create dashboard ─────────────────────────────

router.post('/', validate(createDashboardSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { name, description, isPublic, defaultForRole } = req.body;

    const dashboard = await prisma.dashboard.create({
      data: {
        name,
        description: description ?? null,
        ownerId: userId,
        isPublic: isPublic ?? false,
        defaultForRole: defaultForRole ?? null,
      },
    });

    sendCreated(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboards/:id — get dashboard with widgets ────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const dashboard = await prisma.dashboard.findUnique({
      where: { id },
      include: {
        widgets: { orderBy: { sortOrder: 'asc' } },
        owner: { select: { fullName: true } },
      },
    });

    if (!dashboard) {
      sendError(res, 404, 'Dashboard not found');
      return;
    }

    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/dashboards/:id — update dashboard ─────────────────────────

router.put('/:id', validate(updateDashboardSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.dashboard.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, 'Dashboard not found');
      return;
    }
    if (existing.ownerId !== userId && req.user!.systemRole !== 'admin') {
      sendError(res, 403, 'Not authorized to edit this dashboard');
      return;
    }

    const { name, description, isPublic, defaultForRole } = req.body;

    const dashboard = await prisma.dashboard.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(defaultForRole !== undefined && { defaultForRole }),
      },
    });

    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/dashboards/:id — delete dashboard ───────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.dashboard.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, 'Dashboard not found');
      return;
    }
    if (existing.ownerId !== userId && req.user!.systemRole !== 'admin') {
      sendError(res, 403, 'Not authorized to delete this dashboard');
      return;
    }

    await prisma.dashboard.delete({ where: { id } });
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/dashboards/:id/widgets — add widget ──────────────────────

router.post('/:id/widgets', validate(createWidgetSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { widgetType, title, dataSource, queryConfig, displayConfig, gridPosition, sortOrder } = req.body;

    const dashboard = await prisma.dashboard.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      sendError(res, 404, 'Dashboard not found');
      return;
    }

    const widget = await prisma.dashboardWidget.create({
      data: {
        dashboardId,
        widgetType,
        title,
        dataSource,
        queryConfig: queryConfig ?? {},
        displayConfig: displayConfig ?? {},
        gridPosition: gridPosition ?? {},
        sortOrder: sortOrder ?? 0,
      },
    });

    sendCreated(res, widget);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/dashboards/:id/widgets/:wid — update widget ───────────────

router.put(
  '/:id/widgets/:wid',
  validate(updateWidgetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wid = Array.isArray(req.params.wid) ? req.params.wid[0] : req.params.wid;

      const existing = await prisma.dashboardWidget.findUnique({ where: { id: wid } });
      if (!existing) {
        sendError(res, 404, 'Widget not found');
        return;
      }

      const { widgetType, title, dataSource, queryConfig, displayConfig, gridPosition, sortOrder } = req.body;

      const widget = await prisma.dashboardWidget.update({
        where: { id: wid },
        data: {
          ...(widgetType !== undefined && { widgetType }),
          ...(title !== undefined && { title }),
          ...(dataSource !== undefined && { dataSource }),
          ...(queryConfig !== undefined && { queryConfig }),
          ...(displayConfig !== undefined && { displayConfig }),
          ...(gridPosition !== undefined && { gridPosition }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
      });

      sendSuccess(res, widget);
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /api/dashboards/:id/widgets/:wid — delete widget ────────────

router.delete('/:id/widgets/:wid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wid = Array.isArray(req.params.wid) ? req.params.wid[0] : req.params.wid;

    const existing = await prisma.dashboardWidget.findUnique({ where: { id: wid } });
    if (!existing) {
      sendError(res, 404, 'Widget not found');
      return;
    }

    await prisma.dashboardWidget.delete({ where: { id: wid } });
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/dashboards/:id/layout — batch update widget positions ─────

router.put('/:id/layout', validate(layoutUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user!.userId;

    const dashboard = await prisma.dashboard.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      sendError(res, 404, 'Dashboard not found');
      return;
    }
    if (dashboard.ownerId !== userId && req.user!.systemRole !== 'admin') {
      sendError(res, 403, 'Not authorized to edit this dashboard layout');
      return;
    }

    const items = req.body as Array<{
      widgetId: string;
      gridPosition?: Prisma.InputJsonValue;
      sortOrder?: number;
    }>;

    await prisma.$transaction(
      items.map(item =>
        prisma.dashboardWidget.update({
          where: { id: item.widgetId },
          data: {
            ...(item.gridPosition !== undefined && { gridPosition: item.gridPosition as object }),
            ...(item.sortOrder !== undefined && { sortOrder: item.sortOrder }),
          },
        }),
      ),
    );

    const updated = await prisma.dashboardWidget.findMany({
      where: { dashboardId },
      orderBy: { sortOrder: 'asc' },
    });

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
