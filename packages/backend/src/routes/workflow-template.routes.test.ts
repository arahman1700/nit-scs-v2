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

const fakeTemplate = {
  id: 'tmpl1',
  name: 'Auto-approve GRN',
  category: 'approval',
  template: {
    workflow: { name: 'Auto GRN', entityType: 'grn' },
    rules: [{ name: 'Rule 1', triggerEvent: 'grn:created', conditions: {}, actions: [{ type: 'approve' }] }],
  },
  installCount: 0,
};

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    workflowTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'tmpl1', installCount: 1 }),
    },
    workflow: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'wf-new' }),
    },
    workflowRule: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
      // Simulate transaction by calling fn with prisma-like object
      return fn({
        workflow: {
          create: vi.fn().mockResolvedValue({ id: 'wf-new' }),
        },
        workflowRule: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        workflowTemplate: {
          update: vi.fn().mockResolvedValue({ id: 'tmpl1', installCount: 1 }),
        },
      });
    }),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/workflow-templates';

describe('Workflow Template Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(prisma.workflowTemplate.findUnique).mockResolvedValue(fakeTemplate as any);
  });

  // GET /workflow-templates
  describe('GET /workflow-templates', () => {
    it('returns 200 with list', async () => {
      vi.mocked(prisma.workflowTemplate.findMany).mockResolvedValue([]);
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /workflow-templates/:id
  describe('GET /workflow-templates/:id', () => {
    it('returns 200 when found', async () => {
      const res = await request.get(`${BASE}/tmpl1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.workflowTemplate.findUnique).mockResolvedValue(null);
      const res = await request.get(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // POST /workflow-templates/:id/install
  describe('POST /workflow-templates/:id/install', () => {
    it('returns 201 on install', async () => {
      const res = await request.post(`${BASE}/tmpl1/install`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflowId).toBeDefined();
    });

    it('returns 404 when template not found', async () => {
      vi.mocked(prisma.workflowTemplate.findUnique).mockResolvedValue(null);
      const res = await request.post(`${BASE}/nonexistent/install`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/tmpl1/install`);
      expect(res.status).toBe(401);
    });
  });
});
