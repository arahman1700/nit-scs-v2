/**
 * Route Optimizer Routes
 *
 * POST /route-optimizer/optimize       — Optimize delivery route for selected JOs
 * GET  /route-optimizer/undelivered     — List pending JOs with project locations
 * POST /route-optimizer/estimate-fuel   — Calculate fuel cost estimate
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { optimizeRoute, getUndeliveredJOs, estimateFuelCost } from '../services/route-optimizer.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'logistics_coordinator', 'transport_supervisor', 'freight_forwarder'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for route optimizer operations');
    return false;
  }
  return true;
}

// ── POST /optimize — Optimize delivery route ─────────────────────────────

router.post('/optimize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { warehouseId, joIds } = req.body;

    if (!warehouseId || typeof warehouseId !== 'string') {
      return sendError(res, 400, 'warehouseId (string) is required');
    }
    if (!joIds || !Array.isArray(joIds) || joIds.length === 0) {
      return sendError(res, 400, 'joIds (non-empty array of strings) is required');
    }

    const result = await optimizeRoute(warehouseId, joIds);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return sendError(res, 404, err.message);
    }
    if (err instanceof Error && err.message.includes('coordinates')) {
      return sendError(res, 422, err.message);
    }
    next(err);
  }
});

// ── GET /undelivered — List pending JOs with locations ───────────────────

router.get('/undelivered', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string | undefined;
    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId query parameter is required');
    }

    const result = await getUndeliveredJOs(warehouseId);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return sendError(res, 404, err.message);
    }
    next(err);
  }
});

// ── POST /estimate-fuel — Calculate fuel cost ────────────────────────────

router.post('/estimate-fuel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { distanceKm, fuelPrice } = req.body;

    if (typeof distanceKm !== 'number' || distanceKm <= 0) {
      return sendError(res, 400, 'distanceKm must be a positive number');
    }
    if (typeof fuelPrice !== 'number' || fuelPrice <= 0) {
      return sendError(res, 400, 'fuelPrice must be a positive number');
    }

    const result = estimateFuelCost(distanceKm, fuelPrice);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
