/**
 * Integration tests for EventBus monitor routes.
 *
 * Covers:
 *   GET  /api/v1/monitor/eventbus/stats
 *   GET  /api/v1/monitor/queues/stats
 *   GET  /api/v1/monitor/queues/dlq
 *   POST /api/v1/monitor/queues/dlq/:jobId/retry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

// ── Infrastructure mocks (must come before any imports that trigger them) ──

vi.mock('../../../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));

vi.mock('../../../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
  emitEntityEvent: vi.fn(),
}));

vi.mock('../../../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));

vi.mock('../../../utils/prisma.js', () => {
  const mockDb = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  );
  return { prisma: mockDb, prismaRead: mockDb };
});

vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockImplementation(async (role: string) => {
    // admin and manager have settings read/update; viewer only has read
    return role === 'admin' || role === 'manager' || role === 'viewer';
  }),
}));

// ── Service-layer mocks ────────────────────────────────────────────────────

vi.mock('../services/eventbus-monitor.service.js', () => ({
  getEventBusMonitorStats: vi.fn(),
  getQueueStats: vi.fn(),
  getDlqJobs: vi.fn(),
  retryDlqJob: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import supertest from 'supertest';
import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import * as monitorService from '../services/eventbus-monitor.service.js';
import * as permissionService from '../../auth/services/permission.service.js';

const app = createTestApp();
const request = supertest(app);

const BASE = '/api/v1/monitor';

// Shared tokens
const ADMIN_TOKEN = signTestToken({ userId: 'admin-user', systemRole: 'admin' });
const VIEWER_TOKEN = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });

// ── Sample fixtures ────────────────────────────────────────────────────────

const SAMPLE_EVENTBUS_STATS = {
  totalPublished: 42,
  totalDelivered: 40,
  totalFailed: 2,
  listeners: { 'grn.created': 3, 'mi.approved': 1 },
};

const SAMPLE_QUEUE_STATS = [
  { name: 'notifications', waiting: 5, active: 1, completed: 100, failed: 3, delayed: 0, paused: 0 },
  { name: 'dlq', waiting: 2, active: 0, completed: 0, failed: 10, delayed: 0, paused: 0 },
];

const SAMPLE_DLQ_PAGE = {
  jobs: [
    {
      id: 'job-1',
      name: 'send-email',
      data: { to: 'user@example.com' },
      failedReason: 'SMTP timeout',
      timestamp: 1700000000000,
      processedOn: 1700000001000,
      finishedOn: 1700000002000,
    },
    {
      id: 'job-2',
      name: 'push-notification',
      data: { userId: 'u-2' },
      failedReason: 'FCM error',
      timestamp: 1700000003000,
      processedOn: undefined,
      finishedOn: undefined,
    },
  ],
  total: 12,
  page: 1,
  pageSize: 20,
};

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: permission granted for all roles (controlled per test where needed)
  vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// GET /api/v1/monitor/eventbus/stats
// ---------------------------------------------------------------------------

describe('GET /monitor/eventbus/stats', () => {
  it('returns 200 with EventBus stats for admin', async () => {
    vi.mocked(monitorService.getEventBusMonitorStats).mockReturnValue(SAMPLE_EVENTBUS_STATS as never);

    const res = await request.get(`${BASE}/eventbus/stats`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(SAMPLE_EVENTBUS_STATS);
    expect(monitorService.getEventBusMonitorStats).toHaveBeenCalledOnce();
  });

  it('returns 200 with EventBus stats for viewer (settings read allowed)', async () => {
    vi.mocked(monitorService.getEventBusMonitorStats).mockReturnValue(SAMPLE_EVENTBUS_STATS as never);

    const res = await request.get(`${BASE}/eventbus/stats`).set('Authorization', `Bearer ${VIEWER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request.get(`${BASE}/eventbus/stats`);

    expect(res.status).toBe(401);
    expect(monitorService.getEventBusMonitorStats).not.toHaveBeenCalled();
  });

  it('returns 403 when permission is denied', async () => {
    vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(false);

    const noPermToken = signTestToken({ userId: 'no-perm', systemRole: 'warehouse_staff' });
    const res = await request.get(`${BASE}/eventbus/stats`).set('Authorization', `Bearer ${noPermToken}`);

    expect(res.status).toBe(403);
    expect(monitorService.getEventBusMonitorStats).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by the service', async () => {
    vi.mocked(monitorService.getEventBusMonitorStats).mockImplementation(() => {
      throw new Error('EventBus not initialised');
    });

    const res = await request.get(`${BASE}/eventbus/stats`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/monitor/queues/stats
// ---------------------------------------------------------------------------

describe('GET /monitor/queues/stats', () => {
  it('returns 200 with queue stats for admin', async () => {
    vi.mocked(monitorService.getQueueStats).mockResolvedValue(SAMPLE_QUEUE_STATS as never);

    const res = await request.get(`${BASE}/queues/stats`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(SAMPLE_QUEUE_STATS);
    expect(monitorService.getQueueStats).toHaveBeenCalledOnce();
  });

  it('returns 200 with an empty array when no queues are registered', async () => {
    vi.mocked(monitorService.getQueueStats).mockResolvedValue([]);

    const res = await request.get(`${BASE}/queues/stats`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request.get(`${BASE}/queues/stats`);

    expect(res.status).toBe(401);
    expect(monitorService.getQueueStats).not.toHaveBeenCalled();
  });

  it('returns 403 when permission is denied', async () => {
    vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(false);

    const noPermToken = signTestToken({ userId: 'no-perm', systemRole: 'warehouse_staff' });
    const res = await request.get(`${BASE}/queues/stats`).set('Authorization', `Bearer ${noPermToken}`);

    expect(res.status).toBe(403);
    expect(monitorService.getQueueStats).not.toHaveBeenCalled();
  });

  it('propagates async errors thrown by the service', async () => {
    vi.mocked(monitorService.getQueueStats).mockRejectedValue(new Error('Redis connection lost'));

    const res = await request.get(`${BASE}/queues/stats`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/monitor/queues/dlq
// ---------------------------------------------------------------------------

describe('GET /monitor/queues/dlq', () => {
  it('returns 200 with paginated DLQ jobs using defaults', async () => {
    vi.mocked(monitorService.getDlqJobs).mockResolvedValue(SAMPLE_DLQ_PAGE as never);

    const res = await request.get(`${BASE}/queues/dlq`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 12 });
    // Default: page=1, pageSize=20
    expect(monitorService.getDlqJobs).toHaveBeenCalledWith(1, 20);
  });

  it('forwards custom page and pageSize query params', async () => {
    const customPage = {
      jobs: [SAMPLE_DLQ_PAGE.jobs[0]],
      total: 12,
      page: 2,
      pageSize: 5,
    };
    vi.mocked(monitorService.getDlqJobs).mockResolvedValue(customPage as never);

    const res = await request.get(`${BASE}/queues/dlq?page=2&pageSize=5`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(monitorService.getDlqJobs).toHaveBeenCalledWith(2, 5);
    expect(res.body.meta).toMatchObject({ page: 2, pageSize: 5, total: 12 });
  });

  it('clamps page to minimum of 1 for invalid values', async () => {
    vi.mocked(monitorService.getDlqJobs).mockResolvedValue({ ...SAMPLE_DLQ_PAGE, page: 1 } as never);

    const res = await request.get(`${BASE}/queues/dlq?page=-5`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    // Math.max(1, parseInt('-5')) => 1
    expect(monitorService.getDlqJobs).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it('clamps pageSize to maximum of 100 for oversized values', async () => {
    vi.mocked(monitorService.getDlqJobs).mockResolvedValue({ ...SAMPLE_DLQ_PAGE, pageSize: 100 } as never);

    const res = await request.get(`${BASE}/queues/dlq?pageSize=999`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    // Math.min(100, Math.max(1, parseInt('999'))) => 100
    expect(monitorService.getDlqJobs).toHaveBeenCalledWith(1, 100);
  });

  it('clamps pageSize to minimum of 1 for invalid values', async () => {
    vi.mocked(monitorService.getDlqJobs).mockResolvedValue({ ...SAMPLE_DLQ_PAGE, pageSize: 1 } as never);

    const res = await request.get(`${BASE}/queues/dlq?pageSize=0`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    // Math.min(100, Math.max(1, 0)) => 1
    expect(monitorService.getDlqJobs).toHaveBeenCalledWith(1, 1);
  });

  it('returns 200 with empty jobs array when DLQ is empty', async () => {
    vi.mocked(monitorService.getDlqJobs).mockResolvedValue({
      jobs: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    const res = await request.get(`${BASE}/queues/dlq`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request.get(`${BASE}/queues/dlq`);

    expect(res.status).toBe(401);
    expect(monitorService.getDlqJobs).not.toHaveBeenCalled();
  });

  it('returns 403 when permission is denied', async () => {
    vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(false);

    const noPermToken = signTestToken({ userId: 'no-perm', systemRole: 'warehouse_staff' });
    const res = await request.get(`${BASE}/queues/dlq`).set('Authorization', `Bearer ${noPermToken}`);

    expect(res.status).toBe(403);
    expect(monitorService.getDlqJobs).not.toHaveBeenCalled();
  });

  it('propagates async errors thrown by the service', async () => {
    vi.mocked(monitorService.getDlqJobs).mockRejectedValue(new Error('BullMQ unavailable'));

    const res = await request.get(`${BASE}/queues/dlq`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/monitor/queues/dlq/:jobId/retry
// ---------------------------------------------------------------------------

describe('POST /monitor/queues/dlq/:jobId/retry', () => {
  it('returns 200 with retried=true when job exists', async () => {
    vi.mocked(monitorService.retryDlqJob).mockResolvedValue(true);

    const res = await request.post(`${BASE}/queues/dlq/job-1/retry`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ jobId: 'job-1', retried: true });
    expect(monitorService.retryDlqJob).toHaveBeenCalledWith('job-1');
  });

  it('returns 404 when job does not exist', async () => {
    vi.mocked(monitorService.retryDlqJob).mockResolvedValue(false);

    const res = await request
      .post(`${BASE}/queues/dlq/nonexistent-job/retry`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(monitorService.retryDlqJob).toHaveBeenCalledWith('nonexistent-job');
  });

  it('passes the jobId param to the service exactly', async () => {
    vi.mocked(monitorService.retryDlqJob).mockResolvedValue(true);

    const jobId = 'special:job-id-with-colons_and_underscores';
    await request
      .post(`${BASE}/queues/dlq/${encodeURIComponent(jobId)}/retry`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(monitorService.retryDlqJob).toHaveBeenCalledWith(jobId);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request.post(`${BASE}/queues/dlq/job-1/retry`);

    expect(res.status).toBe(401);
    expect(monitorService.retryDlqJob).not.toHaveBeenCalled();
  });

  it('returns 403 when permission is denied (requires settings update)', async () => {
    vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(false);

    const readOnlyToken = signTestToken({ userId: 'read-only', systemRole: 'viewer' });
    const res = await request.post(`${BASE}/queues/dlq/job-1/retry`).set('Authorization', `Bearer ${readOnlyToken}`);

    expect(res.status).toBe(403);
    expect(monitorService.retryDlqJob).not.toHaveBeenCalled();
  });

  it('propagates async errors thrown by the service', async () => {
    vi.mocked(monitorService.retryDlqJob).mockRejectedValue(new Error('Queue is paused'));

    const res = await request.post(`${BASE}/queues/dlq/job-1/retry`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
