/**
 * Integration tests for transport order routes.
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

vi.mock('../services/transport-order.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  schedule: vi.fn(),
  dispatch: vi.fn(),
  deliver: vi.fn(),
  cancel: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as transportOrderService from '../services/transport-order.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const TRANSPORT_TOKEN = signTestToken({ userId: 'ts-1', systemRole: 'transport_supervisor' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/transport-orders', () => {
  it('should return 200 with list', async () => {
    vi.mocked(transportOrderService.list).mockResolvedValue({
      data: [{ id: 'to-1' }],
      total: 1,
    } as never);

    const res = await request.get('/api/v1/transport-orders').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/transport-orders');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/transport-orders', () => {
  const validBody = {
    originWarehouseId: '00000000-0000-0000-0000-000000000001',
    destinationAddress: 'Site B',
    loadDescription: 'Steel beams',
    scheduledDate: '2026-04-01T08:00:00Z',
    items: [{ description: 'Steel I-beam 6m', quantity: 10 }],
  };

  it('should return 201 on create', async () => {
    vi.mocked(transportOrderService.create).mockResolvedValue({ id: 'to-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/transport-orders')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should allow transport_supervisor', async () => {
    vi.mocked(transportOrderService.create).mockResolvedValue({ id: 'to-2' } as never);

    const res = await request
      .post('/api/v1/transport-orders')
      .set('Authorization', `Bearer ${TRANSPORT_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should pass permission check for all roles (hasPermissionDB mocked true)', async () => {
    // Document factory uses requirePermission → hasPermissionDB which is mocked to true
    vi.mocked(transportOrderService.create).mockResolvedValue({ id: 'to-3' } as never);

    const res = await request
      .post('/api/v1/transport-orders')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/transport-orders/:id/schedule', () => {
  it('should return 200 on schedule', async () => {
    vi.mocked(transportOrderService.schedule).mockResolvedValue({ id: 'to-1', status: 'scheduled' } as never);

    const res = await request
      .post('/api/v1/transport-orders/to-1/schedule')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/transport-orders/:id/dispatch', () => {
  it('should return 200 on dispatch', async () => {
    vi.mocked(transportOrderService.dispatch).mockResolvedValue({ id: 'to-1', status: 'dispatched' } as never);

    const res = await request
      .post('/api/v1/transport-orders/to-1/dispatch')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/transport-orders/:id/deliver', () => {
  it('should return 200 on deliver', async () => {
    vi.mocked(transportOrderService.deliver).mockResolvedValue({ id: 'to-1', status: 'delivered' } as never);

    const res = await request
      .post('/api/v1/transport-orders/to-1/deliver')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/transport-orders/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(transportOrderService.cancel).mockResolvedValue({ id: 'to-1', status: 'cancelled' } as never);

    const res = await request
      .post('/api/v1/transport-orders/to-1/cancel')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});
