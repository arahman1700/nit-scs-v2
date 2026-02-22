/**
 * Intelligence Routes — Smart features API
 * Provides endpoints for smart defaults, anomaly detection, and reorder predictions.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { sendSuccess } from '../utils/response.js';
import { getUserDefaults } from '../services/smart-defaults.service.js';
import { detectAnomalies, getInventoryHealthSummary } from '../services/anomaly-detection.service.js';
import {
  generateReorderPredictions,
  getWarehousePredictions,
  autoUpdateReorderPoints,
} from '../services/reorder-prediction.service.js';
import { anomaliesQuerySchema, reorderPredictionsQuerySchema } from '../schemas/intelligence.schema.js';

const router = Router();

// Intelligence endpoints are computationally expensive — apply a stricter rate limit.
// 60 requests per minute per IP (vs 200 for general API).
router.use(rateLimiter(60, 60_000));

// ── Smart Defaults ──────────────────────────────────────────────────────

/**
 * GET /api/v1/intelligence/defaults
 * Returns smart default suggestions for the current user.
 */
router.get('/defaults', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaults = await getUserDefaults(req.user!.userId);
    sendSuccess(res, defaults);
  } catch (err) {
    next(err);
  }
});

// ── Anomaly Detection ───────────────────────────────────────────────────

/**
 * GET /api/v1/intelligence/anomalies
 * Run anomaly detection and return results.
 * Query params: since (ISO date), notify (boolean)
 */
router.get(
  '/anomalies',
  authenticate,
  requirePermission('inventory', 'read'),
  validate(anomaliesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = res.locals.validatedQuery as { since?: string; notify?: string };
      const since = validated.since ? new Date(validated.since) : undefined;
      const notify = validated.notify === 'true';
      const anomalies = await detectAnomalies({ since, notify });
      sendSuccess(res, anomalies);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/intelligence/inventory-health
 * Get a quick health summary of inventory status.
 */
router.get('/inventory-health', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getInventoryHealthSummary();
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
});

// ── Reorder Predictions ─────────────────────────────────────────────────

/**
 * GET /api/v1/intelligence/reorder-predictions
 * Generate reorder point predictions for all items.
 * Query params: warehouseId (optional UUID)
 */
router.get(
  '/reorder-predictions',
  authenticate,
  requirePermission('inventory', 'read'),
  validate(reorderPredictionsQuerySchema, 'query'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = res.locals.validatedQuery as { warehouseId?: string };
      const predictions = validated.warehouseId
        ? await getWarehousePredictions(validated.warehouseId)
        : await generateReorderPredictions();
      sendSuccess(res, predictions);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/intelligence/reorder-predictions/auto-update
 * Auto-update reorder points based on predictions (admin only).
 * Rate limited to 5 per minute (expensive write operation).
 */
router.post(
  '/reorder-predictions/auto-update',
  authenticate,
  requireRole('admin'),
  rateLimiter(5, 60_000),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await autoUpdateReorderPoints();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
