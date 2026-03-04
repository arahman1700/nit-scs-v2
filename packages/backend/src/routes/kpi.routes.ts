// ---------------------------------------------------------------------------
// KPI Routes — Comprehensive KPI dashboard endpoints
// ---------------------------------------------------------------------------

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { cached, CacheTTL } from '../utils/cache.js';
import { getComprehensiveKpis, getKpisByCategory } from '../services/kpi.service.js';
import type { KpiCategory } from '../services/kpi.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const VALID_CATEGORIES = new Set<KpiCategory>(['inventory', 'procurement', 'logistics', 'quality', 'financial']);

/** Parse optional date query params */
function parseDateParams(req: Request): { dateFrom?: Date; dateTo?: Date } {
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

  // Validate dates
  if (dateFrom && isNaN(dateFrom.getTime())) return {};
  if (dateTo && isNaN(dateTo.getTime())) return {};

  return { dateFrom, dateTo };
}

// ── GET /kpis — All 15 KPIs ────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = parseDateParams(req);
    const cacheKey = `kpis:all:${dateFrom?.toISOString() ?? 'default'}:${dateTo?.toISOString() ?? 'default'}`;

    const data = await cached(cacheKey, CacheTTL.DASHBOARD_STATS, () => getComprehensiveKpis(dateFrom, dateTo));

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /kpis/:category — KPIs filtered by category ────────────────────────

router.get('/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.params.category as KpiCategory;

    if (!VALID_CATEGORIES.has(category)) {
      sendError(res, 400, `Invalid category: ${category}. Valid: ${[...VALID_CATEGORIES].join(', ')}`);
      return;
    }

    const { dateFrom, dateTo } = parseDateParams(req);
    const cacheKey = `kpis:${category}:${dateFrom?.toISOString() ?? 'default'}:${dateTo?.toISOString() ?? 'default'}`;

    const data = await cached(cacheKey, CacheTTL.DASHBOARD_STATS, () => getKpisByCategory(category, dateFrom, dateTo));

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
