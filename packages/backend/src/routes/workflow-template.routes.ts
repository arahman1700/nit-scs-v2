import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';
import { invalidateRuleCache } from '../events/rule-cache.js';
import type { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ── GET / — List all templates (optionally filter by category) ─────────
router.get('/', async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined;
    const where: Prisma.WorkflowTemplateWhereInput = category ? { category } : {};
    const templates = await prisma.workflowTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    sendSuccess(res, templates);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get a single template ───────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const template = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!template) {
      sendError(res, 404, 'Template not found');
      return;
    }
    sendSuccess(res, template);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/install — Install a template (creates Workflow + Rules) ──
router.post('/:id/install', requirePermission('workflow_template', 'create'), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const template = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!template) {
      sendError(res, 404, 'Template not found');
      return;
    }

    const tmpl = template.template as {
      workflow: { name: string; entityType: string };
      rules: Array<{
        name: string;
        triggerEvent: string;
        conditions: unknown;
        actions: unknown[];
      }>;
    };

    // Create the workflow with its rules in a transaction
    const workflow = await prisma.$transaction(async tx => {
      const wf = await tx.workflow.create({
        data: {
          name: `${tmpl.workflow.name} (from template)`,
          entityType: tmpl.workflow.entityType,
          isActive: true,
          priority: 10,
        },
      });

      if (tmpl.rules?.length) {
        await tx.workflowRule.createMany({
          data: tmpl.rules.map((rule, idx) => ({
            workflowId: wf.id,
            name: rule.name,
            triggerEvent: rule.triggerEvent,
            conditions: rule.conditions as Prisma.InputJsonValue,
            actions: rule.actions as unknown as Prisma.InputJsonValue,
            isActive: true,
            sortOrder: idx,
          })),
        });
      }

      // Increment install count
      await tx.workflowTemplate.update({
        where: { id },
        data: { installCount: { increment: 1 } },
      });

      return wf;
    });

    invalidateRuleCache();
    sendCreated(res, { workflowId: workflow.id });
  } catch (err) {
    next(err);
  }
});

export default router;
