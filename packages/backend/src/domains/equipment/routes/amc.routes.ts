/**
 * Annual Maintenance Contract (AMC) Routes — SOW M1
 *
 * GET    /amc              — List (paginated, filterable)
 * GET    /amc/:id          — Detail with supplier and equipment type
 * POST   /amc              — Create new AMC
 * PUT    /amc/:id          — Update draft AMC
 * POST   /amc/:id/activate — Activate contract
 * POST   /amc/:id/terminate — Terminate active contract
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { paginate } from '../../../middleware/pagination.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import { auditAndEmit } from '../../../utils/routeHelpers.js';
import { amcCreateSchema, amcUpdateSchema, amcTerminateSchema } from '../../../schemas/document.schema.js';
import * as amcService from '../services/amc.service.js';

const router = Router();

const ALLOWED_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'technical_manager'];

// ── GET / — List AMCs ───────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  paginate('createdAt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
      const extra: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (['page', 'pageSize', 'sortBy', 'sortDir', 'search'].includes(key)) continue;
        if (value && typeof value === 'string') extra[key] = value;
      }

      const { data, total } = await amcService.list({ skip, pageSize, sortBy, sortDir, search, ...extra });
      sendSuccess(res, data, { page, pageSize, total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Detail ──────────────────────────────────────────────────

router.get(
  '/:id',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const amc = await amcService.getById(req.params.id as string);
      sendSuccess(res, amc);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — Create new AMC ────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  validate(amcCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await amcService.create(req.body, req.user!.userId);
      await auditAndEmit(req, {
        action: 'create',
        tableName: 'annual_maintenance_contracts',
        recordId: result.id,
        newValues: req.body,
        entityEvent: 'created',
        entityName: 'amc',
      });
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /:id — Update draft AMC ────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  validate(amcUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await amcService.update(req.params.id as string, req.body);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'annual_maintenance_contracts',
        recordId: req.params.id as string,
        newValues: req.body,
        entityEvent: 'updated',
        entityName: 'amc',
      });
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/activate — Activate contract ─────────────────────────────

router.post(
  '/:id/activate',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await amcService.activate(req.params.id as string, req.user!.userId);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'annual_maintenance_contracts',
        recordId: req.params.id as string,
        newValues: { status: 'active' },
        socketEvent: 'amc:activated',
        docType: 'amc',
        socketData: { id: req.params.id, status: 'active' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/terminate — Terminate active contract ────────────────────

router.post(
  '/:id/terminate',
  authenticate,
  requireRole(...ALLOWED_ROLES),
  validate(amcTerminateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = (req.body ?? {}) as { reason?: string };
      const result = await amcService.terminate(req.params.id as string, req.user!.userId, reason);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'annual_maintenance_contracts',
        recordId: req.params.id as string,
        newValues: { status: 'terminated', reason },
        socketEvent: 'amc:terminated',
        docType: 'amc',
        socketData: { id: req.params.id, status: 'terminated' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
