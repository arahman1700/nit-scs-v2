import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../utils/prisma.js';
import { authenticate } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../../../utils/response.js';
import { getDataSource } from '../services/widget-data.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const shareReportSchema = z.object({
  roles: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

const createSavedReportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dataSource: z.string().min(1),
  columns: z.array(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
  visualization: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const updateSavedReportSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dataSource: z.string().min(1).optional(),
  columns: z.array(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
  visualization: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const router = Router();

router.use(authenticate);

const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '25'), 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

// ── GET /api/reports/saved — list user's saved reports ──────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);

    const where = {
      OR: [{ ownerId: userId }, { isPublic: true }],
    };

    const [reports, total] = await Promise.all([
      prisma.savedReport.findMany({
        where,
        include: {
          owner: { select: { fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.savedReport.count({ where }),
    ]);

    sendSuccess(res, reports, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports/saved — create saved report ───────────────────────

router.post('/', validate(createSavedReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { name, description, dataSource, columns, filters, visualization, isPublic } = req.body;

    const report = await prisma.savedReport.create({
      data: {
        name,
        description: description ?? null,
        ownerId: userId,
        dataSource,
        columns: columns ?? [],
        filters: filters ?? {},
        visualization: visualization ?? 'table',
        isPublic: isPublic ?? false,
      },
    });

    sendCreated(res, report);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/saved/templates — list all public templates ──────

router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);
    const where = { isTemplate: true };

    const [templates, total] = await Promise.all([
      prisma.savedReport.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        include: { owner: { select: { fullName: true } } },
        skip,
        take: pageSize,
      }),
      prisma.savedReport.count({ where }),
    ]);

    sendSuccess(res, templates, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports/saved/templates/:id/use — copy template to user's reports ──

router.post('/templates/:id/use', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const templateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const template = await prisma.savedReport.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.isTemplate) {
      sendError(res, 404, 'Template not found');
      return;
    }

    const userReport = await prisma.savedReport.create({
      data: {
        name: `${template.name} (copy)`,
        description: template.description,
        dataSource: template.dataSource,
        columns: template.columns as Prisma.InputJsonValue,
        filters: template.filters as Prisma.InputJsonValue,
        visualization: template.visualization,
        ownerId: userId,
        isPublic: false,
      },
    });

    sendCreated(res, userReport);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/saved/shared — reports shared with my role ─────────
// NOTE: must be registered BEFORE /:id to prevent shadowing

router.get('/shared', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role;
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);

    // Find reports where sharedWithRoles JSON array contains the user's role
    const [reports, total] = await Promise.all([
      prisma.savedReport.findMany({
        where: {
          sharedWithRoles: { array_contains: userRole },
        },
        include: { owner: { select: { fullName: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.savedReport.count({
        where: {
          sharedWithRoles: { array_contains: userRole },
        },
      }),
    ]);

    sendSuccess(res, reports, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/saved/:id — get report config ──────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const report = await prisma.savedReport.findUnique({
      where: { id },
      include: { owner: { select: { fullName: true } } },
    });

    if (!report) {
      sendError(res, 404, 'Report not found');
      return;
    }

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/reports/saved/:id — update report ─────────────────────────

router.put('/:id', validate(updateSavedReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.savedReport.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, 'Report not found');
      return;
    }
    if (existing.ownerId !== userId && req.user!.systemRole !== 'admin') {
      sendError(res, 403, 'Not authorized to edit this report');
      return;
    }

    const { name, description, dataSource, columns, filters, visualization, isPublic } = req.body;

    const report = await prisma.savedReport.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(dataSource !== undefined && { dataSource }),
        ...(columns !== undefined && { columns }),
        ...(filters !== undefined && { filters }),
        ...(visualization !== undefined && { visualization }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/reports/saved/:id — delete report ───────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.savedReport.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, 'Report not found');
      return;
    }
    if (existing.ownerId !== userId && req.user!.systemRole !== 'admin') {
      sendError(res, 403, 'Not authorized to delete this report');
      return;
    }

    await prisma.savedReport.delete({ where: { id } });
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports/saved/:id/share — update sharing settings ─────────

router.post('/:id/share', validate(shareReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.savedReport.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, 'Report not found');
      return;
    }
    if (existing.ownerId !== userId && req.user!.systemRole !== 'admin') {
      sendError(res, 403, 'Not authorized to share this report');
      return;
    }

    const { roles, isPublic } = req.body as { roles?: string[]; isPublic?: boolean };

    const report = await prisma.savedReport.update({
      where: { id },
      data: {
        ...(roles !== undefined && { sharedWithRoles: roles }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports/saved/:id/run — execute report ────────────────────

router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const report = await prisma.savedReport.findUnique({ where: { id } });
    if (!report) {
      sendError(res, 404, 'Report not found');
      return;
    }

    // Use the widget data service to execute the report's data source
    const fn = getDataSource(report.dataSource);
    if (!fn) {
      sendError(res, 400, `Unknown data source for report: ${report.dataSource}`);
      return;
    }

    // Merge saved filters with any runtime overrides from the request body
    const runtimeFilters = req.body?.filters ?? {};
    const mergedFilters = {
      ...(report.filters as Record<string, unknown>),
      ...runtimeFilters,
    };

    const result = await fn({
      filters: mergedFilters,
      dateRange: req.body?.dateRange,
      limit: req.body?.limit,
    });

    sendSuccess(res, {
      report: { id: report.id, name: report.name, visualization: report.visualization },
      columns: report.columns,
      result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
