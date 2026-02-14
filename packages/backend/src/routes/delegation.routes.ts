import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import {
  createDelegation,
  listDelegations,
  getDelegation,
  updateDelegation,
  deleteDelegation,
  toggleDelegation,
} from '../services/delegation.service.js';
import { createDelegationSchema, updateDelegationSchema } from '../schemas/delegation.schema.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

const ADMIN_ROLES = ['admin', 'manager'];

/**
 * GET /delegations
 * List delegation rules. Admin sees all, others see only their own.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10)));
    const activeOnly = req.query.activeOnly === 'true';

    const isPrivileged = ADMIN_ROLES.includes(req.user!.systemRole);
    const userId = isPrivileged ? undefined : req.user!.userId;

    const result = await listDelegations({ userId, page, pageSize, activeOnly });

    sendSuccess(res, result.delegations, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /delegations/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const delegation = await getDelegation(id);
    if (!delegation) {
      sendError(res, 404, 'Delegation rule not found');
      return;
    }

    // Non-admin can only see their own
    const isPrivileged = ADMIN_ROLES.includes(req.user!.systemRole);
    if (!isPrivileged && delegation.delegatorId !== req.user!.userId && delegation.delegateId !== req.user!.userId) {
      sendError(res, 403, 'Not authorized');
      return;
    }

    sendSuccess(res, delegation);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /delegations
 * Create delegation. Admin creates for anyone, others only for themselves.
 */
router.post(
  '/',
  authenticate,
  validate(createDelegationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const isPrivileged = ADMIN_ROLES.includes(req.user!.systemRole);

      // Non-admin can only delegate their own authority
      const delegatorId = isPrivileged && req.body.delegatorId ? (req.body.delegatorId as string) : userId;

      const delegation = await createDelegation({
        delegatorId,
        delegateId: req.body.delegateId,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        scope: req.body.scope,
        notes: req.body.notes,
      });

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'delegation_rules',
        recordId: delegation.id,
        newValues: { delegatorId, delegateId: req.body.delegateId, scope: req.body.scope },
        entityEvent: 'created',
        entityName: 'delegations',
      });

      sendCreated(res, delegation);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /delegations/:id
 */
router.put(
  '/:id',
  authenticate,
  validate(updateDelegationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;

      const existing = await getDelegation(id);
      if (!existing) {
        sendError(res, 404, 'Delegation rule not found');
        return;
      }

      const isPrivileged = ADMIN_ROLES.includes(req.user!.systemRole);
      if (!isPrivileged && existing.delegatorId !== userId) {
        sendError(res, 403, 'Not authorized to edit this delegation');
        return;
      }

      const updated = await updateDelegation(id, req.body);
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /delegations/:id/toggle
 * Toggle active/inactive.
 */
router.post('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const existing = await getDelegation(id);
    if (!existing) {
      sendError(res, 404, 'Delegation rule not found');
      return;
    }

    const isPrivileged = ADMIN_ROLES.includes(req.user!.systemRole);
    if (!isPrivileged && existing.delegatorId !== userId) {
      sendError(res, 403, 'Not authorized');
      return;
    }

    const toggled = await toggleDelegation(id);
    sendSuccess(res, toggled);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /delegations/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const existing = await getDelegation(id);
    if (!existing) {
      sendError(res, 404, 'Delegation rule not found');
      return;
    }

    const isPrivileged = ADMIN_ROLES.includes(req.user!.systemRole);
    if (!isPrivileged && existing.delegatorId !== userId) {
      sendError(res, 403, 'Not authorized to delete this delegation');
      return;
    }

    await deleteDelegation(id);

    await auditAndEmit(req, {
      action: 'delete',
      tableName: 'delegation_rules',
      recordId: id,
      oldValues: { delegatorId: existing.delegatorId, delegateId: existing.delegateId },
      entityEvent: 'deleted',
      entityName: 'delegations',
    });

    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

export default router;
