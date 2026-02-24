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

vi.mock('../services/grn.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'grn1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'grn1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'grn1' } }),
  submit: vi.fn().mockResolvedValue({ id: 'grn1', qciRequired: false }),
  approveQc: vi.fn().mockResolvedValue({ id: 'grn1', status: 'qc_approved' }),
  receive: vi.fn().mockResolvedValue({ id: 'grn1', status: 'received' }),
  store: vi.fn().mockResolvedValue({ id: 'grn1', status: 'stored', warehouseId: 'wh1' }),
}));

import * as grnService from '../services/grn.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/grn';

describe('GRN Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/grn', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(grnService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/grn/:id', () => {
    it('returns 200 with a single GRN', async () => {
      const res = await request.get(`${BASE}/grn1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(grnService.getById).toHaveBeenCalledWith('grn1');
    });
  });

  describe('POST /api/v1/grn/:id/submit', () => {
    it('returns 200 on successful submit', async () => {
      const res = await request.post(`${BASE}/grn1/submit`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(grnService.submit).toHaveBeenCalledWith('grn1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/grn1/submit`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/grn/:id/store', () => {
    it('returns 200 on successful store', async () => {
      const res = await request.post(`${BASE}/grn1/store`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
