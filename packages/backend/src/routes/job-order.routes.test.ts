import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/job-order.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'jo1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'jo1', joNumber: 'JO-001' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'jo1' } }),
  submit: vi.fn().mockResolvedValue({ approverRole: 'manager', slaHours: 48 }),
  approve: vi.fn().mockResolvedValue({ status: 'approved' }),
  reject: vi.fn().mockResolvedValue({ status: 'rejected' }),
  assign: vi.fn().mockResolvedValue({ id: 'jo1', status: 'assigned' }),
  start: vi.fn().mockResolvedValue({ id: 'jo1', status: 'in_progress' }),
  hold: vi.fn().mockResolvedValue({ id: 'jo1', status: 'on_hold' }),
  resume: vi.fn().mockResolvedValue({ id: 'jo1', status: 'in_progress' }),
  complete: vi.fn().mockResolvedValue({ id: 'jo1', status: 'completed', slaMet: true }),
  invoice: vi.fn().mockResolvedValue({ id: 'jo1', status: 'invoiced' }),
  cancel: vi.fn().mockResolvedValue({ id: 'jo1', status: 'cancelled' }),
  addPayment: vi.fn().mockResolvedValue({ id: 'pay1', invoiceNumber: 'INV-001' }),
  updatePayment: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'pay1' } }),
}));

import * as joService from '../services/job-order.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/job-orders';

describe('Job Order Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/job-orders', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(joService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/job-orders/:id', () => {
    it('returns 200 with a single job order', async () => {
      const res = await request.get(`${BASE}/jo1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(joService.getById).toHaveBeenCalledWith('jo1');
    });
  });

  describe('POST /api/v1/job-orders/:id/submit', () => {
    it('returns 200 on successful submit', async () => {
      const res = await request.post(`${BASE}/jo1/submit`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/jo1/submit`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/job-orders/:id/approve', () => {
    it('returns 200 on successful approve', async () => {
      const res = await request
        .post(`${BASE}/jo1/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true, comments: 'Looks good' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/job-orders/:id/cancel', () => {
    it('returns 200 on successful cancel', async () => {
      const res = await request.post(`${BASE}/jo1/cancel`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
