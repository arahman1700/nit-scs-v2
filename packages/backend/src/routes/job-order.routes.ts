import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { createDocumentRouter } from '../utils/document-factory.js';
import { joCreateSchema, joUpdateSchema, joApprovalSchema, joPaymentSchema } from '../schemas/job-order.schema.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import { emitToRole } from '../socket/setup.js';
import * as joService from '../services/job-order.service.js';
import type { JoCreateDto, JoUpdateDto } from '../types/dto.js';

const WRITE_ROLES = ['admin', 'manager', 'logistics_coordinator', 'site_engineer'];
const APPROVE_ROLES = ['admin', 'manager'];
const COORD_ROLES = ['admin', 'manager', 'logistics_coordinator'];

// ── Standard document routes (list, get, create, update) + actions ──
const baseRouter = createDocumentRouter({
  docType: 'job-orders',
  tableName: 'job_orders',
  resource: 'jo',
  scopeMapping: { projectField: 'projectId', createdByField: 'requestedById' },

  list: joService.list,
  getById: joService.getById,

  createSchema: joCreateSchema,
  createRoles: WRITE_ROLES,
  create: async (body, userId, req) => {
    const result = await joService.create(body as JoCreateDto, userId);
    // Emit role-specific notification for new JO
    const io = req.app.get('io') as SocketIOServer | undefined;
    if (io) {
      emitToRole(io, 'logistics_coordinator', 'jo:created', {
        id: result.id,
        joNumber: (result as Record<string, unknown>).joNumber,
        joType: (result as Record<string, unknown>).joType,
      });
    }
    return result as { id: string };
  },

  updateSchema: joUpdateSchema,
  updateRoles: WRITE_ROLES,
  update: (id, body) => joService.update(id, body as JoUpdateDto),

  actions: [
    {
      path: 'submit',
      roles: WRITE_ROLES,
      handler: (id, req) => {
        const io = req.app.get('io') as SocketIOServer | undefined;
        return joService.submit(id, req.user!.userId, io);
      },
      socketEvent: 'jo:submitted',
      socketData: r => {
        const res = r as { approverRole: string; slaHours: number };
        return { status: 'pending_approval', approverRole: res.approverRole, slaHours: res.slaHours };
      },
    },
    {
      path: 'approve',
      roles: APPROVE_ROLES,
      bodySchema: joApprovalSchema,
      handler: (id, req) => {
        const { approved, quoteAmount, comments } = req.body as {
          approved: boolean;
          quoteAmount?: number;
          comments?: string;
        };
        return joService.approve(id, req.user!.userId, approved, quoteAmount, comments);
      },
      socketEvent: 'jo:approval',
      socketData: r => {
        const res = r as { status: string };
        return { status: res.status };
      },
    },
    {
      path: 'reject',
      roles: APPROVE_ROLES,
      handler: (id, req) => {
        const { comments } = req.body as { comments?: string };
        return joService.reject(id, req.user!.userId, comments);
      },
      socketEvent: 'jo:rejected',
      socketData: () => ({ status: 'rejected' }),
    },
    {
      path: 'assign',
      roles: COORD_ROLES,
      handler: (id, req) => {
        const { supplierId } = req.body as { supplierId?: string };
        return joService.assign(id, supplierId);
      },
      socketEvent: 'jo:assigned',
      socketData: () => ({ status: 'assigned' }),
    },
    {
      path: 'start',
      roles: COORD_ROLES,
      handler: id => joService.start(id),
      socketEvent: 'jo:started',
      socketData: () => ({ status: 'in_progress' }),
    },
    {
      path: 'hold',
      roles: COORD_ROLES,
      handler: (id, req) => {
        const { reason } = req.body as { reason?: string };
        return joService.hold(id, reason);
      },
      socketEvent: 'jo:on_hold',
      socketData: () => ({ status: 'on_hold' }),
    },
    {
      path: 'resume',
      roles: COORD_ROLES,
      handler: id => joService.resume(id),
      socketEvent: 'jo:resumed',
      socketData: () => ({ status: 'in_progress' }),
    },
    {
      path: 'complete',
      roles: COORD_ROLES,
      handler: (id, req) => joService.complete(id, req.user!.userId),
      socketEvent: 'jo:completed',
      socketData: r => {
        const res = r as { slaMet: boolean | null };
        return { status: 'completed', slaMet: res.slaMet };
      },
    },
    {
      path: 'invoice',
      roles: COORD_ROLES,
      bodySchema: joPaymentSchema,
      handler: (id, req) => joService.invoice(id, req.body),
      socketEvent: 'jo:invoiced',
      socketData: () => ({ status: 'invoiced' }),
    },
    {
      path: 'cancel',
      roles: APPROVE_ROLES,
      handler: id => joService.cancel(id),
      socketEvent: 'jo:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});

// ── Custom routes that don't fit the factory pattern ──────────────────

// POST /:id/payments — Add payment record
baseRouter.post(
  '/:id/payments',
  authenticate,
  requirePermission('jo', 'update'),
  validate(joPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await joService.addPayment(req.params.id as string, req.body);

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'jo_payments',
        recordId: payment.id,
        newValues: { jobOrderId: req.params.id as string, invoiceNumber: payment.invoiceNumber },
      });

      sendCreated(res, payment);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id/payments/:pid — Update payment record
baseRouter.put(
  '/:id/payments/:pid',
  authenticate,
  requirePermission('jo', 'update'),
  validate(joPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { existing, updated } = await joService.updatePayment(
        req.params.id as string,
        req.params.pid as string,
        req.body,
      );

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'jo_payments',
        recordId: updated.id,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: req.body,
      });

      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

export default baseRouter;
