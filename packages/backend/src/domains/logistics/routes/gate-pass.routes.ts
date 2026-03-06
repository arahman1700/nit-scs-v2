import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createDocumentRouter } from '../../../utils/document-factory.js';
import { gatePassCreateSchema, gatePassUpdateSchema } from '../schemas/logistics.schema.js';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { prisma } from '../../../utils/prisma.js';
import { applyScopeFilter } from '../../../utils/scope-filter.js';
import * as gatePassService from '../services/gate-pass.service.js';
import type { GatePassCreateDto, GatePassUpdateDto } from '../../../types/dto.js';

const WRITE_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff', 'gate_officer'];
const APPROVE_ROLES = ['admin', 'warehouse_supervisor'];
const GATE_ROLES = ['admin', 'warehouse_supervisor', 'gate_officer'];

// ── Wrapper router — custom routes MUST be registered before /:id ────────
const router = Router();

/**
 * SOW Gap 4: Lookup expected deliveries for inbound gate verification.
 * Gate officer queries by supplier to see pending ASNs and draft GRNs.
 */
router.get(
  '/expected-deliveries',
  authenticate,
  requireRole('gate_officer', 'warehouse_supervisor', 'warehouse_staff', 'admin'),
  applyScopeFilter({ warehouseField: 'warehouseId' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplierId, warehouseId } = req.query;
      const asnWhere: Record<string, unknown> = { status: 'pending', ...req.scopeFilter };
      if (supplierId) asnWhere.supplierId = supplierId as string;
      if (warehouseId) asnWhere.warehouseId = warehouseId as string;

      const grnWhere: Record<string, unknown> = { status: 'draft', ...req.scopeFilter };
      if (supplierId) grnWhere.supplierId = supplierId as string;
      if (warehouseId) grnWhere.warehouseId = warehouseId as string;

      const [asns, draftGrns] = await Promise.all([
        prisma.advanceShippingNotice.findMany({
          where: asnWhere,
          include: { lines: true },
          orderBy: { expectedArrival: 'asc' },
          take: 20,
        }),
        prisma.mrrv.findMany({
          where: grnWhere,
          include: { mrrvLines: true, supplier: { select: { id: true, supplierName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

      res.json({ asns, draftGrns });
    } catch (err) {
      next(err);
    }
  },
);

// ── Standard document routes (list, get, create, update, actions) ────────
const baseRouter = createDocumentRouter({
  docType: 'gate-passes',
  tableName: 'gate_passes',
  resource: 'gatepass',
  scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId', createdByField: 'issuedById' },

  list: gatePassService.list,
  getById: gatePassService.getById,

  createSchema: gatePassCreateSchema,
  createRoles: WRITE_ROLES,
  create: (body, userId) => {
    const { items, ...headerData } = body as GatePassCreateDto;
    return gatePassService.create(headerData, items, userId);
  },

  updateSchema: gatePassUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => gatePassService.update(id, body as GatePassUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: id => gatePassService.submit(id),
      socketEvent: 'gatepass:submitted',
      socketData: () => ({ status: 'pending' }),
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      handler: id => gatePassService.approve(id),
      socketEvent: 'gatepass:approved',
      socketData: () => ({ status: 'approved' }),
    },
    {
      path: 'verify-outbound',
      roles: GATE_ROLES,
      handler: (id, req) => {
        const body = req.body as {
          securityOfficer?: string;
          verificationNotes?: string;
          itemChecks?: Array<{ itemId: string; verifiedQty: number }>;
        };
        return gatePassService.verifyOutbound(id, body, req.user?.userId);
      },
      socketEvent: 'gatepass:released',
      socketData: () => ({ status: 'released' }),
    },
    {
      path: 'release',
      roles: GATE_ROLES,
      handler: (id, req) => {
        const { securityOfficer } = req.body as { securityOfficer?: string };
        return gatePassService.release(id, securityOfficer);
      },
      socketEvent: 'gatepass:released',
      socketData: () => ({ status: 'released' }),
    },
    {
      path: 'verify-inbound',
      roles: GATE_ROLES,
      handler: (id, req) => {
        const body = req.body as {
          securityOfficer?: string;
          verificationNotes?: string;
          itemChecks?: Array<{ itemId: string; verifiedQty: number }>;
        };
        return gatePassService.verifyInbound(id, body, req.user?.userId);
      },
      socketEvent: 'gatepass:returned',
      socketData: () => ({ status: 'returned' }),
    },
    {
      path: 'return',
      roles: GATE_ROLES,
      handler: id => gatePassService.returnPass(id),
      socketEvent: 'gatepass:returned',
      socketData: () => ({ status: 'returned' }),
    },
    {
      path: 'cancel',
      roles: APPROVE_ROLES,
      handler: id => gatePassService.cancel(id),
      socketEvent: 'gatepass:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});

// Mount the document router after the custom routes
router.use('/', baseRouter);

export default router;
