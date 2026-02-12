import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendError } from '../utils/response.js';
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
    const { actions } = req.body;
    if (!Array.isArray(actions)) {
      sendError(res, 400, 'actions must be an array of permission strings');
      return;
    }
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
    const permissions = req.body;
    if (typeof permissions !== 'object' || Array.isArray(permissions)) {
      sendError(res, 400, 'Body must be an object: { resource: actions[] }');
      return;
    }
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
