/**
 * Integration tests for vehicle maintenance routes.
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

vi.mock('../services/vehicle-maintenance.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as vmService from '../services/vehicle-maintenance.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const TRANSPORT_TOKEN = signTestToken({ userId: 'ts-1', systemRole: 'transport_supervisor' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/vehicle-maintenance', () => {
  it('should return 200 with list', async () => {
    vi.mocked(vmService.list).mockResolvedValue({ data: [{ id: 'vm-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/vehicle-maintenance').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/vehicle-maintenance');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/vehicle-maintenance', () => {
  const validBody = {
    vehicleId: '00000000-0000-0000-0000-000000000001',
    maintenanceType: 'preventive',
    scheduledDate: '2026-04-01T00:00:00Z',
    description: 'Routine oil change and filter replacement',
  };

  it('should return 201 on create', async () => {
    vi.mocked(vmService.create).mockResolvedValue({ id: 'vm-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/vehicle-maintenance')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should allow transport_supervisor', async () => {
    vi.mocked(vmService.create).mockResolvedValue({ id: 'vm-2' } as never);

    const res = await request
      .post('/api/v1/vehicle-maintenance')
      .set('Authorization', `Bearer ${TRANSPORT_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should pass permission check for all roles (hasPermissionDB mocked true)', async () => {
    // Document factory uses requirePermission → hasPermissionDB which is mocked to true
    vi.mocked(vmService.create).mockResolvedValue({ id: 'vm-3' } as never);

    const res = await request
      .post('/api/v1/vehicle-maintenance')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/vehicle-maintenance/:id/complete', () => {
  it('should return 200 on complete', async () => {
    vi.mocked(vmService.complete).mockResolvedValue({ id: 'vm-1', status: 'completed' } as never);

    const res = await request
      .post('/api/v1/vehicle-maintenance/vm-1/complete')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ workPerformed: 'Oil changed, filters replaced' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/vehicle-maintenance/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(vmService.cancel).mockResolvedValue({ id: 'vm-1', status: 'cancelled' } as never);

    const res = await request
      .post('/api/v1/vehicle-maintenance/vm-1/cancel')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});
