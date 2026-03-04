/**
 * Compliance Audit Checklist Routes — SOW M2 (ISO 9001)
 *
 * Checklists:
 *   GET    /compliance/checklists          — List (paginated, filterable)
 *   POST   /compliance/checklists          — Create new checklist
 *   GET    /compliance/checklists/:id      — Detail with items
 *   PUT    /compliance/checklists/:id      — Update checklist
 *
 * Audits:
 *   GET    /compliance/audits              — List (paginated, filterable)
 *   POST   /compliance/audits              — Create new audit
 *   GET    /compliance/audits/:id          — Detail with responses
 *   PUT    /compliance/audits/:id          — Update audit
 *   POST   /compliance/audits/:id/responses — Submit audit responses
 *   POST   /compliance/audits/:id/complete  — Complete audit (calculates score)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import * as complianceService from '../services/compliance.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

const ALLOWED_ROLES = ['admin', 'manager', 'qc_officer', 'compliance_officer', 'warehouse_supervisor'];

// ═══════════════════════════════════════════════════════════════════════
// CHECKLISTS
// ═══════════════════════════════════════════════════════════════════════

// ── GET /checklists — List compliance checklists ────────────────────────

router.get('/checklists', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const skip = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const standard = req.query.standard as string | undefined;
    const category = req.query.category as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = (req.query.sortDir as 'asc' | 'desc') || 'desc';

    const { data, total } = await complianceService.listChecklists({
      skip,
      pageSize,
      sortBy,
      sortDir,
      search,
      status,
      standard,
      category,
    });

    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── POST /checklists — Create new checklist ─────────────────────────────

router.post('/checklists', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await complianceService.createChecklist(req.body);
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /checklists/:id — Get checklist detail ─────────────────────────

router.get(
  '/checklists/:id',
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceService.getChecklistById(req.params.id as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /checklists/:id — Update checklist ──────────────────────────────

router.put(
  '/checklists/:id',
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceService.updateChecklist(req.params.id as string, req.body);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// AUDITS
// ═══════════════════════════════════════════════════════════════════════

// ── GET /audits — List compliance audits ────────────────────────────────

router.get('/audits', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const skip = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const warehouseId = req.query.warehouseId as string | undefined;
    const checklistId = req.query.checklistId as string | undefined;
    const auditorId = req.query.auditorId as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = (req.query.sortDir as 'asc' | 'desc') || 'desc';

    const { data, total } = await complianceService.listAudits({
      skip,
      pageSize,
      sortBy,
      sortDir,
      search,
      status,
      warehouseId,
      checklistId,
      auditorId,
    });

    sendSuccess(res, data, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// ── POST /audits — Create new audit ─────────────────────────────────────

router.post('/audits', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await complianceService.createAudit(req.body, req.user!.userId);
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /audits/:id — Get audit detail ──────────────────────────────────

router.get('/audits/:id', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await complianceService.getAuditById(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── PUT /audits/:id — Update audit ──────────────────────────────────────

router.put('/audits/:id', requireRole(...ALLOWED_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await complianceService.updateAudit(req.params.id as string, req.body);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── POST /audits/:id/responses — Submit audit responses ─────────────────

router.post(
  '/audits/:id/responses',
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { responses } = req.body as {
        responses: Array<{
          checklistItemId: string;
          response: string;
          evidence?: string;
          notes?: string;
          score?: number;
        }>;
      };

      if (!Array.isArray(responses) || responses.length === 0) {
        sendError(res, 400, 'responses must be a non-empty array');
        return;
      }

      const data = await complianceService.submitResponses(req.params.id as string, responses);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /audits/:id/complete — Complete audit ──────────────────────────

router.post(
  '/audits/:id/complete',
  requireRole(...ALLOWED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceService.completeAudit(req.params.id as string, req.user!.userId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
