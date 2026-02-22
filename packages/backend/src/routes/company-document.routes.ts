import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { updateDocumentSchema } from '../schemas/company-document.schema.js';

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '../../uploads/documents');

if (!existsSync(DOCS_DIR)) {
  mkdirSync(DOCS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCS_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for company docs
});

// Visibility filter based on user's system role
function visibilityFilter(systemRole: string) {
  if (systemRole === 'admin') return {}; // admin sees all
  if (['manager', 'logistics_coordinator'].includes(systemRole)) {
    return { visibility: { in: ['all', 'management'] } };
  }
  return { visibility: 'all' };
}

async function findAccessibleDocumentById(id: string, systemRole: string) {
  return prisma.companyDocument.findFirst({
    where: {
      id,
      isActive: true,
      ...visibilityFilter(systemRole),
    },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
  });
}

// GET /api/documents — List (filterable by category, visibility-filtered)
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10)));
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {
      isActive: true,
      ...visibilityFilter(req.user!.systemRole),
    };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [docs, total] = await Promise.all([
      prisma.companyDocument.findMany({
        where,
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.companyDocument.count({ where }),
    ]);

    sendSuccess(res, docs, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/categories — Category counts
router.get('/categories', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where = { isActive: true, ...visibilityFilter(req.user!.systemRole) };
    const categories = await prisma.companyDocument.groupBy({
      by: ['category'],
      where,
      _count: { id: true },
    });
    const result = categories.map(c => ({ category: c.category, count: c._count.id }));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id — Get metadata
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const doc = await findAccessibleDocumentById(id, req.user!.systemRole);
    if (!doc) {
      sendError(res, 404, 'Document not found');
      return;
    }
    sendSuccess(res, doc);
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id/download — Download file (visibility-filtered)
router.get('/:id/download', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const doc = await findAccessibleDocumentById(id, req.user!.systemRole);
    if (!doc) {
      sendError(res, 404, 'Document not found');
      return;
    }

    const filePath = join(DOCS_DIR, basename(doc.filePath));
    if (!existsSync(filePath)) {
      sendError(res, 404, 'Document file not found on disk');
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    res.setHeader('Content-Type', doc.mimeType);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents — Upload + create (admin, manager)
router.post('/', authenticate, requireRole('admin', 'manager'), (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, async err => {
    if (err instanceof multer.MulterError) {
      return sendError(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 25MB)' : err.message);
    }
    if (err) return sendError(res, 400, err.message);
    if (!req.file) return sendError(res, 400, 'No file uploaded');

    try {
      const doc = await prisma.companyDocument.create({
        data: {
          title: String(req.body.title || req.file.originalname),
          description: req.body.description || undefined,
          category: req.body.category || 'other',
          filePath: `/uploads/documents/${req.file.filename}`,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          tags: req.body.tags ? JSON.parse(req.body.tags) : [],
          visibility: req.body.visibility || 'all',
          uploadedById: req.user!.userId,
        },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
      });

      const io = req.app.get('io');
      io?.emit('entity:created', { entity: 'documents' });
      sendCreated(res, doc);
    } catch (error) {
      next(error);
    }
  });
});

// PUT /api/documents/:id — Update metadata (admin, manager)
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  validate(updateDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.companyDocument.findUnique({ where: { id } });
      if (!existing) {
        sendError(res, 404, 'Document not found');
        return;
      }

      const doc = await prisma.companyDocument.update({
        where: { id },
        data: req.body,
        include: { uploadedBy: { select: { id: true, fullName: true } } },
      });
      const io = req.app.get('io');
      io?.emit('entity:updated', { entity: 'documents' });
      sendSuccess(res, doc);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/documents/:id — Soft-delete (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.companyDocument.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, 'Document not found');
      return;
    }

    await prisma.companyDocument.update({ where: { id }, data: { isActive: false } });
    const io = req.app.get('io');
    io?.emit('entity:deleted', { entity: 'documents' });
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

export default router;
