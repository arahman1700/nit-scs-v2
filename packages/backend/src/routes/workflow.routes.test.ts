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

vi.mock('../events/rule-cache.js', () => ({
  invalidateRuleCache: vi.fn(),
  getActiveRules: vi.fn().mockResolvedValue([]),
}));

const fakeWorkflow = {
  id: 'wf1',
  name: 'GRN Workflow',
  entityType: 'grn',
  isActive: true,
  priority: 10,
};

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    workflow: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockResolvedValue({ id: 'wf1', name: 'GRN Workflow', entityType: 'grn', isActive: true, priority: 10 }),
      update: vi.fn().mockResolvedValue({ id: 'wf1', name: 'Updated', isActive: true }),
      delete: vi.fn().mockResolvedValue({ id: 'wf1' }),
    },
    workflowRule: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'wr1' }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: 'wr1' }),
      delete: vi.fn().mockResolvedValue({ id: 'wr1' }),
    },
    workflowExecutionLog: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/workflows';

describe('Workflow Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(fakeWorkflow as any);
  });

  // GET /workflows
  describe('GET /workflows', () => {
    it('returns 200 with list', async () => {
      vi.mocked(prisma.workflow.findMany).mockResolvedValue([]);
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /workflows/:id
  describe('GET /workflows/:id', () => {
    it('returns 200 when found', async () => {
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue(fakeWorkflow as any);
      const res = await request.get(`${BASE}/wf1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue(null);
      const res = await request.get(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // POST /workflows
  describe('POST /workflows', () => {
    it('returns 201 on success', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Workflow', entityType: 'grn', isActive: true, priority: 10 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ name: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  // PUT /workflows/:id
  describe('PUT /workflows/:id', () => {
    it('returns 200 on update', async () => {
      const res = await request
        .put(`${BASE}/wf1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Workflow' });
      expect(res.status).toBe(200);
    });
  });

  // DELETE /workflows/:id
  describe('DELETE /workflows/:id', () => {
    it('returns 204 on delete', async () => {
      const res = await request.delete(`${BASE}/wf1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });

  // PUT /workflows/:id/activate
  describe('PUT /workflows/:id/activate', () => {
    it('returns 200 for admin', async () => {
      const res = await request.put(`${BASE}/wf1/activate`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 403 for non-admin', async () => {
      const userToken = signTestToken({ userId: 'user-1', systemRole: 'viewer' });
      const res = await request.put(`${BASE}/wf1/activate`).set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  // PUT /workflows/:id/deactivate
  describe('PUT /workflows/:id/deactivate', () => {
    it('returns 200 for admin', async () => {
      const res = await request.put(`${BASE}/wf1/deactivate`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
