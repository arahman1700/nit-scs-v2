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
        if (prop === 'tool') {
          return {
            findMany: vi.fn().mockResolvedValue([{ id: 'tool1', toolCode: 'T-001', toolName: 'Hammer' }]),
            findUnique: vi.fn().mockResolvedValue({ id: 'tool1', toolCode: 'T-001', toolName: 'Hammer' }),
            count: vi.fn().mockResolvedValue(1),
            create: vi.fn().mockResolvedValue({ id: 'tool1' }),
            update: vi.fn().mockResolvedValue({ id: 'tool1' }),
            delete: vi.fn().mockResolvedValue({ id: 'tool1' }),
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
const BASE = '/api/v1/tools';

describe('Tool Routes (CRUD Factory)', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /tools
  describe('GET /tools', () => {
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

  // GET /tools/:id
  describe('GET /tools/:id', () => {
    it('returns 200 with tool', async () => {
      const res = await request.get(`${BASE}/tool1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /tools
  describe('POST /tools', () => {
    it('returns 201 for admin', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: 'T-002', toolName: 'Wrench' });
      expect(res.status).toBe(201);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ toolCode: 'T-002' });
      expect(res.status).toBe(401);
    });
  });

  // DELETE /tools/:id
  describe('DELETE /tools/:id', () => {
    it('returns 204 for admin', async () => {
      const res = await request.delete(`${BASE}/tool1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });
});
