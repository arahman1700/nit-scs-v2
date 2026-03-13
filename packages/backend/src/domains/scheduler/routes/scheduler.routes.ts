/**
 * Scheduler Admin Routes — Job management, history, and DLQ operations
 *
 * Provides admin-only endpoints for managing BullMQ scheduled jobs:
 * - List all registered jobs with their status
 * - Trigger immediate job execution
 * - Pause / resume individual jobs
 * - View job execution history
 * - Manage the Dead Letter Queue (list, retry, delete)
 */

import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import {
  getSchedulerJobs,
  triggerJob,
  pauseJob,
  resumeJob,
  getJobHistory,
  getDlqEntries,
  retryDlqEntry,
  deleteDlqEntry,
} from '../services/scheduler-admin.service.js';

const router = Router();

// All scheduler admin routes require authentication + settings permission
router.use(authenticate, requirePermission('settings', 'read'));

// ── GET /scheduler/jobs — List all scheduled jobs with status ─────────────
router.get('/jobs', async (_req, res, next) => {
  try {
    const jobs = await getSchedulerJobs();
    sendSuccess(res, jobs);
  } catch (err) {
    next(err);
  }
});

// ── POST /scheduler/jobs/:jobName/run — Trigger immediate execution ──────
router.post('/jobs/:jobName/run', requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const jobName = String(req.params.jobName);
    const result = await triggerJob(jobName);
    if (!result.found) {
      sendError(res, 404, `Job "${jobName}" not found`);
      return;
    }
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── POST /scheduler/jobs/:jobName/pause — Pause a repeatable job ─────────
router.post('/jobs/:jobName/pause', requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const jobName = String(req.params.jobName);
    const result = await pauseJob(jobName);
    if (!result.found) {
      sendError(res, 404, `Job "${jobName}" not found`);
      return;
    }
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── POST /scheduler/jobs/:jobName/resume — Resume a paused job ──────────
router.post('/jobs/:jobName/resume', requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const jobName = String(req.params.jobName);
    const result = await resumeJob(jobName);
    if (!result.found) {
      sendError(res, 404, `Job "${jobName}" not found`);
      return;
    }
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ── GET /scheduler/jobs/:jobName/history — Execution history ─────────────
router.get('/jobs/:jobName/history', async (req, res, next) => {
  try {
    const jobName = String(req.params.jobName);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10)));
    const result = await getJobHistory(jobName, page, pageSize);
    if (!result.found) {
      sendError(res, 404, `Job "${jobName}" not found`);
      return;
    }
    sendSuccess(res, result.entries, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /scheduler/dlq — Dead Letter Queue entries ───────────────────────
router.get('/dlq', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10)));
    const result = await getDlqEntries(page, pageSize);
    sendSuccess(res, result.entries, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /scheduler/dlq/:id/retry — Retry a DLQ entry ───────────────────
router.post('/dlq/:id/retry', requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const success = await retryDlqEntry(id);
    if (!success) {
      sendError(res, 404, `DLQ entry "${id}" not found`);
      return;
    }
    sendSuccess(res, { id, retried: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /scheduler/dlq/:id — Remove a DLQ entry ──────────────────────
router.delete('/dlq/:id', requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const success = await deleteDlqEntry(id);
    if (!success) {
      sendError(res, 404, `DLQ entry "${id}" not found`);
      return;
    }
    sendSuccess(res, { id, deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
