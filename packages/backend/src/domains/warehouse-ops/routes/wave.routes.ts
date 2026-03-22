/**
 * Wave Picking Routes — V2
 * REST endpoints for wave-based pick optimization.
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
  createWave,
  getWaveById,
  getWaves,
  addLines,
  confirmPick,
  release,
  startPicking,
  complete,
  cancel,
  getStats,
} from '../services/wave.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createWaveSchema = z.object({
  waveNumber: z.string().min(1).max(50),
  warehouseId: z.string().uuid(),
  waveType: z.enum(['manual', 'auto', 'priority']).optional(),
  createdById: z.string().uuid().optional(),
});

const addLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        mirvId: z.string().uuid(),
        mirvLineId: z.string().uuid().optional(),
        itemId: z.string().uuid(),
        qtyRequired: z.number().positive(),
        fromZoneId: z.string().uuid().optional(),
        fromBinId: z.string().uuid().optional(),
        lotId: z.string().uuid().optional(),
      }),
    )
    .min(1),
});

const confirmPickSchema = z.object({
  qtyPicked: z.number().min(0),
  pickedById: z.string().uuid(),
});

const router = Router();

function resolveWarehouseScope(req: Request, warehouseId: string | undefined) {
  return _resolveWarehouseScope(req.user!, warehouseId);
}

// ── GET /stats — Wave statistics ────────────────────────────────────────
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
      const { status, waveType, page, pageSize } = req.query as Record<string, string | undefined>;
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const result = await getWaves({
        warehouseId: resolved,
        status,
        waveType,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Single wave detail ───────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getWaveById(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — Create a wave ──────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  validate(createWaveSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await createWave(req.body);

      await createAuditLog({
        tableName: 'wms_wave_headers',
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

// ── POST /:id/lines — Add pick lines to a wave ─────────────────────────
router.post(
  '/:id/lines',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  validate(addLinesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addLines(req.params.id as string, req.body.lines);

      await createAuditLog({
        tableName: 'wms_wave_headers',
        recordId: req.params.id as string,
        action: 'add_lines',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/release — Release wave for picking ──────────────────────
router.patch(
  '/:id/release',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await release(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_wave_headers',
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

// ── PATCH /:id/start — Start picking ───────────────────────────────────
router.patch(
  '/:id/start',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await startPicking(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_wave_headers',
        recordId: req.params.id as string,
        action: 'start_picking',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/complete — Complete wave ────────────────────────────────
router.patch(
  '/:id/complete',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await complete(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_wave_headers',
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

// ── PATCH /:id/cancel — Cancel wave ────────────────────────────────────
router.patch(
  '/:id/cancel',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await cancel(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_wave_headers',
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

// ── PATCH /lines/:lineId/confirm — Confirm pick on a single line ──────
router.patch(
  '/lines/:lineId/confirm',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  validate(confirmPickSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await confirmPick(req.params.lineId as string, req.body);

      await createAuditLog({
        tableName: 'wms_wave_lines',
        recordId: req.params.lineId as string,
        action: 'confirm_pick',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
