/**
 * License Plate Number (LPN) Routes — V2
 * REST endpoints for LPN lifecycle: create, receive, store, pick, pack, ship, dissolve.
 * Also manages LPN contents and location moves.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NotFoundError } from '@nit-scs-v2/shared';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { createAuditLog } from '../../audit/services/audit.service.js';
import { clientIp } from '../../../utils/helpers.js';
import { buildScopeFilter } from '../../../utils/scope-filter.js';
import {
  createLpn,
  getLpnById,
  getLpns,
  receiveLpn,
  storeLpn,
  pickLpn,
  packLpn,
  shipLpn,
  dissolveLpn,
  moveLpn,
  addContent,
  removeContent,
  getStats,
} from '../services/lpn.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createLpnSchema = z.object({
  lpnNumber: z.string().min(1).max(30),
  warehouseId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  binId: z.string().uuid().optional(),
  lpnType: z.enum(['pallet', 'carton', 'tote', 'crate', 'mixed']),
  parentLpnId: z.string().uuid().optional(),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  sourceDocType: z.string().max(20).optional(),
  sourceDocId: z.string().uuid().optional(),
});

const moveLpnSchema = z.object({
  zoneId: z.string().uuid().optional(),
  binId: z.string().uuid().optional(),
});

const addContentSchema = z.object({
  itemId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  uomId: z.string().uuid().optional(),
  expiryDate: z.string().datetime().optional(),
});

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

// ── GET / — Paginated list ──────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, lpnType, page, pageSize } = req.query as Record<string, string | undefined>;
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const warehouseId = resolved;
      const result = await getLpns({
        warehouseId,
        status,
        lpnType,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /stats — LPN statistics ─────────────────────────────────────────
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

// ── GET /:id — Single LPN detail ────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getLpnById(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── POST / — Create an LPN ──────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  validate(createLpnSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await createLpn(req.body);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
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

// ── PATCH /:id/move — Move LPN to new location ─────────────────────────
router.patch(
  '/:id/move',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  validate(moveLpnSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await moveLpn(req.params.id as string, req.body);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── PATCH /:id/receive — Transition: created → in_receiving ────────────
router.patch(
  '/:id/receive',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await receiveLpn(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith('Cannot')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── PATCH /:id/store — Transition: in_receiving → stored ───────────────
router.patch(
  '/:id/store',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await storeLpn(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith('Cannot')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── PATCH /:id/pick — Transition: stored → in_picking ──────────────────
router.patch(
  '/:id/pick',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await pickLpn(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith('Cannot')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── PATCH /:id/pack — Transition: in_picking → in_packing ─────────────
router.patch(
  '/:id/pack',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await packLpn(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith('Cannot')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── PATCH /:id/ship — Transition: in_packing → shipped ────────────────
router.patch(
  '/:id/ship',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await shipLpn(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith('Cannot')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── PATCH /:id/dissolve — Transition: any (except shipped) → dissolved ─
router.patch(
  '/:id/dissolve',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await dissolveLpn(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_LICENSE_PLATES',
        recordId: req.params.id as string,
        action: 'update',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith('Cannot')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── POST /:id/contents — Add content to an LPN ─────────────────────────
router.post(
  '/:id/contents',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  validate(addContentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body };
      if (body.expiryDate) body.expiryDate = new Date(body.expiryDate);

      const record = await addContent(req.params.id as string, body);

      await createAuditLog({
        tableName: 'WMS_LPN_CONTENTS',
        recordId: record.id,
        action: 'create',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, record);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      next(err);
    }
  },
);

// ── DELETE /contents/:contentId — Remove content from an LPN ────────────
router.delete(
  '/contents/:contentId',
  authenticate,
  requirePermission('warehouse_zone', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await removeContent(req.params.contentId as string);

      await createAuditLog({
        tableName: 'WMS_LPN_CONTENTS',
        recordId: req.params.contentId as string,
        action: 'delete',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, { deleted: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendError(res, 404, err.message);
        return;
      }
      next(err);
    }
  },
);

export default router;
