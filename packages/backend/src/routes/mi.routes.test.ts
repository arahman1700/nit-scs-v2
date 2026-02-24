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

vi.mock('../services/mirv.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'mi1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'mi1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'mi1' } }),
  submit: vi.fn().mockResolvedValue({ approverRole: 'manager', slaHours: 24 }),
  approve: vi.fn().mockResolvedValue({ action: 'approve', status: 'approved', warehouseId: 'wh1' }),
  signQc: vi.fn().mockResolvedValue({ id: 'mi1', status: 'approved' }),
  issue: vi.fn().mockResolvedValue({ id: 'mi1', status: 'issued', warehouseId: 'wh1', totalCost: 5000 }),
  cancel: vi.fn().mockResolvedValue({ updated: { id: 'mi1' }, wasReserved: false }),
}));

import * as mirvService from '../services/mirv.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/mi';

describe('MI Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/mi', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mirvService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/mi/:id', () => {
    it('returns 200 with a single MI', async () => {
      const res = await request.get(`${BASE}/mi1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mirvService.getById).toHaveBeenCalledWith('mi1');
    });
  });

  describe('POST /api/v1/mi/:id/submit', () => {
    it('returns 200 on successful submit', async () => {
      const res = await request.post(`${BASE}/mi1/submit`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/mi1/submit`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/mi/:id/issue', () => {
    it('returns 200 on successful issue', async () => {
      const res = await request.post(`${BASE}/mi1/issue`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mi/:id/cancel', () => {
    it('returns 200 on successful cancel', async () => {
      const res = await request.post(`${BASE}/mi1/cancel`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
