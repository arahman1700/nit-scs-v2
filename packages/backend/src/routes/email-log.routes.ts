import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

// Email logs require authentication + read permission
router.use(authenticate, requirePermission('email_log', 'read'));

// GET /api/email-logs — list email logs with filters
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
    const status = req.query.status as string | undefined;
    const templateId = req.query.templateId as string | undefined;
    const toEmail = req.query.toEmail as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (templateId) where.templateId = templateId;
    if (toEmail) where.toEmail = { contains: toEmail, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: {
          template: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.emailLog.count({ where }),
    ]);

    sendSuccess(res, logs, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/email-logs/stats — email delivery stats
router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await prisma.emailLog.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    sendSuccess(
      res,
      stats.map(s => ({ status: s.status, count: s._count.id })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
