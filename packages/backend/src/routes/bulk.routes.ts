import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { bulkActionSchema } from '../schemas/bulk.schema.js';
import { executeBulkAction, getAvailableBulkActions } from '../services/bulk.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { clientIp } from '../utils/helpers.js';
import { emitToAll } from '../socket/setup.js';
import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';

const router = Router();

/**
 * GET /bulk/actions/:documentType
 * List available bulk actions for a document type.
 */
router.get('/actions/:documentType', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentType = req.params.documentType as string;
    const actions = getAvailableBulkActions(documentType);
    sendSuccess(res, { documentType, actions });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /bulk/execute
 * Execute a bulk action on multiple documents.
 * Body: { documentType, ids: string[], action: string, payload?: {} }
 */
router.post(
  '/execute',
  authenticate,
  validate(bulkActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentType, ids, action } = req.body as {
        documentType: string;
        ids: string[];
        action: string;
      };
      const userId = req.user!.userId;
      const io = req.app.get('io') as SocketIOServer | undefined;

      // Verify action is available
      const available = getAvailableBulkActions(documentType);
      if (!available.includes(action)) {
        sendError(
          res,
          400,
          `Action "${action}" is not available for bulk operations on "${documentType}". Available: ${available.join(', ')}`,
        );
        return;
      }

      const results = await executeBulkAction(documentType, ids, action, userId, io);

      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      // Audit log for the bulk operation
      await createAuditLog({
        tableName: documentType,
        recordId: 'bulk',
        action: 'update',
        newValues: { action, ids, succeeded, failed },
        performedById: userId,
        ipAddress: clientIp(req),
      });

      // Emit entity update event to refresh lists
      if (io && succeeded > 0) {
        emitToAll(io, 'entity:updated', { entity: documentType });
      }

      sendSuccess(res, {
        documentType,
        action,
        total: ids.length,
        succeeded,
        failed,
        results,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
