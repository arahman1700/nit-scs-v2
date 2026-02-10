/**
 * Pick Optimizer & Wave Picking Routes
 *
 * GET    /path              — Optimize pick path for ad-hoc item list
 * POST   /waves             — Create a wave from MI IDs
 * GET    /waves             — List waves (filterable by warehouseId, status)
 * GET    /waves/:id         — Get wave detail with pick list
 * POST   /waves/:id/start   — Start picking a wave
 * POST   /waves/:id/complete — Complete a wave
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import { optimizePickPath } from '../services/pick-optimizer.service.js';
import * as waveService from '../services/wave-picking.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for pick optimizer operations');
    return false;
  }
  return true;
}

// ── GET /path — Optimize an ad-hoc pick path ────────────────────────────

router.get('/path', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string | undefined;
    const itemsRaw = req.query.items as string | undefined;

    if (!warehouseId || !itemsRaw) {
      return sendError(res, 400, 'warehouseId and items (JSON) query parameters are required');
    }

    let items: Array<{ itemId: string; quantity: number }>;
    try {
      items = JSON.parse(itemsRaw);
    } catch {
      return sendError(res, 400, 'items must be valid JSON: [{ "itemId": "...", "quantity": N }]');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 400, 'items must be a non-empty array');
    }

    const pickPath = await optimizePickPath(warehouseId, items);
    sendSuccess(res, pickPath);
  } catch (err) {
    next(err);
  }
});

// ── POST /waves — Create a wave from MI IDs ─────────────────────────────

router.post('/waves', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { warehouseId, miIds } = req.body;
    if (!warehouseId || !miIds || !Array.isArray(miIds)) {
      return sendError(res, 400, 'warehouseId and miIds (array) are required');
    }

    const wave = await waveService.createWave(warehouseId, miIds);
    sendCreated(res, wave);
  } catch (err) {
    next(err);
  }
});

// ── GET /waves — List waves ─────────────────────────────────────────────

router.get('/waves', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string | undefined;
    const status = req.query.status as string | undefined;

    const waveList = waveService.getWaves(warehouseId, status);
    sendSuccess(res, waveList);
  } catch (err) {
    next(err);
  }
});

// ── GET /waves/:id — Get wave with pick list ────────────────────────────

router.get('/waves/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const wave = waveService.getWave(req.params.id as string);
    if (!wave) {
      return sendError(res, 404, 'Wave not found');
    }

    // Ensure pick path is included
    const pickPath = await waveService.getWavePickList(wave.id);
    sendSuccess(res, { ...wave, pickPath });
  } catch (err) {
    next(err);
  }
});

// ── POST /waves/:id/start — Start picking ───────────────────────────────

router.post('/waves/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const wave = waveService.startPicking(req.params.id as string);
    sendSuccess(res, wave);
  } catch (err) {
    next(err);
  }
});

// ── POST /waves/:id/complete — Complete a wave ──────────────────────────

router.post('/waves/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const wave = waveService.completeWave(req.params.id as string);
    sendSuccess(res, wave);
  } catch (err) {
    next(err);
  }
});

export default router;
