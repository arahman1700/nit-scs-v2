/**
 * Yard Management Routes — V2
 *
 * GET    /yard/dock-doors                   — List dock doors
 * POST   /yard/dock-doors                   — Create dock door
 * GET    /yard/dock-doors/:id               — Get dock door detail
 * PUT    /yard/dock-doors/:id               — Update dock door
 * DELETE /yard/dock-doors/:id               — Delete dock door
 * GET    /yard/dock-doors/available          — Available dock doors
 *
 * GET    /yard/appointments                 — List appointments
 * POST   /yard/appointments                 — Schedule appointment
 * GET    /yard/appointments/:id             — Get appointment detail
 * POST   /yard/appointments/:id/check-in    — Check in appointment
 * POST   /yard/appointments/:id/complete    — Complete appointment
 * DELETE /yard/appointments/:id             — Cancel appointment
 *
 * POST   /yard/trucks/check-in              — Truck check-in
 * GET    /yard/trucks                       — List truck visits
 * POST   /yard/trucks/:id/assign-dock       — Assign dock to truck
 * POST   /yard/trucks/:id/check-out         — Truck check-out
 *
 * GET    /yard/status                       — Current yard status
 * GET    /yard/utilization                  — Dock utilization report
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import * as yardService from '../services/yard.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for yard management');
    return false;
  }
  return true;
}

// ############################################################################
// DOCK DOORS
// ############################################################################

// GET /yard/dock-doors/available — must be before /:id to avoid collision
router.get('/dock-doors/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) return sendError(res, 400, 'warehouseId is required');

    const doorType = req.query.doorType as string | undefined;
    const data = await yardService.getAvailableDockDoors(warehouseId, doorType);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /yard/dock-doors
router.get('/dock-doors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const warehouseId = req.query.warehouseId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const { data, total } = await yardService.listDockDoors({ page, pageSize, warehouseId, status, search });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /yard/dock-doors/:id
router.get('/dock-doors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;
    const data = await yardService.getDockDoor(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/dock-doors
router.post('/dock-doors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { warehouseId, doorNumber, doorType, status } = req.body;
    if (!warehouseId || !doorNumber || !doorType) {
      return sendError(res, 400, 'warehouseId, doorNumber, and doorType are required');
    }

    const validTypes = ['inbound', 'outbound', 'both'];
    if (!validTypes.includes(doorType)) {
      return sendError(res, 400, `doorType must be one of: ${validTypes.join(', ')}`);
    }

    const data = await yardService.createDockDoor({ warehouseId, doorNumber, doorType, status });
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// PUT /yard/dock-doors/:id
router.put('/dock-doors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { doorType, status } = req.body;
    const data = await yardService.updateDockDoor(req.params.id as string, { doorType, status });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// DELETE /yard/dock-doors/:id
router.delete('/dock-doors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.systemRole;
    if (role !== 'admin' && role !== 'warehouse_supervisor') {
      return sendError(res, 403, 'Only admin or warehouse supervisor can delete dock doors');
    }

    await yardService.deleteDockDoor(req.params.id as string);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

// ############################################################################
// APPOINTMENTS
// ############################################################################

// GET /yard/appointments
router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const warehouseId = req.query.warehouseId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const date = req.query.date as string | undefined;

    const { data, total } = await yardService.listAppointments({ page, pageSize, warehouseId, status, search, date });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /yard/appointments/:id
router.get('/appointments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;
    const data = await yardService.getAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/appointments
router.post('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { warehouseId, appointmentType, scheduledStart, scheduledEnd } = req.body;
    if (!warehouseId || !appointmentType || !scheduledStart || !scheduledEnd) {
      return sendError(res, 400, 'warehouseId, appointmentType, scheduledStart, and scheduledEnd are required');
    }

    const validTypes = ['delivery', 'pickup', 'transfer'];
    if (!validTypes.includes(appointmentType)) {
      return sendError(res, 400, `appointmentType must be one of: ${validTypes.join(', ')}`);
    }

    const data = await yardService.createAppointment(req.body);
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/appointments/:id/check-in
router.post('/appointments/:id/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;
    const data = await yardService.checkInAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/appointments/:id/complete
router.post('/appointments/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;
    const data = await yardService.completeAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// DELETE /yard/appointments/:id (cancel)
router.delete('/appointments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;
    const data = await yardService.cancelAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ############################################################################
// TRUCK VISITS
// ############################################################################

// GET /yard/trucks
router.get('/trucks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const warehouseId = req.query.warehouseId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const { data, total } = await yardService.listTruckVisits({ page, pageSize, warehouseId, status, search });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// POST /yard/trucks/check-in
router.post('/trucks/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { warehouseId, vehiclePlate, purpose } = req.body;
    if (!warehouseId || !vehiclePlate || !purpose) {
      return sendError(res, 400, 'warehouseId, vehiclePlate, and purpose are required');
    }

    const validPurposes = ['delivery', 'pickup', 'transfer'];
    if (!validPurposes.includes(purpose)) {
      return sendError(res, 400, `purpose must be one of: ${validPurposes.join(', ')}`);
    }

    const data = await yardService.checkInTruck(req.body);
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/trucks/:id/assign-dock
router.post('/trucks/:id/assign-dock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { dockDoorId } = req.body;
    if (!dockDoorId) return sendError(res, 400, 'dockDoorId is required');

    const data = await yardService.assignDock(req.params.id as string, dockDoorId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/trucks/:id/check-out
router.post('/trucks/:id/check-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;
    const data = await yardService.checkOutTruck(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ############################################################################
// YARD STATUS & UTILIZATION
// ############################################################################

// GET /yard/status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string;
    if (!warehouseId) return sendError(res, 400, 'warehouseId is required');

    const data = await yardService.getYardStatus(warehouseId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /yard/utilization
router.get('/utilization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const warehouseId = req.query.warehouseId as string;
    const date = req.query.date as string;
    if (!warehouseId) return sendError(res, 400, 'warehouseId is required');
    if (!date) return sendError(res, 400, 'date is required (YYYY-MM-DD)');

    const data = await yardService.getDockUtilization(warehouseId, date);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
