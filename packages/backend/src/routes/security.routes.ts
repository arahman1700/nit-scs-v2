// ---------------------------------------------------------------------------
// Security Routes — M6: Access Control & Security
// ---------------------------------------------------------------------------
// GET /security/dashboard      — admin/manager only
// GET /security/login-history/:employeeId — admin/manager or own history
// ---------------------------------------------------------------------------

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getSecurityDashboard, getLoginHistory } from '../services/security.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET /security/dashboard — Security dashboard metrics (admin/manager) ────

router.get('/dashboard', requireRole('admin', 'manager'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await getSecurityDashboard();
    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// ── GET /security/login-history/:employeeId — Login history ─────────────────
// Admin/manager can view any employee's history; others can only view their own.

router.get('/login-history/:employeeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.employeeId as string;
    const user = req.user!;

    // Non-admin/non-manager can only view their own login history
    const isAdminOrManager = user.systemRole === 'admin' || user.systemRole === 'manager';
    if (!isAdminOrManager && user.userId !== employeeId) {
      sendError(res, 403, 'Access denied. You can only view your own login history.');
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await getLoginHistory(employeeId, { page, pageSize });

    sendSuccess(res, result.data, {
      page,
      pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
