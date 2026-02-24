import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
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
        if (prop === 'systemSetting') {
          return {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'ss1' }),
            update: vi.fn().mockResolvedValue({ id: 'ss1' }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          };
        }
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockImplementation(async (role: string) => {
    return role === 'admin' || role === 'manager';
  }),
}));

vi.mock('../services/system-config.service.js', () => ({
  getAllSlaHours: vi.fn().mockResolvedValue({ grn: 24, mi: 48 }),
  upsertSettings: vi.fn().mockResolvedValue(undefined),
  invalidateConfigCache: vi.fn(),
  getDocPrefix: vi.fn().mockResolvedValue('GRN'),
  getThreshold: vi.fn().mockResolvedValue(10),
}));

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/settings';

describe('Settings Routes', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    viewerToken = signTestToken({ userId: 'viewer-id', systemRole: 'viewer' });
  });

  // GET /settings
  describe('GET /settings', () => {
    it('returns 200 with settings', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // PUT /settings
  describe('PUT /settings', () => {
    it('returns 200 for admin', async () => {
      const res = await request.put(BASE).set('Authorization', `Bearer ${adminToken}`).send({ vatRate: '18' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request.put(BASE).set('Authorization', `Bearer ${viewerToken}`).send({ vatRate: '18' });
      expect(res.status).toBe(403);
    });
  });

  // PUT /settings/user
  describe('PUT /settings/user', () => {
    it('returns 200 for any authenticated user', async () => {
      const res = await request
        .put(`${BASE}/user`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ timezone: 'UTC' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // GET /settings/sla
  describe('GET /settings/sla', () => {
    it('returns 200 for admin', async () => {
      const res = await request.get(`${BASE}/sla`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request.get(`${BASE}/sla`).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // PUT /settings/sla
  describe('PUT /settings/sla', () => {
    it('returns 200 for admin', async () => {
      const res = await request.put(`${BASE}/sla`).set('Authorization', `Bearer ${adminToken}`).send({ grn: 24 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // GET /settings/doc-prefixes
  describe('GET /settings/doc-prefixes', () => {
    it('returns 200 for admin', async () => {
      const res = await request.get(`${BASE}/doc-prefixes`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // PUT /settings/doc-prefixes
  describe('PUT /settings/doc-prefixes', () => {
    it('returns 200 for admin', async () => {
      const res = await request
        .put(`${BASE}/doc-prefixes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ grn: 'GRN' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // GET /settings/thresholds
  describe('GET /settings/thresholds', () => {
    it('returns 200 for admin', async () => {
      const res = await request.get(`${BASE}/thresholds`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // PUT /settings/thresholds
  describe('PUT /settings/thresholds', () => {
    it('returns 200 for admin', async () => {
      const res = await request
        .put(`${BASE}/thresholds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ insurance_threshold_sar: 5000 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
