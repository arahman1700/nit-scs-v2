/**
 * Visitor Management Routes — SOW M5-F03
 *
 * GET    /visitors              — List (paginated, filterable)
 * GET    /visitors/:id          — Detail with host and warehouse info
 * POST   /visitors              — Register new visitor pass
 * PUT    /visitors/:id          — Update scheduled visitor pass
 * POST   /visitors/:id/check-in — Check in visitor
 * POST   /visitors/:id/check-out — Check out visitor
 * POST   /visitors/:id/cancel   — Cancel scheduled visit
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { applyScopeFilter } from '../../../utils/scope-filter.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import {
  visitorPassCreateSchema,
  visitorPassUpdateSchema,
  visitorCheckInSchema,
} from '../../../schemas/document.schema.js';
import * as visitorService from '../services/visitor.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'warehouse_supervisor', 'gate_officer'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for visitor management operations');
    return false;
  }
  return true;
}

// ── GET / — List visitor passes ──────────────────────────────────────────

router.get(
  '/',
  applyScopeFilter({ warehouseField: 'warehouseId' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!checkRole(req, res)) return;

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const warehouseId = req.query.warehouseId as string | undefined;
      const hostEmployeeId = req.query.hostEmployeeId as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortDir = (req.query.sortDir as 'asc' | 'desc') || undefined;

      const { data, total } = await visitorService.list({
        page,
        pageSize,
        search,
        status,
        warehouseId,
        hostEmployeeId,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
        ...req.scopeFilter,
      });
      sendSuccess(res, data, { page, pageSize, total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Detail ───────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const visitorPass = await visitorService.getById(req.params.id as string);
    sendSuccess(res, visitorPass);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Register new visitor pass ──────────────────────────────────

router.post('/', validate(visitorPassCreateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const visitorPass = await visitorService.register(req.body, req.user!.userId);
    sendCreated(res, visitorPass);
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id — Update scheduled visitor pass ────────────────────────────

router.put('/:id', validate(visitorPassUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const updated = await visitorService.update(req.params.id as string, req.body);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/check-in — Check in visitor ───────────────────────────────

router.post(
  '/:id/check-in',
  validate(visitorCheckInSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!checkRole(req, res)) return;

      const updated = await visitorService.checkIn(req.params.id as string, req.body);
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/check-out — Check out visitor ─────────────────────────────

router.post('/:id/check-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const updated = await visitorService.checkOut(req.params.id as string);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/cancel — Cancel scheduled visit ──────────────────────────

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const updated = await visitorService.cancel(req.params.id as string);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
