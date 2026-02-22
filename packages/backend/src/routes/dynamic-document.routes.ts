import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { paginate } from '../middleware/pagination.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import { buildScopeFilter, canAccessRecord } from '../utils/scope-filter.js';
import { sendError } from '../utils/response.js';
import * as svc from '../services/dynamic-document.service.js';

const router = Router();

const scopeMapping = { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'createdById' };

// ── List documents by type code ──────────────────────────────────────
router.get(
  '/:typeCode',
  authenticate,
  paginate('createdAt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
      const scopeFilter = buildScopeFilter(req.user!, scopeMapping);

      const { data, total } = await svc.listDocuments(req.params.typeCode as string, {
        skip,
        pageSize,
        sortBy,
        sortDir,
        search,
        status: req.query.status as string | undefined,
        ...scopeFilter,
      });
      sendSuccess(res, data, { page, pageSize, total });
    } catch (err) {
      next(err);
    }
  },
);

// ── Get document by ID ───────────────────────────────────────────────
router.get('/:typeCode/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeCode = req.params.typeCode as string;
    const doc = await svc.getDocumentById(req.params.id as string);
    if ((doc.documentType as { code?: string } | undefined)?.code !== typeCode) {
      sendError(res, 404, 'Document not found for the specified type');
      return;
    }
    if (!canAccessRecord(req.user!, doc as unknown as Record<string, unknown>, scopeMapping)) {
      sendError(res, 403, 'You do not have access to this record');
      return;
    }
    sendSuccess(res, doc);
  } catch (err) {
    next(err);
  }
});

// ── Create document ──────────────────────────────────────────────────
router.post('/:typeCode', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeCode = req.params.typeCode as string;
    const result = await svc.createDocument(typeCode, req.body, req.user!.userId);

    await auditAndEmit(req, {
      action: 'create',
      tableName: 'dynamic_documents',
      recordId: result.id,
      newValues: { typeCode, ...req.body },
      entityEvent: 'created',
      entityName: `dyn:${typeCode}`,
      docType: `dyn:${typeCode}`,
    });

    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
});

// ── Update document ──────────────────────────────────────────────────
router.put('/:typeCode/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeCode = req.params.typeCode as string;
    const existingDoc = await svc.getDocumentById(req.params.id as string);
    if ((existingDoc.documentType as { code?: string } | undefined)?.code !== typeCode) {
      sendError(res, 404, 'Document not found for the specified type');
      return;
    }
    if (!canAccessRecord(req.user!, existingDoc as unknown as Record<string, unknown>, scopeMapping)) {
      sendError(res, 403, 'You do not have access to this record');
      return;
    }
    const { existing, updated } = await svc.updateDocument(req.params.id as string, req.body, req.user!.userId);

    await auditAndEmit(req, {
      action: 'update',
      tableName: 'dynamic_documents',
      recordId: req.params.id as string,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: req.body,
      entityEvent: 'updated',
      entityName: `dyn:${typeCode}`,
      docType: `dyn:${typeCode}`,
    });

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// ── Transition status ────────────────────────────────────────────────
router.post('/:typeCode/:id/transition', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeCode = req.params.typeCode as string;
    const { targetStatus, comment } = req.body as { targetStatus: string; comment?: string };

    // Pre-check access
    const existingDoc = await svc.getDocumentById(req.params.id as string);
    if ((existingDoc.documentType as { code?: string } | undefined)?.code !== typeCode) {
      sendError(res, 404, 'Document not found for the specified type');
      return;
    }
    if (!canAccessRecord(req.user!, existingDoc as unknown as Record<string, unknown>, scopeMapping)) {
      sendError(res, 403, 'You do not have access to this record');
      return;
    }

    const result = await svc.transitionDocument(
      typeCode,
      req.params.id as string,
      targetStatus,
      req.user!.userId,
      comment,
    );

    await auditAndEmit(req, {
      action: 'update',
      tableName: 'dynamic_documents',
      recordId: req.params.id as string,
      newValues: { status: targetStatus },
      socketEvent: `dyn:${typeCode}:${targetStatus}`,
      docType: `dyn:${typeCode}`,
      socketData: { id: req.params.id, status: targetStatus, from: existingDoc.status, to: targetStatus },
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── Get document history ─────────────────────────────────────────────
router.get('/:typeCode/:id/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeCode = req.params.typeCode as string;
    const existingDoc = await svc.getDocumentById(req.params.id as string);
    if ((existingDoc.documentType as { code?: string } | undefined)?.code !== typeCode) {
      sendError(res, 404, 'Document not found for the specified type');
      return;
    }
    if (!canAccessRecord(req.user!, existingDoc as unknown as Record<string, unknown>, scopeMapping)) {
      sendError(res, 403, 'You do not have access to this record');
      return;
    }
    const history = await svc.getDocumentHistory(req.params.id as string);
    sendSuccess(res, history);
  } catch (err) {
    next(err);
  }
});

export default router;
