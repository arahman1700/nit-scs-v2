/**
 * Purchase Order (Oracle Mirror) Routes
 *
 * Read-only endpoints that surface data from the Oracle PO mirror tables.
 * All writes go to Oracle and are pulled back via the sync job.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { PurchaseOrderLineMirror } from '@prisma/client';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import {
  listPoMirrors,
  getPoByNumber,
  getPoReconciliation,
  syncPurchaseOrders,
} from '../services/oracle-po-sync.service.js';

const router = Router();

router.use(authenticate);

// ── GET / — List PO mirrors with pagination ────────────────────────────────

router.get('/', requirePermission('grn', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const supplierCode = req.query.supplierCode as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const { data, total } = await listPoMirrors({ supplierCode, status, search, page, pageSize });
    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── GET /reconciliation — PO vs received qty comparison (all POs) ──────────

router.get(
  '/reconciliation',
  requirePermission('grn', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
      const supplierCode = req.query.supplierCode as string | undefined;
      const status = req.query.status as string | undefined;
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      const result = await getPoReconciliation({ supplierCode, status, fromDate, toDate, page, pageSize });
      sendSuccess(res, result.data, { page, pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /sync — Trigger manual sync (admin only) ─────────────────────────

router.post('/sync', requirePermission('grn', 'approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncPurchaseOrders();
    sendSuccess(res, {
      message: 'Oracle PO sync triggered',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /:poNumber — PO detail with lines ─────────────────────────────────

router.get('/:poNumber', requirePermission('grn', 'read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await getPoByNumber(req.params.poNumber as string);
    if (!po) {
      sendError(res, 404, `PO ${req.params.poNumber} not found in mirror`);
      return;
    }
    sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
});

// ── GET /:poNumber/reconciliation — single-PO reconciliation detail ────────

router.get(
  '/:poNumber/reconciliation',
  requirePermission('grn', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await getPoByNumber(req.params.poNumber as string);
      if (!po) {
        sendError(res, 404, `PO ${req.params.poNumber} not found in mirror`);
        return;
      }

      // Build per-line reconciliation for a single PO
      const lines = po.lines.map((line: PurchaseOrderLineMirror) => {
        const ordered = Number(line.orderedQty);
        const received = Number(line.receivedQty);
        const variance = received - ordered;

        let lineStatus: 'fully_received' | 'partially_received' | 'not_received' | 'over_received';
        if (received === 0) lineStatus = 'not_received';
        else if (received >= ordered) lineStatus = variance > 0 ? 'over_received' : 'fully_received';
        else lineStatus = 'partially_received';

        return {
          lineNumber: line.lineNumber,
          itemCode: line.itemCode,
          description: line.description,
          uom: line.uom,
          unitPrice: line.unitPrice !== null ? Number(line.unitPrice) : null,
          orderedQty: ordered,
          receivedQty: received,
          variance,
          status: lineStatus,
        };
      });

      sendSuccess(res, {
        poNumber: po.poNumber,
        supplierCode: po.supplierCode,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        expectedDate: po.expectedDate,
        status: po.status,
        currency: po.currency,
        syncedAt: po.syncedAt,
        lines,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
