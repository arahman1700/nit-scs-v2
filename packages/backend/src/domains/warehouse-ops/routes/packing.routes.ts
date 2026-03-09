import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError, sendCreated } from '../../../utils/response.js';
import { buildScopeFilter } from '../../../utils/scope-filter.js';
import * as packingService from '../services/packing.service.js';

const router = Router();

// ── GET / — Packing queue (approved MIs awaiting packing) ───────────────
router.get(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Row-level security: enforce warehouse scope for restricted roles
      const scopeFilter = buildScopeFilter(req.user!, { warehouseField: 'warehouseId' });
      const scopedWarehouseId = scopeFilter.warehouseId as string | undefined;
      const warehouseId = scopedWarehouseId ?? (req.query.warehouseId as string);
      if (!warehouseId) {
        sendError(res, 400, 'warehouseId is required');
        return;
      }
      if (scopedWarehouseId && req.query.warehouseId && req.query.warehouseId !== scopedWarehouseId) {
        sendError(res, 403, 'You do not have access to this warehouse');
        return;
      }
      const queue = await packingService.getPackingQueue(warehouseId);
      sendSuccess(res, queue);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Session detail ───────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await packingService.getSessionById(req.params.id as string);
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — Create packing session ────────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mirvId, packedById, warehouseId } = req.body;
      if (!mirvId || !packedById || !warehouseId) {
        sendError(res, 400, 'mirvId, packedById, and warehouseId are required');
        return;
      }
      const session = await packingService.createSession(mirvId, packedById, warehouseId);
      sendCreated(res, session);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/lines — Add a packing line ───────────────────────────────
router.post(
  '/:id/lines',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId, qtyPacked, containerType, containerLabel, weight, volume, scannedBarcode } = req.body;
      if (!itemId || qtyPacked === undefined || !containerType) {
        sendError(res, 400, 'itemId, qtyPacked, and containerType are required');
        return;
      }
      const line = await packingService.addPackingLine(req.params.id as string, {
        itemId,
        qtyPacked: Number(qtyPacked),
        containerType,
        containerLabel,
        weight: weight !== undefined ? Number(weight) : undefined,
        volume: volume !== undefined ? Number(volume) : undefined,
        scannedBarcode,
      });
      sendCreated(res, line);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/complete — Complete a packing session ────────────────────
router.post(
  '/:id/complete',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await packingService.completeSession(req.params.id as string);
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/cancel — Cancel a packing session ───────────────────────
router.post(
  '/:id/cancel',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await packingService.cancelSession(req.params.id as string);
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
