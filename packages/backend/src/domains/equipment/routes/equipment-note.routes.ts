/**
 * Equipment Delivery & Return Note Routes — V2 (SOW M2-F02)
 *
 * Delivery Notes:
 *   GET    /equipment-notes/delivery          — list delivery notes
 *   GET    /equipment-notes/delivery/:id       — get delivery note detail
 *   POST   /equipment-notes/delivery          — create delivery note
 *   PUT    /equipment-notes/delivery/:id       — update draft delivery note
 *   POST   /equipment-notes/delivery/:id/confirm — confirm delivery
 *   POST   /equipment-notes/delivery/:id/cancel  — cancel delivery
 *
 * Return Notes:
 *   GET    /equipment-notes/return            — list return notes
 *   GET    /equipment-notes/return/:id         — get return note detail
 *   POST   /equipment-notes/return            — create return note
 *   PUT    /equipment-notes/return/:id         — update draft return note
 *   POST   /equipment-notes/return/:id/inspect — inspect return
 *   POST   /equipment-notes/return/:id/confirm — confirm return (calculates cost)
 *   POST   /equipment-notes/return/:id/dispute — dispute return
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { paginate } from '../../../middleware/pagination.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import { auditAndEmit } from '../../../utils/routeHelpers.js';
import {
  equipmentDeliveryNoteCreateSchema,
  equipmentDeliveryNoteUpdateSchema,
  equipmentReturnNoteCreateSchema,
  equipmentReturnNoteUpdateSchema,
} from '../../../schemas/document.schema.js';
import * as svc from '../services/equipment-note.service.js';

const router = Router();

const WRITE_ROLES = ['admin', 'manager', 'logistics_coordinator', 'warehouse_supervisor', 'transport_supervisor'];
const APPROVE_ROLES = ['admin', 'manager', 'logistics_coordinator'];

// ═════════════════════════════════════════════════════════════════════════════
// DELIVERY NOTES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /delivery — list ──────────────────────────────────────────────────
router.get(
  '/delivery',
  authenticate,
  paginate('createdAt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
      const extra: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (['page', 'pageSize', 'sortBy', 'sortDir', 'search'].includes(key)) continue;
        if (value && typeof value === 'string') extra[key] = value;
      }

      const { data, total } = await svc.listDeliveryNotes({ skip, pageSize, sortBy, sortDir, search, ...extra });
      sendSuccess(res, data, { page, pageSize, total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /delivery/:id — detail ────────────────────────────────────────────
router.get('/delivery/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await svc.getDeliveryNoteById(req.params.id as string);
    sendSuccess(res, note);
  } catch (err) {
    next(err);
  }
});

// ── POST /delivery — create ──────────────────────────────────────────────
router.post(
  '/delivery',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(equipmentDeliveryNoteCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await svc.createDeliveryNote(req.body, req.user!.userId);
      await auditAndEmit(req, {
        action: 'create',
        tableName: 'equipment_delivery_notes',
        recordId: result.id,
        newValues: req.body,
        entityEvent: 'created',
        entityName: 'equipment_delivery_note',
      });
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /delivery/:id — update draft ─────────────────────────────────────
router.put(
  '/delivery/:id',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(equipmentDeliveryNoteUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { existing, updated } = await svc.updateDeliveryNote(req.params.id as string, req.body);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_delivery_notes',
        recordId: req.params.id as string,
        oldValues: existing as Record<string, unknown>,
        newValues: req.body,
        entityEvent: 'updated',
        entityName: 'equipment_delivery_note',
      });
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /delivery/:id/confirm ───────────────────────────────────────────
router.post(
  '/delivery/:id/confirm',
  authenticate,
  requireRole(...APPROVE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await svc.confirmDeliveryNote(req.params.id as string, req.user!.userId);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_delivery_notes',
        recordId: req.params.id as string,
        newValues: { status: 'confirmed' },
        socketEvent: 'equipment_delivery_note:confirmed',
        docType: 'equipment_delivery_note',
        socketData: { id: req.params.id, status: 'confirmed' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /delivery/:id/cancel ────────────────────────────────────────────
router.post(
  '/delivery/:id/cancel',
  authenticate,
  requireRole(...APPROVE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await svc.cancelDeliveryNote(req.params.id as string, req.user!.userId);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_delivery_notes',
        recordId: req.params.id as string,
        newValues: { status: 'cancelled' },
        socketEvent: 'equipment_delivery_note:cancelled',
        docType: 'equipment_delivery_note',
        socketData: { id: req.params.id, status: 'cancelled' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// RETURN NOTES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /return — list ───────────────────────────────────────────────────
router.get('/return', authenticate, paginate('createdAt'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (['page', 'pageSize', 'sortBy', 'sortDir', 'search'].includes(key)) continue;
      if (value && typeof value === 'string') extra[key] = value;
    }

    const { data, total } = await svc.listReturnNotes({ skip, pageSize, sortBy, sortDir, search, ...extra });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /return/:id — detail ─────────────────────────────────────────────
router.get('/return/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await svc.getReturnNoteById(req.params.id as string);
    sendSuccess(res, note);
  } catch (err) {
    next(err);
  }
});

// ── POST /return — create ────────────────────────────────────────────────
router.post(
  '/return',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(equipmentReturnNoteCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await svc.createReturnNote(req.body, req.user!.userId);
      await auditAndEmit(req, {
        action: 'create',
        tableName: 'equipment_return_notes',
        recordId: result.id,
        newValues: req.body,
        entityEvent: 'created',
        entityName: 'equipment_return_note',
      });
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /return/:id — update draft ───────────────────────────────────────
router.put(
  '/return/:id',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(equipmentReturnNoteUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { existing, updated } = await svc.updateReturnNote(req.params.id as string, req.body);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_return_notes',
        recordId: req.params.id as string,
        oldValues: existing as Record<string, unknown>,
        newValues: req.body,
        entityEvent: 'updated',
        entityName: 'equipment_return_note',
      });
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /return/:id/inspect — mark as inspected ─────────────────────────
router.post(
  '/return/:id/inspect',
  authenticate,
  requireRole(...APPROVE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await svc.inspectReturnNote(req.params.id as string, req.user!.userId);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_return_notes',
        recordId: req.params.id as string,
        newValues: { status: 'inspected' },
        socketEvent: 'equipment_return_note:inspected',
        docType: 'equipment_return_note',
        socketData: { id: req.params.id, status: 'inspected' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /return/:id/confirm — confirm return (calculates cost) ──────────
router.post(
  '/return/:id/confirm',
  authenticate,
  requireRole(...APPROVE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await svc.confirmReturnNote(req.params.id as string, req.user!.userId);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_return_notes',
        recordId: req.params.id as string,
        newValues: { status: 'confirmed' },
        socketEvent: 'equipment_return_note:confirmed',
        docType: 'equipment_return_note',
        socketData: { id: req.params.id, status: 'confirmed' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /return/:id/dispute — flag dispute ──────────────────────────────
router.post(
  '/return/:id/dispute',
  authenticate,
  requireRole(...WRITE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = (req.body ?? {}) as { reason?: string };
      const result = await svc.disputeReturnNote(req.params.id as string, req.user!.userId, reason);
      await auditAndEmit(req, {
        action: 'update',
        tableName: 'equipment_return_notes',
        recordId: req.params.id as string,
        newValues: { status: 'disputed', reason },
        socketEvent: 'equipment_return_note:disputed',
        docType: 'equipment_return_note',
        socketData: { id: req.params.id, status: 'disputed' },
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
