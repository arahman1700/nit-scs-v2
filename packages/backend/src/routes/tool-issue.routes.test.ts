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

vi.mock('../services/tool-issue.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'ti1', status: 'issued' }),
  create: vi.fn().mockResolvedValue({ id: 'ti1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'ti1' } }),
  returnTool: vi.fn().mockResolvedValue({ id: 'ti1', status: 'returned' }),
}));

import * as toolIssueService from '../services/tool-issue.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/tool-issues';

describe('Tool Issue Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /tool-issues
  describe('GET /tool-issues', () => {
    it('returns 200 with list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(toolIssueService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /tool-issues/:id
  describe('GET /tool-issues/:id', () => {
    it('returns 200 with tool issue', async () => {
      const res = await request.get(`${BASE}/ti1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(toolIssueService.getById).toHaveBeenCalledWith('ti1');
    });
  });

  // POST /tool-issues/:id/return
  describe('POST /tool-issues/:id/return', () => {
    it('returns 200 on return', async () => {
      const res = await request
        .post(`${BASE}/ti1/return`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ returnCondition: 'good' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(toolIssueService.returnTool).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/ti1/return`).send({ condition: 'good' });
      expect(res.status).toBe(401);
    });
  });
});
