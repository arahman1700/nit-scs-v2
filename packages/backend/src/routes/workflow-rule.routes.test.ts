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

vi.mock('../events/event-bus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

const fakeWorkflow = { id: 'wf1', name: 'Test', entityType: 'grn', isActive: true };
const fakeRule = { id: 'wr1', workflowId: 'wf1', name: 'Auto-approve', triggerEvent: 'grn:created' };

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    workflow: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: 'wf1', name: 'Test', entityType: 'grn', isActive: true }),
    },
    workflowRule: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'wr1', workflowId: 'wf1', name: 'Rule' }),
      update: vi.fn().mockResolvedValue({ id: 'wr1', name: 'Updated' }),
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
const BASE = '/api/v1/workflows/wf1/rules';

describe('Workflow Rule Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(fakeWorkflow as any);
    vi.mocked(prisma.workflowRule.findUnique).mockResolvedValue(fakeRule as any);
  });

  // GET /workflows/:workflowId/rules
  describe('GET /workflows/:workflowId/rules', () => {
    it('returns 200 with rules', async () => {
      vi.mocked(prisma.workflowRule.findMany).mockResolvedValue([]);
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin/manager', async () => {
      const viewerToken = signTestToken({ userId: 'v1', systemRole: 'viewer' });
      const res = await request.get(BASE).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // GET /workflows/:workflowId/rules/:id
  describe('GET /workflows/:workflowId/rules/:id', () => {
    it('returns 200 when found', async () => {
      vi.mocked(prisma.workflowRule.findUnique).mockResolvedValue(fakeRule as any);
      const res = await request.get(`${BASE}/wr1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.workflowRule.findUnique).mockResolvedValue(null);
      const res = await request.get(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // POST /workflows/:workflowId/rules
  describe('POST /workflows/:workflowId/rules', () => {
    it('returns 201 on success', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Auto-approve GRN',
          triggerEvent: 'grn:created',
          conditions: { field: 'status', op: 'eq', value: 'draft' },
          actions: [{ type: 'change_status', params: { status: 'approved' } }],
        });
      expect(res.status).toBe(201);
    });

    it('returns 404 when workflow not found', async () => {
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue(null);
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rule',
          triggerEvent: 'grn:created',
          conditions: { field: 'status', op: 'eq', value: 'draft' },
          actions: [{ type: 'change_status', params: { status: 'approved' } }],
        });
      expect(res.status).toBe(404);
    });
  });

  // PUT /workflows/:workflowId/rules/:id
  describe('PUT /workflows/:workflowId/rules/:id', () => {
    it('returns 200 on update', async () => {
      const res = await request
        .put(`${BASE}/wr1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Rule' });
      expect(res.status).toBe(200);
    });
  });

  // DELETE /workflows/:workflowId/rules/:id
  describe('DELETE /workflows/:workflowId/rules/:id', () => {
    it('returns 204 on delete', async () => {
      const res = await request.delete(`${BASE}/wr1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });

  // GET /workflows/:workflowId/rules/:id/logs
  describe('GET /workflows/:workflowId/rules/:id/logs', () => {
    it('returns 200 with logs', async () => {
      const res = await request.get(`${BASE}/wr1/logs`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
