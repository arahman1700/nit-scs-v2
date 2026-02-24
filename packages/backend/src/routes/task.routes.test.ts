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
vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

const fakeTask = {
  id: 't1',
  title: 'Test task',
  status: 'open',
  creatorId: 'test-user-id',
  assigneeId: null,
};

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 't1', title: 'Test task', status: 'open', creatorId: 'test-user-id' }),
      update: vi.fn().mockResolvedValue({ id: 't1', title: 'Updated', status: 'open', creatorId: 'test-user-id' }),
      delete: vi.fn().mockResolvedValue({ id: 't1' }),
    },
    taskComment: {
      create: vi.fn().mockResolvedValue({ id: 'tc1', body: 'comment', authorId: 'test-user-id' }),
    },
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/tasks';

describe('Task Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    // Reset default mock for findUnique
    vi.mocked(prisma.task.findUnique).mockResolvedValue(fakeTask as any);
  });

  // GET /tasks
  describe('GET /tasks', () => {
    it('returns 200 with list', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.count).mockResolvedValue(0);

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /tasks/:id
  describe('GET /tasks/:id', () => {
    it('returns 200 when found', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(fakeTask as any);
      const res = await request.get(`${BASE}/t1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
      const res = await request.get(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // POST /tasks
  describe('POST /tasks', () => {
    it('returns 201 on success', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: { title: 'New task' } });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ body: { title: 'Test' } });
      expect(res.status).toBe(401);
    });
  });

  // PUT /tasks/:id
  describe('PUT /tasks/:id', () => {
    it('returns 200 for creator', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(fakeTask as any);
      const res = await request
        .put(`${BASE}/t1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: { title: 'Updated' } });
      expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
      const res = await request
        .put(`${BASE}/t1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: { title: 'Updated' } });
      expect(res.status).toBe(404);
    });

    it('returns 403 for non-owner non-admin', async () => {
      const userToken = signTestToken({ userId: 'other-user', systemRole: 'viewer' });
      vi.mocked(prisma.task.findUnique).mockResolvedValue(fakeTask as any);
      const res = await request
        .put(`${BASE}/t1`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ body: { title: 'Hijacked' } });
      expect(res.status).toBe(403);
    });
  });

  // DELETE /tasks/:id
  describe('DELETE /tasks/:id', () => {
    it('returns 204 for admin', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(fakeTask as any);
      const res = await request.delete(`${BASE}/t1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
      const res = await request.delete(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 for non-creator non-admin', async () => {
      const userToken = signTestToken({ userId: 'other-user', systemRole: 'viewer' });
      vi.mocked(prisma.task.findUnique).mockResolvedValue(fakeTask as any);
      const res = await request.delete(`${BASE}/t1`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });
});
