import type { Request, Response, NextFunction } from 'express';
import { createDocumentRouter } from '../utils/document-factory.js';
import {
  shipmentCreateSchema,
  shipmentUpdateSchema,
  shipmentStatusSchema,
  customsStageSchema,
  customsStageUpdateSchema,
} from '../schemas/logistics.schema.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { auditAndEmit, emitDocumentEvent } from '../utils/routeHelpers.js';
import * as shipmentService from '../services/shipment.service.js';
import type { ShipmentCreateDto, ShipmentUpdateDto } from '../types/dto.js';

const ROLES = ['admin', 'manager', 'logistics_coordinator', 'freight_forwarder'];

// ── Standard document routes (list, get, create, update, deliver, cancel) ──
const baseRouter = createDocumentRouter({
  docType: 'shipments',
  tableName: 'shipments',
  resource: 'shipment',
  scopeMapping: { projectField: 'projectId' },

  list: shipmentService.list,
  getById: shipmentService.getById,

  createSchema: shipmentCreateSchema,
  createRoles: ROLES,
  create: body => {
    const { lines, ...headerData } = body as ShipmentCreateDto;
    return shipmentService.create(headerData, lines);
  },

  updateSchema: shipmentUpdateSchema,
  updateRoles: ROLES,
  update: (id, body) => shipmentService.update(id, body as ShipmentUpdateDto),

  actions: [
    {
      path: 'deliver',
      roles: ROLES,
      handler: id => shipmentService.deliver(id),
      socketEvent: 'shipment:delivered',
      socketData: () => ({ status: 'delivered' }),
    },
    {
      path: 'cancel',
      roles: ['admin', 'manager', 'logistics_coordinator'],
      handler: id => shipmentService.cancel(id),
      socketEvent: 'shipment:cancelled',
      socketData: () => ({ status: 'cancelled' }),
    },
  ],
});

// ── Custom routes that don't fit the factory pattern ──────────────────

// PUT /:id/status — Update shipment status with optional date fields
baseRouter.put(
  '/:id/status',
  authenticate,
  requirePermission('shipment', 'update'),
  validate(shipmentStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, actualShipDate, etaPort, actualArrivalDate } = req.body;
      const { existing, updated } = await shipmentService.updateStatus(req.params.id as string, status, {
        actualShipDate,
        etaPort,
        actualArrivalDate,
      });

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'shipments',
        recordId: req.params.id as string,
        oldValues: { status: (existing as { status: string }).status },
        newValues: { status, actualShipDate, etaPort, actualArrivalDate },
        socketEvent: 'shipment:status',
        docType: 'shipments',
        socketData: { id: req.params.id as string, status },
      });

      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/customs — Add customs tracking stage
baseRouter.post(
  '/:id/customs',
  authenticate,
  requirePermission('customs', 'create'),
  validate(customsStageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.addCustomsStage(req.params.id as string, req.body);

      await auditAndEmit(req, {
        action: 'create',
        tableName: 'customs_tracking',
        recordId: result.customs.id,
        newValues: { shipmentId: result.shipmentId, stage: result.customs.stage },
      });

      emitDocumentEvent(req, 'shipments', result.shipmentId, 'shipment:customs', {
        customsId: result.customs.id,
        stage: result.customs.stage,
      });

      if (result.newShipmentStatus) {
        emitDocumentEvent(req, 'shipments', result.shipmentId, 'document:status', {
          status: result.newShipmentStatus,
        });
      }

      sendCreated(res, result.customs);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id/customs/:cid — Update customs tracking stage
baseRouter.put(
  '/:id/customs/:cid',
  authenticate,
  requirePermission('customs', 'update'),
  validate(customsStageUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { existing, updated } = await shipmentService.updateCustomsStage(
        req.params.id as string,
        req.params.cid as string,
        req.body,
      );

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'customs_tracking',
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
