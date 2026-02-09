import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';
import { invalidateRuleCache } from '../events/rule-cache.js';
import { createWorkflowSchema, updateWorkflowSchema } from '../schemas/workflow.schema.js';

const router = Router();

// All workflow routes require admin/manager
router.use(authenticate, requireRole('admin', 'manager'));

// GET /api/workflows — list all workflows
router.get('/', async (_req, res, next) => {
  try {
    const workflows = await prisma.workflow.findMany({
      include: { _count: { select: { rules: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    sendSuccess(res, workflows);
  } catch (err) {
    next(err);
  }
});

// GET /api/workflows/:id — get workflow with rules
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        rules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!workflow) {
      sendError(res, 404, 'Workflow not found');
      return;
    }
    sendSuccess(res, workflow);
  } catch (err) {
    next(err);
  }
});

// POST /api/workflows — create workflow
router.post('/', async (req, res, next) => {
  try {
    const parsed = createWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', parsed.error.errors);
      return;
    }
    const workflow = await prisma.workflow.create({ data: parsed.data });
    invalidateRuleCache();
    sendCreated(res, workflow);
  } catch (err) {
    next(err);
  }
});

// PUT /api/workflows/:id — update workflow
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const parsed = updateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', parsed.error.errors);
      return;
    }
    const workflow = await prisma.workflow.update({
      where: { id },
      data: parsed.data,
    });
    invalidateRuleCache();
    sendSuccess(res, workflow);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workflows/:id — delete workflow and all its rules
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.workflow.delete({ where: { id } });
    invalidateRuleCache();
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// PUT /api/workflows/:id/activate — activate a workflow
router.put('/:id/activate', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const workflow = await prisma.workflow.update({
      where: { id },
      data: { isActive: true },
    });
    invalidateRuleCache();
    sendSuccess(res, workflow);
  } catch (err) {
    next(err);
  }
});

// PUT /api/workflows/:id/deactivate — deactivate a workflow
router.put('/:id/deactivate', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const workflow = await prisma.workflow.update({
      where: { id },
      data: { isActive: false },
    });
    invalidateRuleCache();
    sendSuccess(res, workflow);
  } catch (err) {
    next(err);
  }
});

export default router;
