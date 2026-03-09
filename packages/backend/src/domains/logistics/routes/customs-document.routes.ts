/**
 * Customs Document Routes — SOW M9
 *
 * GET    /customs-documents                        — List by shipment (requires ?shipmentId=)
 * POST   /customs-documents                        — Create new customs document
 * GET    /customs-documents/completeness/:shipmentId — Document completeness check
 * GET    /customs-documents/:id                    — Detail
 * PUT    /customs-documents/:id                    — Update
 * POST   /customs-documents/:id/verify             — Mark as verified
 * POST   /customs-documents/:id/reject             — Mark as rejected
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import {
  customsDocumentCreateSchema,
  customsDocumentUpdateSchema,
  customsDocumentRejectSchema,
} from '../../../schemas/document.schema.js';
import * as customsDocService from '../services/customs-document.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET / — List customs documents by shipment ──────────────────────────

router.get('/', requirePermission('customs', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shipmentId = req.query.shipmentId as string | undefined;
    if (!shipmentId) {
      sendError(res, 400, 'shipmentId query parameter is required');
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const status = req.query.status as string | undefined;
    const documentType = req.query.documentType as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortDir = (req.query.sortDir as 'asc' | 'desc') || undefined;

    const { data, total } = await customsDocService.listByShipment({
      page,
      pageSize,
      shipmentId,
      status,
      documentType,
      sortBy,
      sortDir,
    });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /completeness/:shipmentId — Document completeness check ─────────

router.get(
  '/completeness/:shipmentId',
  requirePermission('customs', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const completeness = await customsDocService.getCompleteness(req.params.shipmentId as string);
      sendSuccess(res, completeness);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Detail ───────────────────────────────────────────────────

router.get('/:id', requirePermission('customs', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await customsDocService.getById(req.params.id as string);
    sendSuccess(res, doc);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create customs document ────────────────────────────────────

router.post(
  '/',
  requirePermission('customs', 'create'),
  validate(customsDocumentCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await customsDocService.create(req.body, req.user!.userId);
      sendCreated(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /:id — Update customs document ──────────────────────────────────

router.put(
  '/:id',
  requirePermission('customs', 'update'),
  validate(customsDocumentUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await customsDocService.update(req.params.id as string, req.body);
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/verify — Verify customs document ─────────────────────────

router.post(
  '/:id/verify',
  requirePermission('customs', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await customsDocService.verify(req.params.id as string, req.user!.userId);
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/reject — Reject customs document ─────────────────────────

router.post(
  '/:id/reject',
  requirePermission('customs', 'update'),
  validate(customsDocumentRejectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await customsDocService.reject(req.params.id as string, req.user!.userId, req.body.reason);
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
