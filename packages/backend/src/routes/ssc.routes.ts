/**
 * SSC (Scrap Selling Committee) Bid Routes — V2
 * CRUD base via crud-factory + action endpoints via SSC service.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createCrudRouter } from '../utils/crud-factory.js';
import { sscBidCreateSchema, sscBidUpdateSchema } from '../schemas/document.schema.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';
import { auditAndEmit } from '../utils/routeHelpers.js';
import * as sscService from '../services/ssc.service.js';

const ALLOWED_ROLES = ['admin', 'scrap_committee_member'];

// Base CRUD routes (list, get, create, update, delete)
const crudRouter = createCrudRouter({
  modelName: 'sscBid',
  tableName: 'ssc_bids',
  resource: 'ssc',
  createSchema: sscBidCreateSchema,
  updateSchema: sscBidUpdateSchema,
  searchFields: ['bidderName'],
  includes: {
    scrapItem: {
      select: { id: true, scrapNumber: true, materialType: true, description: true },
    },
  },
  detailIncludes: {
    scrapItem: true,
  },
  allowedRoles: ALLOWED_ROLES,
  allowedFilters: ['scrapItemId', 'status'],
  softDelete: false,
});

// Action routes
const actionRouter = Router();

// POST /:id/accept — Accept a bid, reject all others for the same scrap item
actionRouter.post(
  '/:id/accept',
  authenticate,
  requirePermission('ssc', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sscService.acceptBid(req.params.id as string, req.user!.userId);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'ssc_bids',
        recordId: req.params.id as string,
        newValues: { status: 'accepted' },
        socketEvent: 'ssc:accepted',
        docType: 'ssc',
        socketData: { id: req.params.id, status: 'accepted' },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/reject — Reject a bid
actionRouter.post(
  '/:id/reject',
  authenticate,
  requirePermission('ssc', 'approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sscService.rejectBid(req.params.id as string, req.user!.userId);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'ssc_bids',
        recordId: req.params.id as string,
        newValues: { status: 'rejected' },
        socketEvent: 'ssc:rejected',
        docType: 'ssc',
        socketData: { id: req.params.id, status: 'rejected' },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/sign-memo — Mark SSC memo as signed
actionRouter.post(
  '/:id/sign-memo',
  authenticate,
  requirePermission('ssc', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sscService.signMemo(req.params.id as string, req.user!.userId);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'ssc_bids',
        recordId: req.params.id as string,
        newValues: { sscMemoSigned: true },
        socketEvent: 'ssc:memo_signed',
        docType: 'ssc',
        socketData: { id: req.params.id, sscMemoSigned: true },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/notify-finance — Mark finance copy sent
actionRouter.post(
  '/:id/notify-finance',
  authenticate,
  requirePermission('ssc', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sscService.notifyFinance(req.params.id as string);

      await auditAndEmit(req, {
        action: 'update',
        tableName: 'ssc_bids',
        recordId: req.params.id as string,
        newValues: { financeCopyDate: new Date().toISOString() },
        socketEvent: 'ssc:finance_notified',
        docType: 'ssc',
        socketData: { id: req.params.id, financeNotified: true },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// Combine: action routes first (so /:id/accept matches before /:id), then CRUD
const router = Router();
router.use('/', actionRouter);
router.use('/', crudRouter);

export default router;
