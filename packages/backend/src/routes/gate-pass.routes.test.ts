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

vi.mock('../services/gate-pass.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'gp1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'gp1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'gp1' } }),
  submit: vi.fn().mockResolvedValue({ id: 'gp1', status: 'pending' }),
  approve: vi.fn().mockResolvedValue({ id: 'gp1', status: 'approved' }),
  release: vi.fn().mockResolvedValue({ id: 'gp1', status: 'released' }),
  returnPass: vi.fn().mockResolvedValue({ id: 'gp1', status: 'returned' }),
  cancel: vi.fn().mockResolvedValue({ id: 'gp1', status: 'cancelled' }),
}));

import * as gatePassService from '../services/gate-pass.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/gate-passes';

describe('Gate Pass Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/gate-passes', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(gatePassService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/gate-passes/:id', () => {
    it('returns 200 with a single gate pass', async () => {
      const res = await request.get(`${BASE}/gp1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(gatePassService.getById).toHaveBeenCalledWith('gp1');
    });
  });

  describe('POST /api/v1/gate-passes/:id/submit', () => {
    it('returns 200 on successful submit', async () => {
      const res = await request.post(`${BASE}/gp1/submit`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(gatePassService.submit).toHaveBeenCalledWith('gp1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/gp1/submit`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/gate-passes/:id/approve', () => {
    it('returns 200 on successful approve', async () => {
      const res = await request.post(`${BASE}/gp1/approve`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
