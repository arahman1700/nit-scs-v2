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
        if (prop === 'warehouseZone') {
          return {
            findMany: vi.fn().mockResolvedValue([{ id: 'wz1', zoneName: 'Zone A' }]),
            findUnique: vi.fn().mockResolvedValue({ id: 'wz1', zoneName: 'Zone A' }),
            count: vi.fn().mockResolvedValue(1),
            create: vi.fn().mockResolvedValue({ id: 'wz1' }),
            update: vi.fn().mockResolvedValue({ id: 'wz1' }),
            delete: vi.fn().mockResolvedValue({ id: 'wz1' }),
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
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/warehouse-zones';

describe('Warehouse Zone Routes (CRUD Factory)', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /warehouse-zones
  describe('GET /warehouse-zones', () => {
    it('returns 200 with list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /warehouse-zones/:id
  describe('GET /warehouse-zones/:id', () => {
    it('returns 200 with zone', async () => {
      const res = await request.get(`${BASE}/wz1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /warehouse-zones
  describe('POST /warehouse-zones', () => {
    it('returns 201 for admin', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          zoneName: 'Zone B',
          zoneCode: 'ZB',
          warehouseId: '00000000-0000-0000-0000-000000000001',
          zoneType: 'civil',
        });
      expect(res.status).toBe(201);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ zoneName: 'Zone B' });
      expect(res.status).toBe(401);
    });
  });

  // DELETE /warehouse-zones/:id
  describe('DELETE /warehouse-zones/:id', () => {
    it('returns 204 for admin', async () => {
      const res = await request.delete(`${BASE}/wz1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });
});
