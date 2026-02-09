import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import * as attachmentService from '../services/attachment.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../uploads/attachments');

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.csv': ['text/csv', 'application/csv', 'text/plain'],
  '.txt': ['text/plain'],
  '.zip': ['application/zip'],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const allowedMimes = ALLOWED_TYPES[ext];
    if (!allowedMimes) {
      cb(new Error(`File type ${ext} not allowed`));
      return;
    }
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error(`MIME type mismatch for ${ext}`));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// GET /api/v1/attachments/:entityType/:recordId
router.get('/:entityType/:recordId', authenticate, async (req: Request, res: Response) => {
  try {
    const { entityType, recordId } = req.params;
    attachmentService.validateEntityType(entityType as string);
    const attachments = await attachmentService.listByEntity(entityType as string, recordId as string);
    sendSuccess(res, attachments);
  } catch (err) {
    sendError(res, 400, (err as Error).message);
  }
});

// POST /api/v1/attachments/:entityType/:recordId
router.post('/:entityType/:recordId', authenticate, (req: Request, res: Response) => {
  const { entityType, recordId } = req.params;
  try {
    attachmentService.validateEntityType(entityType as string);
  } catch (err) {
    sendError(res, 400, (err as Error).message);
    return;
  }

  upload.single('file')(req, res, async err => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 400, 'File too large. Maximum size is 10MB.');
      }
      return sendError(res, 400, err.message);
    }
    if (err) {
      return sendError(res, 400, err.message);
    }
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    try {
      const attachment = await attachmentService.create({
        entityType: entityType as string,
        recordId: recordId as string,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        uploadedById: (req as any).user.id,
      });
      sendSuccess(res, attachment);
    } catch (serviceErr) {
      sendError(res, 500, (serviceErr as Error).message);
    }
  });
});

// GET /api/v1/attachments/:id/download
router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  try {
    const attachment = await attachmentService.getById(req.params.id as string);
    const filePath = join(UPLOADS_DIR, attachment.fileName);

    if (!existsSync(filePath)) {
      sendError(res, 404, 'File not found on disk');
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.mimeType);
    res.sendFile(filePath);
  } catch (err) {
    const status = (err as any).statusCode ?? 500;
    sendError(res, status, (err as Error).message);
  }
});

// DELETE /api/v1/attachments/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await attachmentService.softDelete(req.params.id as string);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    const status = (err as any).statusCode ?? 500;
    sendError(res, status, (err as Error).message);
  }
});

export default router;
