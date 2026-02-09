import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';
import { invalidateRuleCache } from '../events/rule-cache.js';
import { createRuleSchema, updateRuleSchema, testRuleSchema } from '../schemas/workflow.schema.js';
import { eventBus } from '../events/event-bus.js';

const router = Router({ mergeParams: true });

// Helper: Express 5 mergeParams doesn't type parent params
function getWorkflowId(req: import('express').Request): string {
  return (req.params as Record<string, string>).workflowId;
}

// All rule routes require admin/manager
router.use(authenticate, requireRole('admin', 'manager'));

// GET /api/workflows/:workflowId/rules — list rules for a workflow
router.get('/', async (req, res, next) => {
  try {
    const workflowId = getWorkflowId(req);
    const rules = await prisma.workflowRule.findMany({
      where: { workflowId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { executionLogs: true } } },
    });
    sendSuccess(res, rules);
  } catch (err) {
    next(err);
  }
});

// GET /api/workflows/:workflowId/rules/:id — get a single rule
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const rule = await prisma.workflowRule.findUnique({
      where: { id },
      include: {
        executionLogs: {
          orderBy: { executedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!rule) {
      sendError(res, 404, 'Rule not found');
      return;
    }
    sendSuccess(res, rule);
  } catch (err) {
    next(err);
  }
});

// POST /api/workflows/:workflowId/rules — create a rule
router.post('/', async (req, res, next) => {
  try {
    const workflowId = getWorkflowId(req);
    const parsed = createRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', parsed.error.errors);
      return;
    }

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      sendError(res, 404, 'Workflow not found');
      return;
    }

    const rule = await prisma.workflowRule.create({
      data: {
        ...parsed.data,
        conditions: parsed.data.conditions as object,
        actions: parsed.data.actions as unknown as object,
        workflowId,
      },
    });

    invalidateRuleCache();
    sendCreated(res, rule);
  } catch (err) {
    next(err);
  }
});

// PUT /api/workflows/:workflowId/rules/:id — update a rule
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const parsed = updateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', parsed.error.errors);
      return;
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.conditions) data.conditions = parsed.data.conditions as object;
    if (parsed.data.actions) data.actions = parsed.data.actions as unknown as object;

    const rule = await prisma.workflowRule.update({
      where: { id },
      data,
    });

    invalidateRuleCache();
    sendSuccess(res, rule);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workflows/:workflowId/rules/:id — delete a rule
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.workflowRule.delete({ where: { id } });
    invalidateRuleCache();
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/workflows/:workflowId/rules/:id/test — test a rule with a simulated event
router.post('/:id/test', async (req, res, next) => {
  try {
    const parsed = testRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', parsed.error.errors);
      return;
    }

    const testEvent = {
      ...parsed.data.event,
      timestamp: parsed.data.event.timestamp || new Date().toISOString(),
    };

    // Publish the test event — the rule engine will pick it up and log execution
    eventBus.publish(testEvent);

    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch the latest execution log for this rule
    const id = req.params.id as string;
    const latestLog = await prisma.workflowExecutionLog.findFirst({
      where: { ruleId: id },
      orderBy: { executedAt: 'desc' },
    });

    sendSuccess(res, {
      message: 'Test event published',
      event: testEvent,
      latestExecution: latestLog,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/workflows/:workflowId/rules/:id/logs — get execution logs for a rule
router.get('/:id/logs', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '20', 10);

    const [logs, total] = await Promise.all([
      prisma.workflowExecutionLog.findMany({
        where: { ruleId: id },
        orderBy: { executedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workflowExecutionLog.count({ where: { ruleId: id } }),
    ]);

    sendSuccess(res, logs, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

export default router;
