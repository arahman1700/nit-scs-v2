import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import {
  getEventBusMonitorStats,
  getQueueStats,
  getDlqJobs,
  retryDlqJob,
} from '../services/eventbus-monitor.service.js';

const router = Router();

// GET /api/monitor/eventbus/stats — EventBus instrumentation stats
router.get('/eventbus/stats', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const stats = getEventBusMonitorStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/monitor/queues/stats — BullMQ queue job counts
router.get('/queues/stats', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const stats = await getQueueStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/monitor/queues/dlq — Dead Letter Queue entries (paginated)
router.get('/queues/dlq', authenticate, requirePermission('settings', 'read'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10)));
    const result = await getDlqJobs(page, pageSize);
    sendSuccess(res, result.jobs, { page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (err) {
    next(err);
  }
});

// POST /api/monitor/queues/dlq/:jobId/retry — Retry a specific DLQ job
router.post(
  '/queues/dlq/:jobId/retry',
  authenticate,
  requirePermission('settings', 'update'),
  async (req, res, next) => {
    try {
      const jobId = String(req.params.jobId);
      const success = await retryDlqJob(jobId);
      if (!success) {
        sendError(res, 404, `DLQ job ${jobId} not found`);
        return;
      }
      sendSuccess(res, { jobId, retried: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
