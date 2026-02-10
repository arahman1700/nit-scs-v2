/**
 * ABC Inventory Analysis Routes
 *
 * GET  /abc-analysis          — List items with ABC classification (paginated, filterable)
 * GET  /abc-analysis/summary  — Get ABC summary statistics
 * POST /abc-analysis/recalculate — Trigger manual recalculation (admin only)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  calculateABCClassification,
  applyABCClassification,
  getABCSummary,
  getABCItems,
} from '../services/abc-analysis.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET /abc-analysis — Paginated item list with ABC classification ──────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const abcClass = req.query.abcClass as string | undefined;
    const search = req.query.search as string | undefined;

    const { items, total } = await getABCItems({ page, pageSize, abcClass, search });

    sendSuccess(res, items, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /abc-analysis/summary — ABC summary stats ────────────────────────

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const summary = await getABCSummary(warehouseId);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
});

// ── POST /abc-analysis/recalculate — Manual recalculation (admin only) ───

router.post('/recalculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.systemRole;
    if (role !== 'admin' && role !== 'manager') {
      return sendError(res, 403, 'Only admin or manager roles can trigger ABC recalculation');
    }

    const warehouseId = req.body.warehouseId as string | undefined;
    const results = await calculateABCClassification(warehouseId);
    await applyABCClassification(results);

    await createAuditLog({
      tableName: 'items',
      recordId: 'abc-recalculation',
      action: 'update',
      changedFields: { abcClass: true, abcUpdatedAt: true },
      newValues: {
        classA: results.filter(r => r.abcClass === 'A').length,
        classB: results.filter(r => r.abcClass === 'B').length,
        classC: results.filter(r => r.abcClass === 'C').length,
        totalItems: results.length,
      },
      performedById: req.user!.userId,
    });

    sendSuccess(res, {
      message: 'ABC classification recalculated successfully',
      totalClassified: results.length,
      classA: results.filter(r => r.abcClass === 'A').length,
      classB: results.filter(r => r.abcClass === 'B').length,
      classC: results.filter(r => r.abcClass === 'C').length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
