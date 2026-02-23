import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { importExecuteSchema } from '../schemas/import.schema.js';
import { parseExcelPreview, executeImport, getExpectedFields } from '../services/import.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { clientIp } from '../utils/helpers.js';
import { extname } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import type { ImportableEntity } from '../schemas/import.schema.js';

const router = Router();

// In-memory multer for Excel parsing (no need to save to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const extension = extname(file.originalname || '').toLowerCase();
    const isXlsx =
      extension === '.xlsx' && file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const isCsv =
      extension === '.csv' && ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.mimetype);

    if (isXlsx || isCsv) {
      cb(null, true);
      return;
    }

    cb(new Error('Only .xlsx and .csv files are accepted'));
  },
});

const WRITE_ROLES = ['admin', 'manager'];

/**
 * GET /import/fields/:entity
 * Get expected fields for an entity (for the mapping dialog).
 */
router.get(
  '/fields/:entity',
  authenticate,
  requireRole(...WRITE_ROLES),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = req.params.entity as string as ImportableEntity;
      const fields = getExpectedFields(entity);
      sendSuccess(res, { entity, fields });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /import/preview
 * Upload an Excel file and get a preview with headers and sample rows.
 */
router.post(
  '/preview',
  authenticate,
  requireRole(...WRITE_ROLES),
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, err => {
      if (err) {
        sendError(res, 400, err.message);
        return;
      }
      if (!req.file) {
        sendError(res, 400, 'No file uploaded');
        return;
      }

      const entity = (req.body.entity || req.query.entity) as string as ImportableEntity;
      if (!entity) {
        sendError(res, 400, 'Entity type is required');
        return;
      }

      parseExcelPreview(req.file.buffer, entity)
        .then(preview => sendSuccess(res, preview))
        .catch(parseErr => next(parseErr));
    });
  },
);

/**
 * POST /import/execute
 * Execute the import with column mapping and parsed data.
 */
router.post(
  '/execute',
  authenticate,
  requireRole(...WRITE_ROLES),
  validate(importExecuteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entity, mapping, rows } = req.body as {
        entity: ImportableEntity;
        mapping: Record<string, string>;
        rows: Record<string, unknown>[];
      };

      const result = await executeImport(entity, mapping, rows);

      // Audit the import
      await createAuditLog({
        tableName: entity,
        recordId: 'import',
        action: 'create',
        newValues: {
          entity,
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
        },
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      // Emit entity event to refresh lists
      const io = req.app.get('io');
      if (io && result.succeeded > 0) {
        io.emit('entity:created', { entity });
      }

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
