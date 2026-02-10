/**
 * Demand Forecast Routes
 *
 * GET  /demand-forecast                  — Forecast for one or all items
 * GET  /demand-forecast/top-demand       — Highest predicted demand items
 * GET  /demand-forecast/reorder-alerts   — Items needing reorder
 * GET  /demand-forecast/seasonal         — Seasonal pattern analysis
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  getForecast,
  getTopDemandItems,
  getReorderAlerts,
  getSeasonalPatterns,
} from '../services/demand-forecast.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET /demand-forecast — Forecast for specific item or all items ──────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const itemId = req.query.itemId as string | undefined;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : undefined;

    if (months !== undefined && (isNaN(months) || months < 1 || months > 12)) {
      return sendError(res, 400, 'months must be between 1 and 12');
    }

    const forecasts = await getForecast({ warehouseId, itemId, months });
    sendSuccess(res, forecasts);
  } catch (err) {
    next(err);
  }
});

// ── GET /demand-forecast/top-demand — Items with highest predicted demand ───

router.get('/top-demand', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const items = await getTopDemandItems(warehouseId, limit);
    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
});

// ── GET /demand-forecast/reorder-alerts — Items below reorder point ─────────

router.get('/reorder-alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;

    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId is required for reorder alerts');
    }

    const alerts = await getReorderAlerts(warehouseId);
    sendSuccess(res, alerts);
  } catch (err) {
    next(err);
  }
});

// ── GET /demand-forecast/seasonal — Seasonal demand patterns ────────────────

router.get('/seasonal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;

    const patterns = await getSeasonalPatterns(warehouseId);
    sendSuccess(res, patterns);
  } catch (err) {
    next(err);
  }
});

export default router;
