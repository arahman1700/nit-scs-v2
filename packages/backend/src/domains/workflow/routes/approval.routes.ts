import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { getApprovalSteps, getPendingApprovalsForUser, getApprovalChain } from '../services/approval.service.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import { prisma } from '../../../utils/prisma.js';

const router = Router();

const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '25'), 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

// All approval routes require authentication
router.use(authenticate);

// ── Existing read routes ────────────────────────────────────────────────

// GET /api/v1/approvals/pending — Get pending approvals for current user
router.get('/pending', async (req, res) => {
  try {
    const steps = await getPendingApprovalsForUser(req.user!.userId);
    sendSuccess(res, steps);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// GET /api/v1/approvals/chain/:documentType/:amount — Get approval chain for a doc type/amount
router.get('/chain/:documentType/:amount', async (req, res) => {
  try {
    const documentType = req.params.documentType as string;
    const amount = Number(req.params.amount);
    const chain = await getApprovalChain(documentType, amount);
    sendSuccess(res, chain);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// GET /api/v1/approvals/steps/:documentType/:documentId — Get approval steps for a document
router.get('/steps/:documentType/:documentId', async (req, res) => {
  try {
    const documentType = req.params.documentType as string;
    const documentId = req.params.documentId as string;
    const steps = await getApprovalSteps(documentType, documentId);
    sendSuccess(res, steps);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// ── Workflow CRUD (admin-only) ──────────────────────────────────────────

// GET /api/v1/approvals/workflows — List all approval workflow rules
router.get('/workflows', async (req, res) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);

    const [workflows, total] = await Promise.all([
      prisma.approvalWorkflow.findMany({
        orderBy: [{ documentType: 'asc' }, { minAmount: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.approvalWorkflow.count(),
    ]);

    sendSuccess(res, workflows, { page, pageSize, total });
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// GET /api/v1/approvals/workflows/:documentType — List workflows for a specific document type
router.get('/workflows/:documentType', async (req, res) => {
  try {
    const documentType = req.params.documentType as string;
    const workflows = await prisma.approvalWorkflow.findMany({
      where: { documentType },
      orderBy: { minAmount: 'asc' },
    });
    sendSuccess(res, workflows);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// POST /api/v1/approvals/workflows — Create a new workflow rule
router.post('/workflows', requireRole('admin'), async (req, res) => {
  try {
    const { documentType, minAmount, maxAmount, approverRole, slaHours } = req.body;
    if (!documentType || minAmount == null || !approverRole || !slaHours) {
      sendError(res, 400, 'documentType, minAmount, approverRole, and slaHours are required');
      return;
    }
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        documentType,
        minAmount,
        maxAmount: maxAmount ?? null,
        approverRole,
        slaHours: Number(slaHours),
      },
    });
    sendSuccess(res, workflow);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// PUT /api/v1/approvals/workflows/:id — Update a workflow rule
router.put('/workflows/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { documentType, minAmount, maxAmount, approverRole, slaHours } = req.body;
    const workflow = await prisma.approvalWorkflow.update({
      where: { id },
      data: {
        ...(documentType !== undefined && { documentType }),
        ...(minAmount !== undefined && { minAmount }),
        ...(maxAmount !== undefined && { maxAmount }),
        ...(approverRole !== undefined && { approverRole }),
        ...(slaHours !== undefined && { slaHours: Number(slaHours) }),
      },
    });
    sendSuccess(res, workflow);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// DELETE /api/v1/approvals/workflows/:id — Delete a workflow rule
router.delete('/workflows/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.approvalWorkflow.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

export default router;
