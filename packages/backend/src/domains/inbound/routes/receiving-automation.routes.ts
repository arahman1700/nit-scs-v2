/**
 * Receiving Automation Routes — P6
 *
 * GRN → LPN Creation → WMS Task Generation → Putaway Assignment
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import * as receivingService from '../services/receiving-automation.service.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const router = Router();

router.use(authenticate);

// POST /receiving-automation/:grnId/plan — generate receiving plan
router.post(
  '/:grnId/plan',
  requirePermission('grn', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await receivingService.generateReceivingPlan(req.params.grnId as string);
      sendSuccess(res, plan);
    } catch (err) {
      if (err instanceof NotFoundError) return sendError(res, 404, err.message);
      next(err);
    }
  },
);

// POST /receiving-automation/:grnId/execute — execute a full receiving plan
router.post(
  '/:grnId/execute',
  requirePermission('grn', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await receivingService.generateReceivingPlan(req.params.grnId as string);
      const results = await receivingService.executeReceiving(plan, req.user!.userId);
      sendSuccess(res, { plan, results });
    } catch (err) {
      if (err instanceof NotFoundError) return sendError(res, 404, err.message);
      next(err);
    }
  },
);

// POST /receiving-automation/:grnId/auto-receive — full automation in one call
router.post(
  '/:grnId/auto-receive',
  requirePermission('grn', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await receivingService.autoReceiveGrn(req.params.grnId as string, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof NotFoundError) return sendError(res, 404, err.message);
      next(err);
    }
  },
);

// GET /receiving-automation/asn/:asnId/duties — calculate ASN customs duties
router.get(
  '/asn/:asnId/duties',
  requirePermission('grn', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const duties = await receivingService.calculateAsnDuties(req.params.asnId as string);
      sendSuccess(res, duties);
    } catch (err) {
      if (err instanceof NotFoundError) return sendError(res, 404, err.message);
      next(err);
    }
  },
);

export default router;
