// ---------------------------------------------------------------------------
// Consumption Trend Routes — L8
// ---------------------------------------------------------------------------
// GET /consumption-trends/items/:itemId  — Per-item monthly consumption trend
// GET /consumption-trends/top            — Top N consumed items
// ---------------------------------------------------------------------------

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import { cached, CacheTTL } from '../../../utils/cache.js';
import { getItemConsumptionTrend, getTopConsumptionItems } from '../services/consumption-trend.service.js';

const router = Router();

router.use(authenticate);

// ── GET /consumption-trends/items/:itemId ─────────────────────────────────
router.get('/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params.itemId as string;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : undefined;

    if (months !== undefined && (isNaN(months) || months < 1 || months > 60)) {
      return sendError(res, 400, 'months must be between 1 and 60');
    }

    const cacheKey = `consumption-trend:item:${itemId}:${months ?? 12}`;
    const data = await cached(cacheKey, CacheTTL.TOP_PROJECTS, () => getItemConsumptionTrend(itemId, months));

    if (!data) {
      return sendError(res, 404, 'No consumption data found for this item');
    }

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /consumption-trends/top ──────────────────────────────────────────
router.get('/top', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const cacheKey = `consumption-trend:top:${warehouseId ?? 'all'}:${months ?? 12}:${limit ?? 20}`;
    const data = await cached(cacheKey, CacheTTL.TOP_PROJECTS, () =>
      getTopConsumptionItems(warehouseId, months, limit),
    );

    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
