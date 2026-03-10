import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { validate } from '../../../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../../../utils/response.js';
import { prisma } from '../../../utils/prisma.js';
import { previewTemplate } from '../services/email.service.js';

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const createEmailTemplateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  bodyHtml: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const router = Router();

const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '25'), 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

// All template routes require authentication + read permission
router.use(authenticate, requirePermission('email_template', 'read'));

// GET /api/email-templates — list all templates
router.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        orderBy: { code: 'asc' },
        include: { _count: { select: { emailLogs: true } } },
        skip,
        take: pageSize,
      }),
      prisma.emailTemplate.count(),
    ]);

    sendSuccess(res, templates, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/email-templates/:id — get a single template
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) {
      sendError(res, 404, 'Email template not found');
      return;
    }
    sendSuccess(res, template);
  } catch (err) {
    next(err);
  }
});

// POST /api/email-templates — create a template
router.post(
  '/',
  requirePermission('email_template', 'create'),
  validate(createEmailTemplateSchema),
  async (req, res, next) => {
    try {
      const { code, name, subject, bodyHtml, variables, isActive } = req.body;
      const template = await prisma.emailTemplate.create({
        data: {
          code,
          name,
          subject,
          bodyHtml,
          variables: variables || [],
          isActive: isActive !== false,
        },
      });
      sendCreated(res, template);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/email-templates/:id — update a template
router.put(
  '/:id',
  requirePermission('email_template', 'update'),
  validate(updateEmailTemplateSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const { name, subject, bodyHtml, variables, isActive } = req.body;
      const template = await prisma.emailTemplate.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(subject !== undefined && { subject }),
          ...(bodyHtml !== undefined && { bodyHtml }),
          ...(variables !== undefined && { variables }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      sendSuccess(res, template);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/email-templates/:id — delete a template
router.delete('/:id', requirePermission('email_template', 'delete'), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.emailTemplate.delete({ where: { id } });
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/email-templates/:id/preview — preview a template with sample data
router.post('/:id/preview', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) {
      sendError(res, 404, 'Email template not found');
      return;
    }
    const variables = (req.body.variables as Record<string, unknown>) || {};
    const preview = previewTemplate(template.bodyHtml, template.subject, variables);
    sendSuccess(res, preview);
  } catch (err) {
    next(err);
  }
});

export default router;
