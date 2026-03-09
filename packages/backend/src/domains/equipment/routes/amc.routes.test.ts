/**
 * Integration tests for AMC (Annual Maintenance Contract) routes.
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
vi.mock('../../system/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/amc.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  terminate: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as amcService from '../services/amc.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const TECH_TOKEN = signTestToken({ userId: 'tech-1', systemRole: 'technical_manager' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/amc', () => {
  it('should return 200 with AMC list', async () => {
    vi.mocked(amcService.list).mockResolvedValue({ data: [{ id: 'amc-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/amc').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/amc').set('Authorization', `Bearer ${STAFF_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/amc');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/amc', () => {
  const validBody = {
    supplierId: '00000000-0000-0000-0000-000000000001',
    equipmentTypeId: '00000000-0000-0000-0000-000000000002',
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    contractValue: 50000,
    coverageType: 'comprehensive',
    responseTimeSlaHours: 4,
    preventiveMaintenanceFrequency: 'monthly',
  };

  it('should return 201 on create', async () => {
    vi.mocked(amcService.create).mockResolvedValue({ id: 'amc-1', ...validBody } as never);

    const res = await request.post('/api/v1/amc').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
  });

  it('should allow technical_manager', async () => {
    vi.mocked(amcService.create).mockResolvedValue({ id: 'amc-2' } as never);

    const res = await request.post('/api/v1/amc').set('Authorization', `Bearer ${TECH_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/amc/:id/activate', () => {
  it('should return 200 on activate', async () => {
    vi.mocked(amcService.activate).mockResolvedValue({ id: 'amc-1', status: 'active' } as never);

    const res = await request.post('/api/v1/amc/amc-1/activate').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/amc/:id/terminate', () => {
  it('should return 200 on terminate', async () => {
    vi.mocked(amcService.terminate).mockResolvedValue({ id: 'amc-1', status: 'terminated' } as never);

    const res = await request
      .post('/api/v1/amc/amc-1/terminate')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Contract expired' });

    expect(res.status).toBe(200);
  });
});
