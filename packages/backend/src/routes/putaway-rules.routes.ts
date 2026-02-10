/**
 * Put-Away Rules Routes — V2
 * CRUD for put-away rules + suggestion endpoint.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendNoContent, sendError } from '../utils/response.js';
import { createAuditLog } from '../services/audit.service.js';
import { clientIp } from '../utils/helpers.js';
import { putAwayRuleCreateSchema, putAwayRuleUpdateSchema } from '../schemas/document.schema.js';
import {
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  suggestPutAwayLocation,
} from '../services/putaway-rules.service.js';

const router = Router();

// ── GET / — List rules (optional ?warehouseId filter) ────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const data = await listRules(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /suggest — Get put-away suggestions for an item ──────────────────
router.get('/suggest', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, warehouseId } = req.query as { itemId?: string; warehouseId?: string };
    if (!itemId || !warehouseId) {
      sendError(res, 400, 'itemId and warehouseId query params are required');
      return;
    }
    const suggestions = await suggestPutAwayLocation(itemId, warehouseId);
    sendSuccess(res, suggestions);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get single rule ───────────────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await getRuleById(req.params.id as string);
    sendSuccess(res, rule);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create rule (admin / warehouse_supervisor) ──────────────────
router.post(
  '/',
  authenticate,
  requireRole('admin', 'warehouse_supervisor'),
  validate(putAwayRuleCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await createRule(req.body);

      await createAuditLog({
        tableName: 'put_away_rules',
        recordId: rule.id,
        action: 'create',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, rule);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /:id — Update rule ───────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'warehouse_supervisor'),
  validate(putAwayRuleUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await updateRule(req.params.id as string, req.body);

      await createAuditLog({
        tableName: 'put_away_rules',
        recordId: req.params.id as string,
        action: 'update',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, rule);
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /:id — Delete rule ────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'warehouse_supervisor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteRule(req.params.id as string);

      await createAuditLog({
        tableName: 'put_away_rules',
        recordId: req.params.id as string,
        action: 'delete',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
