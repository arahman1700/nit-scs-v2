/**
 * Integration tests for supplier evaluation routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../../../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
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
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/supplier-evaluation.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  complete: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as supplierEvalService from '../services/supplier-evaluation.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const LOGISTICS_TOKEN = signTestToken({ userId: 'log-1', systemRole: 'logistics_coordinator' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/supplier-evaluations', () => {
  it('should return 200 with evaluation list', async () => {
    vi.mocked(supplierEvalService.list).mockResolvedValue({
      data: [{ id: 'eval-1' }],
      total: 1,
    } as never);

    const res = await request.get('/api/v1/supplier-evaluations').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/supplier-evaluations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/supplier-evaluations/:id', () => {
  it('should return 200 with evaluation detail', async () => {
    vi.mocked(supplierEvalService.getById).mockResolvedValue({
      id: 'eval-1',
      supplier: { name: 'ACME' },
      metrics: [],
    } as never);

    const res = await request.get('/api/v1/supplier-evaluations/eval-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/supplier-evaluations', () => {
  const validBody = {
    supplierId: '00000000-0000-0000-0000-000000000001',
    periodStart: '2026-01-01T00:00:00Z',
    periodEnd: '2026-03-31T00:00:00Z',
    notes: 'Q1 evaluation',
  };

  it('should return 201 on success', async () => {
    vi.mocked(supplierEvalService.create).mockResolvedValue({ id: 'eval-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/supplier-evaluations')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should allow logistics_coordinator', async () => {
    vi.mocked(supplierEvalService.create).mockResolvedValue({ id: 'eval-2' } as never);

    const res = await request
      .post('/api/v1/supplier-evaluations')
      .set('Authorization', `Bearer ${LOGISTICS_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should pass permission check for all roles (hasPermissionDB mocked true)', async () => {
    // Document factory uses requirePermission → hasPermissionDB which is mocked to true
    vi.mocked(supplierEvalService.create).mockResolvedValue({ id: 'eval-3' } as never);

    const res = await request
      .post('/api/v1/supplier-evaluations')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('PUT /api/v1/supplier-evaluations/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(supplierEvalService.update).mockResolvedValue({ id: 'eval-1' } as never);

    const res = await request
      .put('/api/v1/supplier-evaluations/eval-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ notes: 'Updated notes' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/supplier-evaluations/:id/complete', () => {
  it('should return 200 on complete', async () => {
    vi.mocked(supplierEvalService.complete).mockResolvedValue({
      id: 'eval-1',
      status: 'completed',
    } as never);

    const res = await request
      .post('/api/v1/supplier-evaluations/eval-1/complete')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for non-complete role', async () => {
    const res = await request
      .post('/api/v1/supplier-evaluations/eval-1/complete')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});
