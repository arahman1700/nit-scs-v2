/**
 * Stock Allocation Routes — V2
 * REST endpoints for real-time stock reservation engine.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { createAuditLog } from '../../audit/services/audit.service.js';
import { clientIp } from '../../../utils/helpers.js';
import { resolveWarehouseScope as _resolveWarehouseScope } from '../../../utils/scope-filter.js';
import {
  allocate,
  release,
  confirmPick,
  cancel,
  getByDemand,
  getAvailable,
  getAllocations,
  bulkAllocate,
  getStats,
} from '../services/stock-allocation.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const allocateSchema = z.object({
  warehouseId: z.string().uuid(),
  itemId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  binId: z.string().uuid().optional(),
  lpnId: z.string().uuid().optional(),
  qtyAllocated: z.number().positive(),
  allocType: z.enum(['soft', 'hard', 'pick_confirmed']),
  demandDocType: z.string().min(1).max(50),
  demandDocId: z.string().uuid(),
  allocatedById: z.string().uuid().optional(),
});

const bulkAllocateSchema = z.object({
  demandDocType: z.string().min(1).max(50),
  demandDocId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().positive(),
      }),
    )
    .min(1),
});

const router = Router();

function resolveWarehouseScope(req: Request, warehouseId: string | undefined) {
  return _resolveWarehouseScope(req.user!, warehouseId);
}

// ── GET /available — Available vs allocated for item ────────────────────
router.get(
  '/available',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId, itemId } = req.query as Record<string, string | undefined>;
      if (!warehouseId || !itemId) {
        sendError(res, 400, 'warehouseId and itemId query params are required');
        return;
      }
      const resolved = resolveWarehouseScope(req, warehouseId);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const data = await getAvailable(resolved!, itemId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /by-demand — Allocations for a demand document ──────────────────
router.get(
  '/by-demand',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { demandDocType, demandDocId } = req.query as Record<string, string | undefined>;
      if (!demandDocType || !demandDocId) {
        sendError(res, 400, 'demandDocType and demandDocId query params are required');
        return;
      }
      const data = await getByDemand(demandDocType, demandDocId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /stats — Allocation statistics ──────────────────────────────────
router.get(
  '/stats',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const data = await getStats(resolved);
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
      const { status, demandDocType, demandDocId, page, pageSize } = req.query as Record<string, string | undefined>;
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const result = await getAllocations({
        warehouseId: resolved,
        status,
        demandDocType,
        demandDocId,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — Create single allocation ───────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  validate(allocateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await allocate(req.body);

      await createAuditLog({
        tableName: 'wms_stock_allocations',
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

// ── POST /bulk — Bulk FIFO allocation ───────────────────────────────────
router.post(
  '/bulk',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  validate(bulkAllocateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { demandDocType, demandDocId, warehouseId, lines } = req.body;
      const records = await bulkAllocate(demandDocType, demandDocId, lines, warehouseId);

      await createAuditLog({
        tableName: 'wms_stock_allocations',
        recordId: demandDocId,
        action: 'bulk_allocate',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, records);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/release — Release allocation ─────────────────────────────
router.patch(
  '/:id/release',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await release(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_stock_allocations',
        recordId: req.params.id as string,
        action: 'release',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/pick — Confirm pick ──────────────────────────────────────
router.patch(
  '/:id/pick',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await confirmPick(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_stock_allocations',
        recordId: req.params.id as string,
        action: 'pick',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/cancel — Cancel allocation ───────────────────────────────
router.patch(
  '/:id/cancel',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await cancel(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_stock_allocations',
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
