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
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    userView: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockResolvedValue({
          id: 'uv1',
          name: 'My View',
          entityType: 'grn',
          viewType: 'grid',
          config: {},
          isDefault: false,
        }),
      update: vi.fn().mockResolvedValue({ id: 'uv1', name: 'Updated' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({ id: 'uv1' }),
    },
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/views';

describe('User View Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /views/:entityType
  describe('GET /views/:entityType', () => {
    it('returns 200 with views', async () => {
      vi.mocked(prisma.userView.findMany).mockResolvedValue([]);
      const res = await request.get(`${BASE}/grn`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/grn`);
      expect(res.status).toBe(401);
    });
  });

  // POST /views
  describe('POST /views', () => {
    it('returns 201 on success', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ entityType: 'grn', config: { columns: ['id', 'status'] } });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ entityType: 'grn', config: {} });
      expect(res.status).toBe(401);
    });
  });

  // PATCH /views/:id
  describe('PATCH /views/:id', () => {
    it('returns 200 when view found', async () => {
      vi.mocked(prisma.userView.findFirst).mockResolvedValue({
        id: 'uv1',
        userId: 'test-user-id',
        entityType: 'grn',
      } as any);
      const res = await request
        .patch(`${BASE}/uv1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated View' });
      expect(res.status).toBe(200);
    });

    it('returns 404 when view not found', async () => {
      vi.mocked(prisma.userView.findFirst).mockResolvedValue(null);
      const res = await request
        .patch(`${BASE}/nonexistent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  // DELETE /views/:id
  describe('DELETE /views/:id', () => {
    it('returns 200 when deleted', async () => {
      vi.mocked(prisma.userView.findFirst).mockResolvedValue({ id: 'uv1', userId: 'test-user-id' } as any);
      const res = await request.delete(`${BASE}/uv1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when view not found', async () => {
      vi.mocked(prisma.userView.findFirst).mockResolvedValue(null);
      const res = await request.delete(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
