/**
 * Cross-Docking Routes — V2
 * REST endpoints for cross-dock workflow: identify, create, approve, execute, complete, cancel.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { createAuditLog } from '../../system/services/audit.service.js';
import { clientIp } from '../../../utils/helpers.js';
import { buildScopeFilter } from '../../../utils/scope-filter.js';
import {
  identifyOpportunities,
  createCrossDock,
  getCrossDocks,
  getCrossDockById,
  approveCrossDock,
  executeCrossDock,
  completeCrossDock,
  cancelCrossDock,
  getStats,
} from '../services/cross-dock.service.js';

const router = Router();

/**
 * Enforce warehouse scope: scoped users are restricted to their assigned warehouse.
 * Returns `null` when the user tries to access a different warehouse.
 */
function resolveWarehouseScope(req: Request, warehouseId: string | undefined): string | undefined | null {
  const scopeFilter = buildScopeFilter(req.user!, { warehouseField: 'warehouseId' });
  const scopedWarehouseId = scopeFilter.warehouseId as string | undefined;
  if (scopedWarehouseId) {
    if (warehouseId && warehouseId !== scopedWarehouseId) return null;
    return scopedWarehouseId;
  }
  return warehouseId;
}

// ── GET /opportunities — Identify cross-dock opportunities ──────────────
router.get(
  '/opportunities',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) {
        sendError(res, 403, 'You do not have access to this warehouse');
        return;
      }
      const warehouseId = resolved;
      if (!warehouseId) {
        sendError(res, 400, 'warehouseId query param is required');
        return;
      }
      const data = await identifyOpportunities(warehouseId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /stats — Cross-dock statistics ──────────────────────────────────
router.get(
  '/stats',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const warehouseId = resolved;
      const data = await getStats(warehouseId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET / — Paginated list ──────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, pageSize } = req.query as Record<string, string | undefined>;
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const warehouseId = resolved;
      const result = await getCrossDocks({
        warehouseId,
        status,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Single cross-dock detail ─────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getCrossDockById(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — Create a cross-dock record ─────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await createCrossDock(req.body);

      await createAuditLog({
        tableName: 'cross_docks',
        recordId: record.id,
        action: 'create',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/approve — Approve a cross-dock ────────────────────────────
router.post(
  '/:id/approve',
  authenticate,
  requirePermission('warehouse_zone', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await approveCrossDock(req.params.id as string);

      await createAuditLog({
        tableName: 'cross_docks',
        recordId: req.params.id as string,
        action: 'approve',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/execute — Begin cross-dock execution (bypass put-away) ────
router.post(
  '/:id/execute',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await executeCrossDock(req.params.id as string);

      await createAuditLog({
        tableName: 'cross_docks',
        recordId: req.params.id as string,
        action: 'execute',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/complete — Mark cross-dock as completed ────────────────────
router.post(
  '/:id/complete',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await completeCrossDock(req.params.id as string);

      await createAuditLog({
        tableName: 'cross_docks',
        recordId: req.params.id as string,
        action: 'complete',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/cancel — Cancel a cross-dock ──────────────────────────────
router.post(
  '/:id/cancel',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await cancelCrossDock(req.params.id as string);

      await createAuditLog({
        tableName: 'cross_docks',
        recordId: req.params.id as string,
        action: 'cancel',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
