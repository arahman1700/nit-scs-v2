/**
 * Staging Area Management Routes — V2
 *
 * GET    /staging              — List staging assignments (paginated, filtered)
 * GET    /staging/zones        — List staging zones for a warehouse
 * GET    /staging/alerts       — Overstay alerts for a warehouse
 * GET    /staging/occupancy    — Zone occupancy summary
 * POST   /staging              — Create staging assignment
 * POST   /staging/:id/move     — Move item from staging
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import * as stagingService from '../services/staging.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for staging area management');
    return false;
  }
  return true;
}

// ############################################################################
// STAGING ZONES
// ############################################################################

// GET /staging/zones
router.get('/zones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) return sendError(res, 400, 'warehouseId is required');

    const data = await stagingService.listStagingZones(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ############################################################################
// ALERTS & OCCUPANCY
// ############################################################################

// GET /staging/alerts
router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) return sendError(res, 400, 'warehouseId is required');

    const data = await stagingService.getOverstayAlerts(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /staging/occupancy
router.get('/occupancy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) return sendError(res, 400, 'warehouseId is required');

    const data = await stagingService.getStagingOccupancy(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ############################################################################
// ASSIGNMENTS
// ############################################################################

// GET /staging
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const warehouseId = req.query.warehouseId as string | undefined;
    const zoneId = req.query.zoneId as string | undefined;
    const status = req.query.status as string | undefined;
    const direction = req.query.direction as string | undefined;

    const { data, total } = await stagingService.listAssignments({
      page,
      pageSize,
      warehouseId,
      zoneId,
      status,
      direction,
    });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// POST /staging
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { zoneId, warehouseId, itemId, sourceDocType, sourceDocId, quantity, direction } = req.body;
    if (!zoneId || !warehouseId || !itemId || !sourceDocType || !sourceDocId || !quantity || !direction) {
      return sendError(
        res,
        400,
        'zoneId, warehouseId, itemId, sourceDocType, sourceDocId, quantity, and direction are required',
      );
    }

    const validDocTypes = ['grn', 'mi', 'wt', 'cross_dock'];
    if (!validDocTypes.includes(sourceDocType)) {
      return sendError(res, 400, `sourceDocType must be one of: ${validDocTypes.join(', ')}`);
    }

    const validDirections = ['inbound', 'outbound'];
    if (!validDirections.includes(direction)) {
      return sendError(res, 400, `direction must be one of: ${validDirections.join(', ')}`);
    }

    const data = await stagingService.createAssignment(req.body, req.user!.userId);
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /staging/:id/move
router.post('/:id/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const data = await stagingService.moveFromStaging(req.params.id as string, req.user!.userId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
