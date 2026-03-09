import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { buildScopeFilter } from '../../../utils/scope-filter.js';
import * as asnService from '../services/asn.service.js';

const router = Router();

router.use(authenticate);

// ── GET / — List ASNs ───────────────────────────────────────────────────

router.get('/', requirePermission('grn', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const status = req.query.status as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const search = req.query.search as string | undefined;

    // Row-level security: enforce warehouse scope for restricted roles
    const scopeFilter = buildScopeFilter(req.user!, { warehouseField: 'warehouseId' });
    const scopedWarehouseId = scopeFilter.warehouseId as string | undefined;
    const warehouseId = scopedWarehouseId ?? (req.query.warehouseId as string | undefined);

    const { data, total } = await asnService.getAsns({ page, pageSize, status, warehouseId, supplierId, search });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Detail with lines ────────────────────────────────────────

router.get('/:id', requirePermission('grn', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asn = await asnService.getAsnById(req.params.id as string);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create ASN ────────────────────────────────────────────────

router.post('/', requirePermission('grn', 'create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
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

router.put('/:id', requirePermission('grn', 'update'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asn = await asnService.updateAsn(req.params.id as string, req.body);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/in-transit — Mark in transit ──────────────────────────────

router.post(
  '/:id/in-transit',
  requirePermission('grn', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asn = await asnService.markInTransit(req.params.id as string);
      sendSuccess(res, asn);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/arrived — Mark arrived ────────────────────────────────────

router.post(
  '/:id/arrived',
  requirePermission('grn', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asn = await asnService.markArrived(req.params.id as string);
      sendSuccess(res, asn);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:id/receive — Receive and create GRN ─────────────────────────

router.post(
  '/:id/receive',
  requirePermission('grn', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await asnService.receiveAsn(req.params.id as string, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /:id — Cancel ASN ────────────────────────────────────────────

router.delete('/:id', requirePermission('grn', 'delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asn = await asnService.cancelAsn(req.params.id as string);
    sendSuccess(res, asn);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id/variance — Variance report ─────────────────────────────────

router.get(
  '/:id/variance',
  requirePermission('grn', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await asnService.getVarianceReport(req.params.id as string);
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
