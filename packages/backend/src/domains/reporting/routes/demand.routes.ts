/**
 * Demand Routes — L8 (Consumption Trend Analysis) + L9 (Demand Forecasting)
 *
 * GET  /demand/trends/:itemId       — Consumption trend for a specific item
 * GET  /demand/top-items            — Top consumption items (by volume)
 * GET  /demand/reorder-suggestions  — Reorder suggestions (rule-based)
 * GET  /demand/forecast/:itemId     — Item forecast (SMA projection)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import { getItemConsumptionTrend, getTopConsumptionItems } from '../services/consumption-trend.service.js';
import { generateReorderSuggestions, getItemForecastProjection } from '../services/demand-forecast.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'inventory_specialist'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for demand analysis');
    return false;
  }
  return true;
}

// ── GET /demand/trends/:itemId — Consumption trend for a specific item ──────

router.get('/trends/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const itemId = req.params.itemId as string;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : undefined;

    if (months !== undefined && (isNaN(months) || months < 1 || months > 60)) {
      return sendError(res, 400, 'months must be between 1 and 60');
    }

    const trend = await getItemConsumptionTrend(itemId, months);

    if (!trend) {
      return sendError(res, 404, 'No consumption data found for this item');
    }

    sendSuccess(res, trend);
  } catch (err) {
    next(err);
  }
});

// ── GET /demand/top-items — Top consumption items by volume ─────────────────

router.get('/top-items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string | undefined;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 12;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));

    if (isNaN(months) || months < 1 || months > 60) {
      return sendError(res, 400, 'months must be between 1 and 60');
    }

    const items = await getTopConsumptionItems(warehouseId, months, limit);
    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
});

// ── GET /demand/reorder-suggestions — Rule-based reorder suggestions ────────

router.get('/reorder-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string | undefined;
    const lookbackMonths = req.query.lookbackMonths ? parseInt(req.query.lookbackMonths as string, 10) : undefined;
    const leadTimeDays = req.query.leadTimeDays ? parseInt(req.query.leadTimeDays as string, 10) : undefined;

    if (lookbackMonths !== undefined && (isNaN(lookbackMonths) || lookbackMonths < 1 || lookbackMonths > 24)) {
      return sendError(res, 400, 'lookbackMonths must be between 1 and 24');
    }

    if (leadTimeDays !== undefined && (isNaN(leadTimeDays) || leadTimeDays < 1 || leadTimeDays > 365)) {
      return sendError(res, 400, 'leadTimeDays must be between 1 and 365');
    }

    const suggestions = await generateReorderSuggestions(warehouseId, lookbackMonths, leadTimeDays);
    sendSuccess(res, suggestions);
  } catch (err) {
    next(err);
  }
});

// ── GET /demand/forecast/:itemId — Item forecast (SMA projection) ───────────

router.get('/forecast/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const itemId = req.params.itemId as string;
    const warehouseId = req.query.warehouseId as string | undefined;
    const months = req.query.months ? parseInt(req.query.months as string, 10) : 6;

    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId query parameter is required');
    }

    if (isNaN(months) || months < 1 || months > 24) {
      return sendError(res, 400, 'months must be between 1 and 24');
    }

    const forecast = await getItemForecastProjection(itemId, warehouseId, months);
    sendSuccess(res, forecast);
  } catch (err) {
    next(err);
  }
});

export default router;
