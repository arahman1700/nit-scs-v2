import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getAuditLogs } from '../services/audit.service.js';
import { auditLogQuerySchema } from '../schemas/system.schema.js';

const router = Router();

// All routes require authenticate + audit-log read permission
router.use(authenticate, requirePermission('audit-log', 'read'));

// ── GET / — List audit logs with filters ────────────────────────────────

router.get('/', validate(auditLogQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tableName, recordId, action, performedById, page, pageSize } = (res.locals.validatedQuery || req.query) as {
      tableName?: string;
      recordId?: string;
      action?: string;
      performedById?: string;
      page: number;
      pageSize: number;
    };

    const result = await getAuditLogs({
      tableName,
      recordId,
      action,
      performedById,
      page,
      pageSize,
    });

    sendSuccess(res, result.data, {
      page,
      pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get single audit log entry ───────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const entry = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        performedBy: { select: { fullName: true, email: true } },
      },
    });

    if (!entry) {
      sendError(res, 404, 'Audit log entry not found');
      return;
    }

    sendSuccess(res, entry);
  } catch (err) {
    next(err);
  }
});

export default router;
