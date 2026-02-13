import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { getDataSource } from '../services/widget-data.service.js';

const router = Router();

router.use(authenticate);

// ── GET /api/reports/saved — list user's saved reports ──────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const reports = await prisma.savedReport.findMany({
      where: {
        OR: [{ ownerId: userId }, { isPublic: true }],
      },
      include: {
        owner: { select: { fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    sendSuccess(res, reports);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports/saved — create saved report ───────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { name, description, dataSource, columns, filters, visualization, isPublic } = req.body;

    if (!name || !dataSource) {
      sendError(res, 400, 'name and dataSource are required');
      return;
    }

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
    const templates = await prisma.savedReport.findMany({
      where: { isTemplate: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { owner: { select: { fullName: true } } },
    });

    sendSuccess(res, templates);
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
        columns: template.columns as any,
        filters: template.filters as any,
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

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
