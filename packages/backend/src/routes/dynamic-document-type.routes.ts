import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { paginate } from '../middleware/pagination.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import * as svc from '../services/dynamic-document-type.service.js';

const router = Router();

// ── List all document types ──────────────────────────────────────────
router.get('/', authenticate, paginate('name'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
    const { data, total } = await svc.listDocumentTypes({
      skip,
      pageSize,
      sortBy,
      sortDir,
      search,
      category: req.query.category as string | undefined,
      isActive: req.query.isActive as string | undefined,
    });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── Get active types for sidebar navigation ──────────────────────────
router.get('/active', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.systemRole;
    const types = await svc.getActiveTypesForRole(role);
    sendSuccess(res, types);
  } catch (err) {
    next(err);
  }
});

// ── Get by ID ────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docType = await svc.getDocumentTypeById(req.params.id as string);
    sendSuccess(res, docType);
  } catch (err) {
    next(err);
  }
});

// ── Create ───────────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.createDocumentType(req.body, req.user!.userId);
    await auditAndEmit(req, {
      action: 'create',
      tableName: 'dynamic_document_types',
      recordId: result.id,
      newValues: req.body,
      entityEvent: 'created',
      entityName: 'dynamic_document_type',
    });
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// ── Update ───────────────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { existing, updated } = await svc.updateDocumentType(req.params.id as string, req.body);
    await auditAndEmit(req, {
      action: 'update',
      tableName: 'dynamic_document_types',
      recordId: req.params.id as string,
      oldValues: existing as Record<string, unknown>,
      newValues: req.body,
      entityEvent: 'updated',
      entityName: 'dynamic_document_type',
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── Delete ───────────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteDocumentType(req.params.id as string);
    await auditAndEmit(req, {
      action: 'delete',
      tableName: 'dynamic_document_types',
      recordId: req.params.id as string,
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

// ── Add field to type ────────────────────────────────────────────────
router.post(
  '/:id/fields',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const field = await svc.addField(req.params.id as string, req.body);
      sendCreated(res, field);
    } catch (err) {
      next(err);
    }
  },
);

// ── Update field ─────────────────────────────────────────────────────
router.put(
  '/:id/fields/:fieldId',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const field = await svc.updateField(req.params.fieldId as string, req.body);
      sendSuccess(res, field);
    } catch (err) {
      next(err);
    }
  },
);

// ── Delete field ─────────────────────────────────────────────────────
router.delete(
  '/:id/fields/:fieldId',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await svc.deleteField(req.params.fieldId as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Reorder fields ───────────────────────────────────────────────────
router.post(
  '/:id/fields/reorder',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fieldIds } = req.body as { fieldIds: string[] };
      await svc.reorderFields(req.params.id as string, fieldIds);
      sendSuccess(res, { reordered: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
