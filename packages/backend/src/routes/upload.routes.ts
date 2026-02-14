import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../uploads');

// Ensure uploads directory exists
try {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // In Docker, the directory is pre-created by the Dockerfile
  console.warn(`[Upload] Could not create uploads dir at ${UPLOADS_DIR} — using /tmp/uploads fallback`);
}

// ── Allowed file types with MIME validation ──────────────────────────────

const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.csv': ['text/csv', 'application/csv', 'text/plain'],
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const allowedMimes = ALLOWED_TYPES[ext];

    if (!allowedMimes) {
      cb(new Error(`File type ${ext} not allowed`));
      return;
    }

    // Validate MIME type matches extension (prevents disguised file uploads)
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error(`File MIME type ${file.mimetype} does not match extension ${ext}`));
      return;
    }

    cb(null, true);
  },
});

const router = Router();

// POST /api/upload — Upload a single file (auth required)
router.post('/', authenticate, (req: Request, res: Response, _next: NextFunction) => {
  upload.single('file')(req, res, err => {
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

    // Return the API-served URL (not a direct static path)
    const fileUrl = `/api/v1/upload/files/${req.file.filename}`;
    sendSuccess(res, {
      url: fileUrl,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

// GET /api/upload/files/:filename — Serve uploaded files (auth required)
router.get('/files/:filename', authenticate, (req: Request, res: Response) => {
  const { filename } = req.params;

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    sendError(res, 400, 'Invalid filename');
    return;
  }

  const filePath = join(UPLOADS_DIR, filename as string);
  if (!existsSync(filePath)) {
    sendError(res, 404, 'File not found');
    return;
  }

  // Set security headers for file serving
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(filePath);
});

export default router;
