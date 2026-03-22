import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import {
  getAllPermissions,
  getPermissionsForRole,
  updatePermission,
  updateRolePermissions,
  resetToDefaults,
} from '../services/permission.service.js';

const router = Router();

// GET /api/permissions — all role permissions (cached)
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const data = await getAllPermissions();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /api/permissions/:role — permissions for a specific role
router.get('/:role', authenticate, async (req, res, next) => {
  try {
    const role = req.params.role as string;
    const data = await getPermissionsForRole(role);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/permissions/:role/:resource — update a single role+resource permission
router.put('/:role/:resource', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const role = req.params.role as string;
    const resource = req.params.resource as string;
    const permSchema = z.object({
      actions: z.array(z.enum(['read', 'create', 'update', 'delete', 'approve', 'export', 'import'])).min(0),
    });
    const parsed = permSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Invalid actions: must be an array of valid permission strings');
      return;
    }
    const { actions } = parsed.data;
    await updatePermission(role, resource, actions, req.user?.userId);
    sendSuccess(res, { role, resource, actions });
  } catch (err) {
    next(err);
  }
});

// PUT /api/permissions/:role — bulk update all permissions for a role
router.put('/:role', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const role = req.params.role as string;
    const bulkSchema = z.record(
      z.string().min(1).max(100),
      z.array(z.enum(['read', 'create', 'update', 'delete', 'approve', 'export', 'import'])),
    );
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Body must be { resource: validActions[] }');
      return;
    }
    const permissions = parsed.data;
    await updateRolePermissions(role, permissions, req.user?.userId);
    const updated = await getPermissionsForRole(role);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/permissions/reset — reset to defaults (admin-only)
router.post('/reset', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body || {};
    await resetToDefaults(role);
    const data = await getAllPermissions();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
