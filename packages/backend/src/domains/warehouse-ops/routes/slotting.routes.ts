/**
 * Slotting Optimization Routes
 *
 * GET  /slotting/analyze      — Full slotting analysis with suggestions
 * GET  /slotting/frequencies  — Item pick frequencies
 * POST /slotting/apply        — Apply a suggestion (move item to new bin)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import { createAuditLog } from '../../audit/services/audit.service.js';
import { analyzeSlotting, getItemPickFrequencies, applySuggestion } from '../services/slotting-optimizer.service.js';
import {
  analyzeCoLocation,
  analyzeSeasonalTrends,
  generateAiSlottingSummary,
} from '../services/ai-slotting.service.js';

const router = Router();

// All routes require authentication + warehouse_zone permission
router.use(authenticate);
router.use(requirePermission('warehouse_zone', 'read'));

// ── GET /slotting/analyze — Full analysis with suggestions ──────────────

router.get('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId query parameter is required');
    }

    const analysis = await analyzeSlotting(warehouseId);
    sendSuccess(res, analysis);
  } catch (err) {
    next(err);
  }
});

// ── GET /slotting/frequencies — Item pick frequencies ────────────────────

router.get('/frequencies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId query parameter is required');
    }

    const frequencies = await getItemPickFrequencies(warehouseId);
    sendSuccess(res, frequencies);
  } catch (err) {
    next(err);
  }
});

// ── POST /slotting/apply — Apply a single suggestion ────────────────────

router.post(
  '/apply',
  requirePermission('warehouse_zone', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId, warehouseId, newBinNumber } = req.body as {
        itemId?: string;
        warehouseId?: string;
        newBinNumber?: string;
      };

      if (!itemId || !warehouseId || !newBinNumber) {
        return sendError(res, 400, 'itemId, warehouseId, and newBinNumber are required');
      }

      // Validate bin number format: zone-aisle-shelf (e.g. A-03-12)
      if (!/^[A-Z]-\d{2}-\d{2}$/.test(newBinNumber)) {
        return sendError(res, 400, 'Invalid bin number format. Expected: ZONE-AISLE-SHELF (e.g. A-03-12)');
      }

      const result = await applySuggestion(itemId, warehouseId, newBinNumber, req.user!.userId);

      await createAuditLog({
        tableName: 'bin_cards',
        recordId: itemId,
        action: 'update',
        changedFields: { binNumber: true },
        oldValues: { binNumber: result.oldBin },
        newValues: { binNumber: result.newBin },
        performedById: req.user!.userId,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /slotting/:warehouseId/co-location — Co-location analysis ──────

router.get('/:warehouseId/co-location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.params.warehouseId as string;
    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId is required');
    }
    const result = await analyzeCoLocation(warehouseId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── GET /slotting/:warehouseId/seasonal — Seasonal trend analysis ──────

router.get('/:warehouseId/seasonal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.params.warehouseId as string;
    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId is required');
    }
    const result = await analyzeSeasonalTrends(warehouseId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── GET /slotting/:warehouseId/ai-summary — Combined AI analysis ──────

router.get('/:warehouseId/ai-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.params.warehouseId as string;
    if (!warehouseId) {
      return sendError(res, 400, 'warehouseId is required');
    }
    const result = await generateAiSlottingSummary(warehouseId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
