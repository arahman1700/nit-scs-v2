/**
 * Cross-Docking Routes — V2
 * REST endpoints for cross-dock workflow: identify, create, approve, execute, complete, cancel.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import { createAuditLog } from '../services/audit.service.js';
import { clientIp } from '../utils/helpers.js';
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

// ── GET /opportunities — Identify cross-dock opportunities ──────────────
router.get('/opportunities', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    if (!warehouseId) {
      sendError(res, 400, 'warehouseId query param is required');
      return;
    }
    const data = await identifyOpportunities(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /stats — Cross-dock statistics ──────────────────────────────────
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const data = await getStats(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET / — Paginated list ──────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId, status, page, pageSize } = req.query as Record<string, string | undefined>;
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
});

// ── GET /:id — Single cross-dock detail ─────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getCrossDockById(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create a cross-dock record ─────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole('admin', 'warehouse_supervisor'),
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
  requireRole('admin', 'warehouse_supervisor'),
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
  requireRole('admin', 'warehouse_supervisor', 'warehouse_staff'),
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
  requireRole('admin', 'warehouse_supervisor', 'warehouse_staff'),
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
  requireRole('admin', 'warehouse_supervisor'),
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
