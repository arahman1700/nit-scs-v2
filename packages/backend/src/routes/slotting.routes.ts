/**
 * Slotting Optimization Routes
 *
 * GET  /slotting/analyze      — Full slotting analysis with suggestions
 * GET  /slotting/frequencies  — Item pick frequencies
 * POST /slotting/apply        — Apply a suggestion (move item to new bin)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { createAuditLog } from '../services/audit.service.js';
import { analyzeSlotting, getItemPickFrequencies, applySuggestion } from '../services/slotting-optimizer.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

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

router.post('/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.systemRole;
    if (role !== 'admin' && role !== 'warehouse_supervisor') {
      return sendError(res, 403, 'Only admin or warehouse_supervisor roles can apply slotting changes');
    }

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
});

export default router;
