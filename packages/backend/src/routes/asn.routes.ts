import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import * as asnService from '../services/asn.service.js';

const router = Router();

router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'manager', 'warehouse_supervisor', 'warehouse_staff'];

function checkRole(req: Request, res: Response): boolean {
  if (!ALLOWED_ROLES.includes(req.user!.systemRole)) {
    sendError(res, 403, 'Insufficient permissions for ASN operations');
    return false;
  }
  return true;
}

// ── GET / — List ASNs ───────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const status = req.query.status as string | undefined;
    const warehouseId = req.query.warehouseId as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const search = req.query.search as string | undefined;

    const { data, total } = await asnService.getAsns({ page, pageSize, status, warehouseId, supplierId, search });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Detail with lines ────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const asn = await asnService.getAsnById(req.params.id as string);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create ASN ────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const { supplierId, warehouseId, expectedArrival, carrierName, trackingNumber, purchaseOrderRef, notes, lines } =
      req.body;

    if (!supplierId || !warehouseId || !expectedArrival) {
      return sendError(res, 400, 'supplierId, warehouseId, and expectedArrival are required');
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return sendError(res, 400, 'At least one line item is required');
    }

    const asn = await asnService.createAsn({
      supplierId,
      warehouseId,
      expectedArrival,
      carrierName,
      trackingNumber,
      purchaseOrderRef,
      notes,
      lines,
    });
    sendCreated(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id — Update ASN ──────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const asn = await asnService.updateAsn(req.params.id as string, req.body);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/in-transit — Mark in transit ──────────────────────────────

router.post('/:id/in-transit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const asn = await asnService.markInTransit(req.params.id as string);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/arrived — Mark arrived ────────────────────────────────────

router.post('/:id/arrived', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const asn = await asnService.markArrived(req.params.id as string);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/receive — Receive and create GRN ─────────────────────────

router.post('/:id/receive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.systemRole;
    if (role !== 'admin' && role !== 'manager' && role !== 'warehouse_supervisor') {
      return sendError(res, 403, 'Only admin, manager, or warehouse supervisor can receive ASNs');
    }

    const result = await asnService.receiveAsn(req.params.id as string);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id — Cancel ASN ────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const asn = await asnService.cancelAsn(req.params.id as string);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id/variance — Variance report ─────────────────────────────────

router.get('/:id/variance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!checkRole(req, res)) return;

    const report = await asnService.getVarianceReport(req.params.id as string);
    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
});

export default router;
