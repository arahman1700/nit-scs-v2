/**
 * Cycle Count Routes — V2
 *
 * GET    /cycle-counts              — List (paginated, filterable)
 * GET    /cycle-counts/:id          — Detail with lines
 * POST   /cycle-counts              — Create
 * POST   /cycle-counts/:id/generate-lines — Generate count lines
 * POST   /cycle-counts/:id/start    — Start counting
 * POST   /cycle-counts/:id/lines/:lineId/count — Record a count
 * POST   /cycle-counts/:id/complete — Complete count
 * POST   /cycle-counts/:id/apply-adjustments — Apply inventory adjustments
 * DELETE /cycle-counts/:id          — Cancel
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import * as cycleCountService from '../services/cycle-count.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for cycle count operations');
    return false;
  }
  return true;
}

// ── GET / — List cycle counts ───────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const status = req.query.status as string | undefined;
    const warehouseId = req.query.warehouseId as string | undefined;
    const search = req.query.search as string | undefined;

    const { data, total } = await cycleCountService.list({ page, pageSize, status, warehouseId, search });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Detail with lines ────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const cycleCount = await cycleCountService.getById(req.params.id as string);
    sendSuccess(res, cycleCount);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create cycle count ─────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { countType, warehouseId, zoneId, scheduledDate, notes } = req.body;
    if (!countType || !warehouseId || !scheduledDate) {
      return sendError(res, 400, 'countType, warehouseId, and scheduledDate are required');
    }

    const validTypes = ['full', 'abc_based', 'zone', 'random'];
    if (!validTypes.includes(countType)) {
      return sendError(res, 400, `countType must be one of: ${validTypes.join(', ')}`);
    }

    const cycleCount = await cycleCountService.createCycleCount(
      { countType, warehouseId, zoneId, scheduledDate, notes },
      req.user!.userId,
    );
    sendCreated(res, cycleCount);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/generate-lines — Generate count lines ─────────────────────

router.post('/:id/generate-lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const result = await cycleCountService.generateCountLines(req.params.id as string, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/start — Start counting ────────────────────────────────────

router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const updated = await cycleCountService.startCount(req.params.id as string, req.user!.userId);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/lines/:lineId/count — Record a count ─────────────────────

router.post('/:id/lines/:lineId/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { countedQty, notes } = req.body;
    if (countedQty === undefined || countedQty === null) {
      return sendError(res, 400, 'countedQty is required');
    }

    const updated = await cycleCountService.recordCount(
      req.params.lineId as string,
      Number(countedQty),
      req.user!.userId,
      notes,
    );
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/complete — Complete count ─────────────────────────────────

router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const updated = await cycleCountService.completeCount(req.params.id as string, req.user!.userId);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/apply-adjustments — Apply inventory adjustments ───────────

router.post('/:id/apply-adjustments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.systemRole;
    if (role !== 'admin' && role !== 'warehouse_supervisor') {
      return sendError(res, 403, 'Only admin or warehouse supervisor can apply adjustments');
    }

    const result = await cycleCountService.applyAdjustments(req.params.id as string, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Cancel cycle count ────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const updated = await cycleCountService.cancelCount(req.params.id as string, req.user!.userId);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
