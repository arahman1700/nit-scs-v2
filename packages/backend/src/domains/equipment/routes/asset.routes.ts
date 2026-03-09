/**
 * Asset Register Routes — M10
 *
 * CRUD + lifecycle actions:
 *   GET    /assets            — list assets (paginated, filterable)
 *   GET    /assets/summary    — dashboard summary stats
 *   GET    /assets/:id        — get asset detail with transfers & depreciation
 *   POST   /assets            — create a new asset
 *   PUT    /assets/:id        — update an existing asset
 *   POST   /assets/:id/transfer — transfer asset to warehouse/employee
 *   POST   /assets/:id/retire   — retire an asset
 *   POST   /assets/:id/dispose  — dispose of an asset
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { paginate } from '../../../middleware/pagination.js';
import { validate } from '../../../middleware/validate.js';
import { applyScopeFilter } from '../../../utils/scope-filter.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import { auditAndEmit } from '../../../utils/routeHelpers.js';
import {
  assetCreateSchema,
  assetUpdateSchema,
  assetTransferSchema,
  assetDisposeSchema,
} from '../../../schemas/document.schema.js';
import * as assetService from '../services/asset.service.js';

const router = Router();

const READ_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'finance_user'];
const WRITE_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'finance_user'];
const APPROVE_ROLES = ['admin', 'manager', 'finance_user'];

// ── GET /summary — dashboard stats (must be before /:id) ─────────────────
router.get(
  '/summary',
  authenticate,
  requireRole(...READ_ROLES),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await assetService.getAssetSummary();
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET / — list ─────────────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requireRole(...READ_ROLES),
  applyScopeFilter({ warehouseField: 'locationWarehouseId' }),
  paginate('createdAt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
      const extra: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (['page', 'pageSize', 'sortBy', 'sortDir', 'search'].includes(key)) continue;
        if (value && typeof value === 'string') extra[key] = value;
      }

      const { data, total } = await assetService.list({
        skip,
        pageSize,
        sortBy,
        sortDir,
        search,
        ...extra,
        ...req.scopeFilter,
      });
      sendSuccess(res, data, { page, pageSize, total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — detail ────────────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requireRole(...READ_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asset = await assetService.getById(req.params.id as string);
      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — create ─────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(assetCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asset = await assetService.create(req.body, req.user!.userId);

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'assets',
        recordId: asset.id,
        newValues: req.body,
        entityEvent: 'created',
        entityName: 'assets',
      });

      sendCreated(res, asset);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /:id — update ────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(assetUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { existing, updated } = await assetService.update(req.params.id as string, req.body);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'assets',
        recordId: req.params.id as string,
        oldValues: existing as Record<string, unknown>,
        newValues: req.body,
        entityEvent: 'updated',
        entityName: 'assets',
      });

      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/transfer — transfer asset ──────────────────────────────────
router.post(
  '/:id/transfer',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(assetTransferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { toWarehouseId, toEmployeeId, reason } = req.body;
      const asset = await assetService.transfer(
        req.params.id as string,
        toWarehouseId,
        toEmployeeId,
        reason,
        req.user!.userId,
      );

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'assets',
        recordId: req.params.id as string,
        newValues: { action: 'transfer', toWarehouseId, toEmployeeId },
        socketEvent: 'asset:transferred',
        docType: 'asset',
        socketData: { status: 'transferred' },
      });

      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/retire — retire asset ──────────────────────────────────────
router.post(
  '/:id/retire',
  authenticate,
  requireRole(...APPROVE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asset = await assetService.retire(req.params.id as string, req.user!.userId);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'assets',
        recordId: req.params.id as string,
        newValues: { status: 'retired' },
        socketEvent: 'asset:retired',
        docType: 'asset',
        socketData: { status: 'retired' },
      });

      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/dispose — dispose of asset ─────────────────────────────────
router.post(
  '/:id/dispose',
  authenticate,
  requireRole(...APPROVE_ROLES),
  validate(assetDisposeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { disposalValue } = req.body;
      const asset = await assetService.dispose(req.params.id as string, req.user!.userId, disposalValue);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'assets',
        recordId: req.params.id as string,
        newValues: { status: 'disposed', disposalValue },
        socketEvent: 'asset:disposed',
        docType: 'asset',
        socketData: { status: 'disposed' },
      });

      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
