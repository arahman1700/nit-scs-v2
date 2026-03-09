/**
 * Integration tests for visitor management routes.
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

vi.mock('../services/visitor.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  register: vi.fn(),
  update: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  cancel: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as visitorService from '../services/visitor.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const GATE_TOKEN = signTestToken({ userId: 'gate-1', systemRole: 'gate_officer' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/visitors', () => {
  it('should return 200 with visitor list', async () => {
    vi.mocked(visitorService.list).mockResolvedValue({
      data: [{ id: 'vp-1', name: 'John' }],
      total: 1,
    } as never);

    const res = await request.get('/api/v1/visitors').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow gate_officer role', async () => {
    vi.mocked(visitorService.list).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request.get('/api/v1/visitors').set('Authorization', `Bearer ${GATE_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/visitors').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/visitors');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/visitors/:id', () => {
  it('should return 200 with visitor detail', async () => {
    vi.mocked(visitorService.getById).mockResolvedValue({ id: 'vp-1', name: 'John' } as never);

    const res = await request.get('/api/v1/visitors/vp-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(visitorService.getById).toHaveBeenCalledWith('vp-1');
  });
});

describe('POST /api/v1/visitors', () => {
  const validBody = {
    visitorName: 'John Doe',
    visitorIdNumber: 'ID123',
    visitDate: '2026-03-10T09:00:00Z',
    warehouseId: '00000000-0000-0000-0000-000000000001',
    hostEmployeeId: '00000000-0000-0000-0000-000000000002',
    purpose: 'Delivery',
    expectedDuration: 60,
  };

  it('should return 201 on success', async () => {
    vi.mocked(visitorService.register).mockResolvedValue({ id: 'vp-1', ...validBody } as never);

    const res = await request.post('/api/v1/visitors').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(visitorService.register).toHaveBeenCalledWith(expect.any(Object), 'test-user-id');
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.post('/api/v1/visitors').set('Authorization', `Bearer ${STAFF_TOKEN}`).send(validBody);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/visitors/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(visitorService.update).mockResolvedValue({ id: 'vp-1' } as never);

    const res = await request
      .put('/api/v1/visitors/vp-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ purpose: 'Meeting' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/visitors/:id/check-in', () => {
  it('should return 200 on check-in', async () => {
    vi.mocked(visitorService.checkIn).mockResolvedValue({ id: 'vp-1', status: 'checked_in' } as never);

    const res = await request
      .post('/api/v1/visitors/vp-1/check-in')
      .set('Authorization', `Bearer ${GATE_TOKEN}`)
      .send({ badgeNumber: 'B-001' });

    expect(res.status).toBe(200);
    expect(visitorService.checkIn).toHaveBeenCalledWith('vp-1', expect.any(Object));
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request
      .post('/api/v1/visitors/vp-1/check-in')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`)
      .send({});

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/visitors/:id/check-out', () => {
  it('should return 200 on check-out', async () => {
    vi.mocked(visitorService.checkOut).mockResolvedValue({ id: 'vp-1', status: 'checked_out' } as never);

    const res = await request.post('/api/v1/visitors/vp-1/check-out').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(visitorService.checkOut).toHaveBeenCalledWith('vp-1');
  });
});

describe('POST /api/v1/visitors/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(visitorService.cancel).mockResolvedValue({ id: 'vp-1', status: 'cancelled' } as never);

    const res = await request.post('/api/v1/visitors/vp-1/cancel').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(visitorService.cancel).toHaveBeenCalledWith('vp-1');
  });
});
