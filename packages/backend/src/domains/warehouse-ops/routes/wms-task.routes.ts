/**
 * WMS Task Queue Routes — V2
 * REST endpoints for task lifecycle: create, assign, start, complete, cancel, hold, resume.
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
import { buildScopeFilter } from '../../../utils/scope-filter.js';

import {
  createTask,
  getTaskById,
  getTasks,
  assignTask,
  startTask,
  completeTask,
  cancelTask,
  holdTask,
  resumeTask,
  getMyTasks,
  getStats,
  bulkAssign,
} from '../services/wms-task.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  taskNumber: z.string().max(30),
  warehouseId: z.string().uuid(),
  taskType: z.enum(['receive', 'putaway', 'pick', 'pack', 'replenish', 'count', 'move', 'load', 'unload']),
  priority: z.number().int().min(1).max(5).optional(),
  assignedToId: z.string().uuid().optional(),
  sourceDocType: z.string().max(20).optional(),
  sourceDocId: z.string().uuid().optional(),
  fromZoneId: z.string().uuid().optional(),
  fromBinId: z.string().uuid().optional(),
  toZoneId: z.string().uuid().optional(),
  toBinId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  lpnId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
  estimatedMins: z.number().positive().optional(),
  notes: z.string().optional(),
});

const assignSchema = z.object({
  employeeId: z.string().uuid(),
});

const bulkAssignSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  employeeId: z.string().uuid(),
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

// ── GET /stats — Task statistics ─────────────────────────────────────────
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

// ── GET /my-tasks — Tasks for the logged-in user ─────────────────────────
router.get('/my-tasks', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = (req.query.employeeId as string) || req.user?.userId;
    if (!employeeId) {
      sendError(res, 400, 'employeeId is required');
      return;
    }
    const status = req.query.status as string | undefined;
    const data = await getMyTasks(employeeId, status);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET / — Paginated list with filters ──────────────────────────────────
router.get(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, taskType, assignedToId, priority, page, pageSize } = req.query as Record<
        string,
        string | undefined
      >;
      const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
      if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
      const result = await getTasks({
        warehouseId: resolved,
        status,
        taskType,
        assignedToId,
        priority: priority ? Number(priority) : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:id — Single task detail ────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requirePermission('warehouse_zone', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getTaskById(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST / — Create a task ───────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('warehouse_zone', 'create'),
  validate(createTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await createTask(req.body);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
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

// ── PATCH /:id/assign — Assign to employee ───────────────────────────────
router.patch(
  '/:id/assign',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  validate(assignSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await assignTask(req.params.id as string, req.body.employeeId);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
        recordId: req.params.id as string,
        action: 'assign',
        newValues: { assignedToId: req.body.employeeId },
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/start — Start task ────────────────────────────────────────
router.patch(
  '/:id/start',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await startTask(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
        recordId: req.params.id as string,
        action: 'start',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/complete — Complete task ──────────────────────────────────
router.patch(
  '/:id/complete',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await completeTask(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
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

// ── PATCH /:id/cancel — Cancel task ──────────────────────────────────────
router.patch(
  '/:id/cancel',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await cancelTask(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
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

// ── PATCH /:id/hold — Put on hold ────────────────────────────────────────
router.patch(
  '/:id/hold',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await holdTask(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
        recordId: req.params.id as string,
        action: 'hold',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/resume — Resume from hold ─────────────────────────────────
router.patch(
  '/:id/resume',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await resumeTask(req.params.id as string);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
        recordId: req.params.id as string,
        action: 'resume',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /bulk-assign — Batch assign tasks ───────────────────────────────
router.post(
  '/bulk-assign',
  authenticate,
  requirePermission('warehouse_zone', 'update'),
  validate(bulkAssignSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskIds, employeeId } = req.body;
      const records = await bulkAssign(taskIds, employeeId);

      await createAuditLog({
        tableName: 'WMS_TASK_QUEUE',
        recordId: taskIds.join(','),
        action: 'bulk_assign',
        newValues: { taskIds, employeeId },
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, records);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
