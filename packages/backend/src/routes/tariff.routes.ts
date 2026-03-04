/**
 * Tariff Routes — V2 (SOW M3 — VAT & Duties Calculation)
 * Mounted at /api/v1/tariffs
 *
 * CRUD for tariff rates + duty calculation / application to shipments.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as tariffService from '../services/tariff.service.js';

const ALLOWED_ROLES = ['admin', 'manager', 'customs_specialist', 'finance_user', 'logistics_coordinator'];

const router = Router();

// All tariff routes require authentication
router.use(authenticate);

// ── List Tariff Rates ──────────────────────────────────────────────────────

/**
 * GET /tariffs/tariff-rates
 * List tariff rates with search, filtering, and pagination.
 */
router.get('/tariff-rates', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 25, 100);
    const sortBy = (req.query.sortBy as string) || 'updatedAt';
    const sortDir = (req.query.sortDir as string) === 'asc' ? 'asc' : 'desc';
    const search = req.query.search as string | undefined;

    const params = {
      skip: (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortDir: sortDir as 'asc' | 'desc',
      search,
      isActive: req.query.isActive as string | undefined,
      country: req.query.country as string | undefined,
      hsCode: req.query.hsCode as string | undefined,
    };

    const { data, total } = await tariffService.listTariffRates(params);
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── Get Tariff Rate by ID ──────────────────────────────────────────────────

/**
 * GET /tariffs/tariff-rates/:id
 */
router.get(
  '/tariff-rates/:id',
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const data = await tariffService.getTariffRateById(id);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── Create Tariff Rate ─────────────────────────────────────────────────────

/**
 * POST /tariffs/tariff-rates
 */
router.post(
  '/tariff-rates',
  requireRole('admin', 'manager', 'customs_specialist'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const data = await tariffService.createTariffRate(req.body, userId);
      sendCreated(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── Update Tariff Rate ─────────────────────────────────────────────────────

/**
 * PUT /tariffs/tariff-rates/:id
 */
router.put(
  '/tariff-rates/:id',
  requireRole('admin', 'manager', 'customs_specialist'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const data = await tariffService.updateTariffRate(id, req.body);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── Calculate Duties ───────────────────────────────────────────────────────

/**
 * POST /tariffs/tariff-rates/calculate/:shipmentId
 * Calculate duties and VAT for a shipment without persisting.
 */
router.post(
  '/tariff-rates/calculate/:shipmentId',
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shipmentId = req.params.shipmentId as string;
      const data = await tariffService.calculateDuties(shipmentId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── Apply Duties to Shipment ───────────────────────────────────────────────

/**
 * POST /tariffs/tariff-rates/apply/:shipmentId
 * Calculate and persist duties to the shipment's dutiesEstimated field.
 */
router.post(
  '/tariff-rates/apply/:shipmentId',
  requireRole('admin', 'manager', 'customs_specialist', 'finance_user'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shipmentId = req.params.shipmentId as string;
      const data = await tariffService.applyToShipment(shipmentId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
