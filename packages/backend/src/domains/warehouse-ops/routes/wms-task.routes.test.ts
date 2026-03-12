/**
 * Integration tests for WMS task routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

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
vi.mock('../../../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../../../utils/scope-filter.js', () => ({
  buildScopeFilter: vi.fn().mockReturnValue({}),
  canAccessRecord: vi.fn().mockReturnValue(true),
  resolveWarehouseScope: vi.fn().mockReturnValue(undefined),
  applyScopeFilter: vi.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../audit/services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/wms-task.service.js', () => ({
  createTask: vi.fn(),
  getTaskById: vi.fn(),
  getTasks: vi.fn(),
  assignTask: vi.fn(),
  startTask: vi.fn(),
  completeTask: vi.fn(),
  cancelTask: vi.fn(),
  holdTask: vi.fn(),
  resumeTask: vi.fn(),
  getMyTasks: vi.fn(),
  getStats: vi.fn(),
  bulkAssign: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as wmsTaskService from '../services/wms-task.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/v1/wms-tasks ──────────────────────────────────────────────────
describe('GET /api/v1/wms-tasks', () => {
  it('should return 200 with list', async () => {
    vi.mocked(wmsTaskService.getTasks).mockResolvedValue({
      data: [{ id: 'task-1' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/wms-tasks').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/wms-tasks');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/wms-tasks/stats ────────────────────────────────────────────
describe('GET /api/v1/wms-tasks/stats', () => {
  it('should return 200 with stats', async () => {
    vi.mocked(wmsTaskService.getStats).mockResolvedValue({
      pending: 3,
      assigned: 2,
      inProgress: 1,
      completed: 10,
      cancelled: 0,
      onHold: 0,
      avgCompletionMins: 12.5,
    } as never);

    const res = await request.get('/api/v1/wms-tasks/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/wms-tasks/stats');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/wms-tasks/my-tasks ─────────────────────────────────────────
describe('GET /api/v1/wms-tasks/my-tasks', () => {
  it('should return 200 with my tasks', async () => {
    vi.mocked(wmsTaskService.getMyTasks).mockResolvedValue([{ id: 'task-1' }] as never);

    const res = await request.get('/api/v1/wms-tasks/my-tasks').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/wms-tasks/my-tasks');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/wms-tasks/:id ──────────────────────────────────────────────
describe('GET /api/v1/wms-tasks/:id', () => {
  it('should return 200 with detail', async () => {
    vi.mocked(wmsTaskService.getTaskById).mockResolvedValue({ id: 'task-1', status: 'pending' } as never);

    const res = await request.get('/api/v1/wms-tasks/task-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/wms-tasks/task-1');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/wms-tasks ─────────────────────────────────────────────────
describe('POST /api/v1/wms-tasks', () => {
  const validBody = {
    taskNumber: 'TSK-001',
    warehouseId: '00000000-0000-0000-0000-000000000001',
    taskType: 'putaway',
  };

  it('should return 201 for admin', async () => {
    vi.mocked(wmsTaskService.createTask).mockResolvedValue({ id: 'task-1' } as never);

    const res = await request.post('/api/v1/wms-tasks').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with invalid body', async () => {
    const res = await request
      .post('/api/v1/wms-tasks')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ taskType: 'invalid_type' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/wms-tasks').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/wms-tasks/:id/assign ─────────────────────────────────────
describe('PATCH /api/v1/wms-tasks/:id/assign', () => {
  it('should return 200 on assign', async () => {
    vi.mocked(wmsTaskService.assignTask).mockResolvedValue({ id: 'task-1', status: 'assigned' } as never);

    const res = await request
      .patch('/api/v1/wms-tasks/task-1/assign')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ employeeId: '00000000-0000-0000-0000-000000000010' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 without employeeId', async () => {
    const res = await request
      .patch('/api/v1/wms-tasks/task-1/assign')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request
      .patch('/api/v1/wms-tasks/task-1/assign')
      .send({ employeeId: '00000000-0000-0000-0000-000000000010' });
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/wms-tasks/:id/start ──────────────────────────────────────
describe('PATCH /api/v1/wms-tasks/:id/start', () => {
  it('should return 200 on start', async () => {
    vi.mocked(wmsTaskService.startTask).mockResolvedValue({ id: 'task-1', status: 'in_progress' } as never);

    const res = await request.patch('/api/v1/wms-tasks/task-1/start').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/wms-tasks/task-1/start');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/wms-tasks/:id/complete ───────────────────────────────────
describe('PATCH /api/v1/wms-tasks/:id/complete', () => {
  it('should return 200 on complete', async () => {
    vi.mocked(wmsTaskService.completeTask).mockResolvedValue({ id: 'task-1', status: 'completed' } as never);

    const res = await request.patch('/api/v1/wms-tasks/task-1/complete').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/wms-tasks/task-1/complete');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/wms-tasks/:id/cancel ─────────────────────────────────────
describe('PATCH /api/v1/wms-tasks/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(wmsTaskService.cancelTask).mockResolvedValue({ id: 'task-1', status: 'cancelled' } as never);

    const res = await request.patch('/api/v1/wms-tasks/task-1/cancel').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/wms-tasks/task-1/cancel');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/wms-tasks/bulk-assign ─────────────────────────────────────
describe('POST /api/v1/wms-tasks/bulk-assign', () => {
  const validBody = {
    taskIds: ['00000000-0000-0000-0000-000000000001'],
    employeeId: '00000000-0000-0000-0000-000000000010',
  };

  it('should return 200 on bulk assign', async () => {
    vi.mocked(wmsTaskService.bulkAssign).mockResolvedValue([{ id: 'task-1', status: 'assigned' }] as never);

    const res = await request
      .post('/api/v1/wms-tasks/bulk-assign')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with empty taskIds', async () => {
    const res = await request
      .post('/api/v1/wms-tasks/bulk-assign')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ taskIds: [], employeeId: '00000000-0000-0000-0000-000000000010' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/wms-tasks/bulk-assign').send(validBody);
    expect(res.status).toBe(401);
  });
});
