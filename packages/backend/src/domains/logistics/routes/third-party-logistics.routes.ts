/**
 * Third-Party Logistics (3PL) Routes — V2
 * REST endpoints for 3PL contract and charge management.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError } from '../../../utils/response.js';
import { createAuditLog } from '../../audit/services/audit.service.js';
import { clientIp } from '../../../utils/helpers.js';
import {
  createContract,
  getContractById,
  getContracts,
  activateContract,
  suspendContract,
  terminateContract,
  createCharge,
  getCharges,
  approveCharge,
  invoiceCharge,
  payCharge,
  disputeCharge,
  getContractSummary,
} from '../services/third-party-logistics.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createContractSchema = z.object({
  contractCode: z.string().min(1),
  supplierId: z.string().uuid(),
  serviceType: z.enum(['warehousing', 'transportation', 'customs_brokerage', 'freight_forwarding', 'full_3pl']),
  startDate: z.string(),
  endDate: z.string().optional(),
  rateSchedule: z.record(z.unknown()),
  slaTerms: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

const createChargeSchema = z.object({
  contractId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  chargeType: z.enum([
    'storage',
    'handling_in',
    'handling_out',
    'transport',
    'customs_fee',
    'value_added',
    'penalty',
    'other',
  ]),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitRate: z.number().positive(),
  totalAmount: z.number().positive(),
  currency: z.string().length(3).optional(),
  refDocType: z.string().optional(),
  refDocId: z.string().uuid().optional(),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
});

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /contracts — Paginated list of contracts ────────────────────────
router.get(
  '/contracts',
  authenticate,
  requirePermission('shipment', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplierId, status, serviceType, page, pageSize } = req.query as Record<string, string | undefined>;
      const result = await getContracts({
        supplierId,
        status,
        serviceType,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /contracts/:id — Single contract detail ─────────────────────────
router.get(
  '/contracts/:id',
  authenticate,
  requirePermission('shipment', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getContractById(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /contracts/:id/summary — Contract financial summary ─────────────
router.get(
  '/contracts/:id/summary',
  authenticate,
  requirePermission('shipment', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getContractSummary(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /contracts — Create a contract ─────────────────────────────────
router.post(
  '/contracts',
  authenticate,
  requirePermission('shipment', 'create'),
  validate(createContractSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await createContract(req.body);

      await createAuditLog({
        tableName: 'wms_3pl_contracts',
        recordId: record.id,
        action: 'create',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /contracts/:id/activate — Activate contract ───────────────────
router.patch(
  '/contracts/:id/activate',
  authenticate,
  requirePermission('shipment', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await activateContract(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_3pl_contracts',
        recordId: req.params.id as string,
        action: 'activate',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /contracts/:id/suspend — Suspend contract ─────────────────────
router.patch(
  '/contracts/:id/suspend',
  authenticate,
  requirePermission('shipment', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await suspendContract(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_3pl_contracts',
        recordId: req.params.id as string,
        action: 'suspend',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /contracts/:id/terminate — Terminate contract ─────────────────
router.patch(
  '/contracts/:id/terminate',
  authenticate,
  requirePermission('shipment', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await terminateContract(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_3pl_contracts',
        recordId: req.params.id as string,
        action: 'terminate',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// CHARGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /charges — Paginated list of charges ────────────────────────────
router.get(
  '/charges',
  authenticate,
  requirePermission('shipment', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId, status, chargeType, warehouseId, page, pageSize } = req.query as Record<
        string,
        string | undefined
      >;
      const result = await getCharges({
        contractId,
        status,
        chargeType,
        warehouseId,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      sendSuccess(res, result.data, { page: result.page, pageSize: result.pageSize, total: result.total });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /charges — Create a charge ─────────────────────────────────────
router.post(
  '/charges',
  authenticate,
  requirePermission('shipment', 'create'),
  validate(createChargeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await createCharge(req.body);

      await createAuditLog({
        tableName: 'wms_3pl_charges',
        recordId: record.id,
        action: 'create',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendCreated(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /charges/:id/approve — Approve a charge ───────────────────────
router.patch(
  '/charges/:id/approve',
  authenticate,
  requirePermission('shipment', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await approveCharge(req.params.id as string, req.user!.userId);

      await createAuditLog({
        tableName: 'wms_3pl_charges',
        recordId: req.params.id as string,
        action: 'approve',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /charges/:id/invoice — Invoice a charge ───────────────────────
router.patch(
  '/charges/:id/invoice',
  authenticate,
  requirePermission('shipment', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await invoiceCharge(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_3pl_charges',
        recordId: req.params.id as string,
        action: 'invoice',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /charges/:id/pay — Pay a charge ───────────────────────────────
router.patch(
  '/charges/:id/pay',
  authenticate,
  requirePermission('shipment', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await payCharge(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_3pl_charges',
        recordId: req.params.id as string,
        action: 'pay',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /charges/:id/dispute — Dispute a charge ───────────────────────
router.patch(
  '/charges/:id/dispute',
  authenticate,
  requirePermission('shipment', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await disputeCharge(req.params.id as string);

      await createAuditLog({
        tableName: 'wms_3pl_charges',
        recordId: req.params.id as string,
        action: 'dispute',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
