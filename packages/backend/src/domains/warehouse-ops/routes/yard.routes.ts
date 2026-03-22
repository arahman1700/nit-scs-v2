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
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { resolveWarehouseScope as _resolveWarehouseScope } from '../../../utils/scope-filter.js';
import * as yardService from '../services/yard.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createDockDoorSchema = z.object({
  warehouseId: z.string().min(1).max(100),
  doorNumber: z.string().min(1).max(50),
  doorType: z.enum(['inbound', 'outbound', 'both']),
  status: z.string().max(50).optional(),
});

const updateDockDoorSchema = z.object({
  doorType: z.enum(['inbound', 'outbound', 'both']).optional(),
  status: z.string().max(50).optional(),
});

const createAppointmentSchema = z.object({
  warehouseId: z.string().min(1).max(100),
  dockDoorId: z.string().max(100).optional(),
  appointmentType: z.enum(['delivery', 'pickup', 'transfer']),
  scheduledStart: z.string().min(1).max(50),
  scheduledEnd: z.string().min(1).max(50),
  carrierName: z.string().max(255).optional(),
  driverName: z.string().max(255).optional(),
  vehiclePlate: z.string().max(30).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const truckCheckInSchema = z.object({
  warehouseId: z.string().min(1).max(100),
  vehiclePlate: z.string().min(1).max(30),
  driverName: z.string().max(255).optional(),
  carrierName: z.string().max(255).optional(),
  purpose: z.enum(['delivery', 'pickup', 'transfer']),
  notes: z.string().max(2000).optional(),
});

const router = Router();

// All routes require authentication + warehouse_zone permission
router.use(authenticate);
router.use(requirePermission('warehouse_zone', 'read'));

function resolveWarehouseScope(req: Request, warehouseId: string | undefined) {
  return _resolveWarehouseScope(req.user!, warehouseId);
}

// ############################################################################
// DOCK DOORS
// ############################################################################

// GET /yard/dock-doors/available — must be before /:id to avoid collision
router.get('/dock-doors/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const warehouseId = resolved;
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const warehouseId = resolved;
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
    const data = await yardService.getDockDoor(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/dock-doors
router.post('/dock-doors', validate(createDockDoorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId, doorNumber, doorType, status } = req.body;
    const data = await yardService.createDockDoor({ warehouseId, doorNumber, doorType, status });
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// PUT /yard/dock-doors/:id
router.put(
  '/dock-doors/:id',
  validate(updateDockDoorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { doorType, status } = req.body;
      const data = await yardService.updateDockDoor(req.params.id as string, { doorType, status });
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /yard/dock-doors/:id
router.delete(
  '/dock-doors/:id',
  requirePermission('warehouse_zone', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await yardService.deleteDockDoor(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// ############################################################################
// APPOINTMENTS
// ############################################################################

// GET /yard/appointments
router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const warehouseId = resolved;
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
    const data = await yardService.getAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/appointments
router.post(
  '/appointments',
  validate(createAppointmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await yardService.createAppointment(req.body);
      sendCreated(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /yard/appointments/:id/check-in
router.post('/appointments/:id/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await yardService.checkInAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /yard/appointments/:id/complete
router.post('/appointments/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await yardService.completeAppointment(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// DELETE /yard/appointments/:id (cancel)
router.delete('/appointments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string | undefined);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const warehouseId = resolved;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const { data, total } = await yardService.listTruckVisits({ page, pageSize, warehouseId, status, search });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// POST /yard/trucks/check-in
router.post(
  '/trucks/check-in',
  validate(truckCheckInSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await yardService.checkInTruck(req.body);
      sendCreated(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /yard/trucks/:id/assign-dock
router.post('/trucks/:id/assign-dock', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const warehouseId = resolved;
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
    const resolved = resolveWarehouseScope(req, req.query.warehouseId as string);
    if (resolved === null) return sendError(res, 403, 'You do not have access to this warehouse');
    const warehouseId = resolved;
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
