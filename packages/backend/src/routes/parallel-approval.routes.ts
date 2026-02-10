import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  createParallelApproval,
  respondToApproval,
  getGroupStatus,
  getPendingForApprover,
} from '../services/parallel-approval.service.js';

const router = Router();

// All parallel approval routes require authentication
router.use(authenticate);

// ── GET /parallel-approvals/pending — Pending for current user ──────────
// NOTE: This must be registered BEFORE the generic GET / route to avoid
// matching "pending" as a query-param route.
router.get('/pending', async (req, res) => {
  try {
    const groups = await getPendingForApprover(req.user!.userId);
    sendSuccess(res, groups);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// ── GET /parallel-approvals?documentType=X&documentId=Y — Groups for doc ─
router.get('/', async (req, res) => {
  try {
    const { documentType, documentId } = req.query;

    if (!documentType || !documentId) {
      sendError(res, 400, 'Query params documentType and documentId are required');
      return;
    }

    const groups = await getGroupStatus(documentType as string, documentId as string);

    sendSuccess(res, groups);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// ── POST /parallel-approvals — Create a parallel approval group ─────────
router.post('/', async (req, res) => {
  try {
    const { documentType, documentId, level, mode, approverIds } = req.body;

    if (!documentType || !documentId || level == null || !mode || !Array.isArray(approverIds)) {
      sendError(res, 400, 'Missing required fields: documentType, documentId, level, mode, approverIds[]');
      return;
    }

    if (!['all', 'any'].includes(mode)) {
      sendError(res, 400, "Mode must be 'all' or 'any'");
      return;
    }

    const group = await createParallelApproval({
      documentType,
      documentId,
      level: Number(level),
      mode,
      approverIds,
    });

    res.status(201);
    sendSuccess(res, group);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('not found') || message.includes('inactive') ? 404 : 500;
    sendError(res, status, message);
  }
});

// ── POST /parallel-approvals/:groupId/respond — Submit decision ─────────
router.post('/:groupId/respond', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { decision, comments } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      sendError(res, 400, "Decision must be 'approved' or 'rejected'");
      return;
    }

    const group = await respondToApproval({
      groupId,
      approverId: req.user!.userId,
      decision,
      comments,
    });

    sendSuccess(res, group);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes('not found') ? 404 : message.includes('already') ? 409 : 500;
    sendError(res, status, message);
  }
});

export default router;
