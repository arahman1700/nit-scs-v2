import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';
import { previewTemplate } from '../services/email.service.js';

const router = Router();

// All template routes require admin
router.use(authenticate, requireRole('admin'));

// GET /api/email-templates — list all templates
router.get('/', async (_req, res, next) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { emailLogs: true } } },
    });
    sendSuccess(res, templates);
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
router.post('/', async (req, res, next) => {
  try {
    const { code, name, subject, bodyHtml, variables, isActive } = req.body;
    if (!code || !name || !subject || !bodyHtml) {
      sendError(res, 400, 'code, name, subject, and bodyHtml are required');
      return;
    }
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
});

// PUT /api/email-templates/:id — update a template
router.put('/:id', async (req, res, next) => {
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
});

// DELETE /api/email-templates/:id — delete a template
router.delete('/:id', async (req, res, next) => {
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
