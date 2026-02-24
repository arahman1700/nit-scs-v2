import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const { mockGeneratorFuelLog } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';

  const mockGeneratorFuelLog = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'fuel1' }),
    update: vi.fn().mockResolvedValue({ id: 'fuel1' }),
    delete: vi.fn().mockResolvedValue({ id: 'fuel1' }),
  };

  return { mockGeneratorFuelLog };
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
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        if (prop === 'generatorFuelLog') return mockGeneratorFuelLog;
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/generator-fuel';

describe('Generator Fuel Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/generator-fuel', () => {
    it('returns 200 with paginated list', async () => {
      mockGeneratorFuelLog.findMany.mockResolvedValue([{ id: 'fuel1', fuelSupplier: 'ACME' }]);
      mockGeneratorFuelLog.count.mockResolvedValue(1);

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/generator-fuel/:id', () => {
    it('returns 200 with single record', async () => {
      mockGeneratorFuelLog.findUnique.mockResolvedValue({ id: 'fuel1', fuelSupplier: 'ACME' });

      const res = await request.get(`${BASE}/fuel1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      mockGeneratorFuelLog.findUnique.mockResolvedValue(null);

      const res = await request.get(`${BASE}/missing`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/generator-fuel/:id', () => {
    it('returns 204 on successful delete', async () => {
      mockGeneratorFuelLog.delete.mockResolvedValue({ id: 'fuel1' });

      const res = await request.delete(`${BASE}/fuel1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('returns 401 without auth', async () => {
      const res = await request.delete(`${BASE}/fuel1`);
      expect(res.status).toBe(401);
    });
  });
});
