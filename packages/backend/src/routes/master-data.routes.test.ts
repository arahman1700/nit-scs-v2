/**
 * Integration tests for master-data.routes.ts
 *
 * Tests representative CRUD endpoints for the master data router:
 * /regions, /items (two of 17 entities mounted).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const { mockRegion, mockItem, genericDelegate } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';

  const mockRegion = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'reg1', regionName: 'Eastern' }),
    update: vi.fn().mockResolvedValue({ id: 'reg1', regionName: 'Updated' }),
    delete: vi.fn().mockResolvedValue({ id: 'reg1' }),
  };

  const mockItem = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'item1', itemCode: 'IT-001' }),
    update: vi.fn().mockResolvedValue({ id: 'item1', itemCode: 'IT-001' }),
    delete: vi.fn().mockResolvedValue({ id: 'item1' }),
  };

  const genericDelegate = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    update: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    delete: vi.fn().mockResolvedValue({ id: 'gen-id' }),
  });

  return { mockRegion, mockItem, genericDelegate };
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
        if (prop === 'region') return mockRegion;
        if (prop === 'item') return mockItem;
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return genericDelegate();
      },
    },
  ),
}));

const app = createTestApp();
const request = supertest(app);

describe('Master Data Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── Regions ────────────────────────────────────────────────────────
  describe('GET /api/v1/regions', () => {
    it('returns 200 with list', async () => {
      mockRegion.findMany.mockResolvedValue([{ id: 'reg1', regionName: 'Eastern' }]);
      mockRegion.count.mockResolvedValue(1);

      const res = await request.get('/api/v1/regions').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/regions');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/regions/:id', () => {
    it('returns 200 with a single region', async () => {
      mockRegion.findUnique.mockResolvedValue({ id: 'reg1', regionName: 'Eastern' });

      const res = await request.get('/api/v1/regions/reg1').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      mockRegion.findUnique.mockResolvedValue(null);

      const res = await request.get('/api/v1/regions/missing').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/regions/:id', () => {
    it('returns 204 on successful delete', async () => {
      mockRegion.delete.mockResolvedValue({ id: 'reg1' });

      const res = await request.delete('/api/v1/regions/reg1').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('returns 401 without auth', async () => {
      const res = await request.delete('/api/v1/regions/reg1');
      expect(res.status).toBe(401);
    });
  });

  // ── Items ──────────────────────────────────────────────────────────
  describe('GET /api/v1/items', () => {
    it('returns 200 with list', async () => {
      mockItem.findMany.mockResolvedValue([{ id: 'item1', itemCode: 'IT-001' }]);
      mockItem.count.mockResolvedValue(1);

      const res = await request.get('/api/v1/items').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/items/:id', () => {
    it('returns 404 when not found', async () => {
      mockItem.findUnique.mockResolvedValue(null);

      const res = await request.get('/api/v1/items/missing').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
