import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { paginate } from '../middleware/pagination.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import { buildScopeFilter, canAccessRecord } from '../utils/scope-filter.js';
import { sendError } from '../utils/response.js';
import * as svc from '../services/dynamic-document.service.js';
import { getDocumentTypeByCode } from '../services/dynamic-document-type.service.js';

const router = Router();

const scopeMapping = { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'createdById' };

// ── Permission config helpers ──────────────────────────────────────────

interface PermissionConfig {
  createRoles?: string[];
  viewRoles?: string[];
  approveRoles?: string[];
}

function parsePermissionConfig(raw: unknown): PermissionConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as PermissionConfig;
}

function hasRoleAccess(userRole: string, allowedRoles: string[] | undefined): boolean {
  // Admin always has access
  if (userRole === 'admin') return true;
  // If no roles configured, allow all authenticated users (backwards compatible)
  if (!allowedRoles || allowedRoles.length === 0) return true;
  // Wildcard allows everyone
  if (allowedRoles.includes('*')) return true;
  return allowedRoles.includes(userRole);
}

// ── List documents by type code ──────────────────────────────────────
router.get(
  '/:typeCode',
  authenticate,
  paginate('createdAt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const typeCode = req.params.typeCode as string;

      // RBAC: check viewRoles from permissionConfig
      const docType = await getDocumentTypeByCode(typeCode);
      const permissions = parsePermissionConfig(docType.permissionConfig);
      if (!hasRoleAccess(req.user!.systemRole, permissions.viewRoles)) {
        sendError(res, 403, 'You do not have permission to view documents of this type');
        return;
      }

      const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;
      const scopeFilter = buildScopeFilter(req.user!, scopeMapping);

      const { data, total } = await svc.listDocuments(typeCode, {
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

    // RBAC: check viewRoles from permissionConfig
    const docTypeConfig = await getDocumentTypeByCode(typeCode);
    const permissions = parsePermissionConfig(docTypeConfig.permissionConfig);
    if (!hasRoleAccess(req.user!.systemRole, permissions.viewRoles)) {
      sendError(res, 403, 'You do not have permission to view documents of this type');
      return;
    }

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

    // RBAC: check createRoles from permissionConfig
    const docType = await getDocumentTypeByCode(typeCode);
    const permissions = parsePermissionConfig(docType.permissionConfig);
    if (!hasRoleAccess(req.user!.systemRole, permissions.createRoles)) {
      sendError(res, 403, 'You do not have permission to create documents of this type');
      return;
    }

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

    // RBAC: check createRoles from permissionConfig (create permission implies edit)
    const docTypeConfig = await getDocumentTypeByCode(typeCode);
    const permissions = parsePermissionConfig(docTypeConfig.permissionConfig);
    if (!hasRoleAccess(req.user!.systemRole, permissions.createRoles)) {
      sendError(res, 403, 'You do not have permission to edit documents of this type');
      return;
    }

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

    // RBAC: check approveRoles from permissionConfig
    const docTypeConfig = await getDocumentTypeByCode(typeCode);
    const permissions = parsePermissionConfig(docTypeConfig.permissionConfig);
    if (!hasRoleAccess(req.user!.systemRole, permissions.approveRoles)) {
      sendError(res, 403, 'You do not have permission to transition documents of this type');
      return;
    }

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

// ── Approve document ────────────────────────────────────────────────
router.post('/:typeCode/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeCode = req.params.typeCode as string;
    const { comments } = req.body as { comments?: string };

    // RBAC: check approveRoles from permissionConfig
    const docTypeConfig = await getDocumentTypeByCode(typeCode);
    const permissions = parsePermissionConfig(docTypeConfig.permissionConfig);
    if (!hasRoleAccess(req.user!.systemRole, permissions.approveRoles)) {
      sendError(res, 403, 'You do not have permission to approve documents of this type');
      return;
    }

    // Pre-check access
    const existingDoc = await svc.getDocumentById(req.params.id as string);
    if ((existingDoc.documentType as { code?: string } | undefined)?.code !== typeCode) {
      sendError(res, 404, 'Document not found for the specified type');
      return;
    }

    const result = await svc.approveDocument(typeCode, req.params.id as string, req.user!.userId, comments);

    await auditAndEmit(req, {
      action: 'update',
      tableName: 'dynamic_documents',
      recordId: req.params.id as string,
      newValues: {
        approvedLevel: result.approvedLevel,
        allApproved: result.allApproved,
      },
      socketEvent: `dyn:${typeCode}:approval`,
      docType: `dyn:${typeCode}`,
      socketData: {
        id: req.params.id,
        approvedLevel: result.approvedLevel,
        allApproved: result.allApproved,
        remainingLevels: result.remainingLevels,
      },
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

    // RBAC: check viewRoles from permissionConfig
    const docTypeConfig = await getDocumentTypeByCode(typeCode);
    const permissionsConfig = parsePermissionConfig(docTypeConfig.permissionConfig);
    if (!hasRoleAccess(req.user!.systemRole, permissionsConfig.viewRoles)) {
      sendError(res, 403, 'You do not have permission to view documents of this type');
      return;
    }

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
