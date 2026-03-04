// ---------------------------------------------------------------------------
// Cost Allocation Routes — L7
// ---------------------------------------------------------------------------
// GET /cost-allocation/summary      — all projects summary
// GET /cost-allocation/:projectId   — per-project breakdown
// ---------------------------------------------------------------------------

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';
import { cached, CacheTTL } from '../utils/cache.js';
import { getCostAllocation, getCostAllocationSummary } from '../services/cost-allocation.service.js';

const router = Router();

// All routes require authentication + specific roles
router.use(authenticate);
router.use(requireRole('admin', 'manager', 'finance_user', 'warehouse_supervisor'));

/** Parse optional date query params with validation */
function parseDateParams(req: Request): { dateFrom?: Date; dateTo?: Date } {
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

  if (dateFrom && isNaN(dateFrom.getTime())) return {};
  if (dateTo && isNaN(dateTo.getTime())) return {};

  return { dateFrom, dateTo };
}

// ── GET /cost-allocation/summary — All projects summary ─────────────────────
// IMPORTANT: This route MUST be mounted before /:projectId to avoid shadowing
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = parseDateParams(req);
    const cacheKey = `cost-alloc:summary:${dateFrom?.toISOString() ?? 'all'}:${dateTo?.toISOString() ?? 'all'}`;

    const data = await cached(cacheKey, CacheTTL.TOP_PROJECTS, () => getCostAllocationSummary(dateFrom, dateTo));

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /cost-allocation/:projectId — Per-project breakdown ──────────────────
router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const { dateFrom, dateTo } = parseDateParams(req);
    const cacheKey = `cost-alloc:${projectId}:${dateFrom?.toISOString() ?? 'all'}:${dateTo?.toISOString() ?? 'all'}`;

    const data = await cached(cacheKey, CacheTTL.TOP_PROJECTS, () => getCostAllocation(projectId, dateFrom, dateTo));

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
