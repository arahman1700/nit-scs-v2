import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getApprovalSteps, getPendingApprovalsForUser, getApprovalChain } from '../services/approval.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// All approval routes require authentication
router.use(authenticate);

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
    const { documentType, amount } = req.params;
    const chain = await getApprovalChain(documentType, Number(amount));
    sendSuccess(res, chain);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// GET /api/v1/approvals/steps/:documentType/:documentId — Get approval steps for a document
router.get('/steps/:documentType/:documentId', async (req, res) => {
  try {
    const { documentType, documentId } = req.params;
    const steps = await getApprovalSteps(documentType, documentId);
    sendSuccess(res, steps);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

export default router;
