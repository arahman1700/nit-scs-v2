/**
 * Integration tests for logistics.routes.ts
 *
 * logistics.routes.ts is a composite router mounting:
 *   /job-orders, /gate-passes, /stock-transfers, /mrf, /shipments
 * We test that these sub-routes are reachable and auth-guarded.
 */
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

// Mock all services used by logistics sub-routes
vi.mock('../services/job-order.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'jo1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'jo1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  submit: vi.fn().mockResolvedValue({}),
  approve: vi.fn().mockResolvedValue({}),
  reject: vi.fn().mockResolvedValue({}),
  assign: vi.fn().mockResolvedValue({}),
  start: vi.fn().mockResolvedValue({}),
  hold: vi.fn().mockResolvedValue({}),
  resume: vi.fn().mockResolvedValue({}),
  complete: vi.fn().mockResolvedValue({}),
  invoice: vi.fn().mockResolvedValue({}),
  cancel: vi.fn().mockResolvedValue({}),
  addPayment: vi.fn().mockResolvedValue({ id: 'p1', invoiceNumber: 'INV' }),
  updatePayment: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
}));
vi.mock('../services/gate-pass.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'gp1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'gp1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  submit: vi.fn().mockResolvedValue({}),
  approve: vi.fn().mockResolvedValue({}),
  release: vi.fn().mockResolvedValue({}),
  returnPass: vi.fn().mockResolvedValue({}),
  cancel: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/stock-transfer.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'st1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'st1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  ship: vi.fn().mockResolvedValue({}),
  receive: vi.fn().mockResolvedValue({}),
  cancel: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/mrf.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'mrf1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'mrf1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  submit: vi.fn().mockResolvedValue({}),
  review: vi.fn().mockResolvedValue({}),
  approve: vi.fn().mockResolvedValue({}),
  reject: vi.fn().mockResolvedValue({}),
  cancel: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/shipment.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'sh1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'sh1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  markInTransit: vi.fn().mockResolvedValue({}),
  markArrived: vi.fn().mockResolvedValue({}),
  cancel: vi.fn().mockResolvedValue({}),
}));

const app = createTestApp();
const request = supertest(app);

describe('Logistics Routes (composite)', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/job-orders', () => {
    it('returns 200 with list', async () => {
      const res = await request.get('/api/v1/job-orders').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/job-orders');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/gate-passes', () => {
    it('returns 200 with list', async () => {
      const res = await request.get('/api/v1/gate-passes').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/gate-passes');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/stock-transfers', () => {
    it('returns 200 with list', async () => {
      const res = await request.get('/api/v1/stock-transfers').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/shipments', () => {
    it('returns 200 with list', async () => {
      const res = await request.get('/api/v1/shipments').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
