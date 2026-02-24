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

vi.mock('../services/surplus.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'sur1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'sur1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'sur1' } }),
  evaluate: vi.fn().mockResolvedValue({ id: 'sur1', status: 'evaluated' }),
  approve: vi.fn().mockResolvedValue({ id: 'sur1', status: 'approved' }),
  action: vi.fn().mockResolvedValue({ id: 'sur1', status: 'actioned' }),
  scmApprove: vi.fn().mockResolvedValue({ id: 'sur1', status: 'approved' }),
  close: vi.fn().mockResolvedValue({ id: 'sur1', status: 'closed' }),
}));

import * as surplusService from '../services/surplus.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/surplus';

describe('Surplus Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /surplus
  describe('GET /surplus', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(surplusService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /surplus/:id
  describe('GET /surplus/:id', () => {
    it('returns 200 with surplus item', async () => {
      const res = await request.get(`${BASE}/sur1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(surplusService.getById).toHaveBeenCalledWith('sur1');
    });
  });

  // POST /surplus/:id/evaluate
  describe('POST /surplus/:id/evaluate', () => {
    it('returns 200 on evaluate', async () => {
      const res = await request.post(`${BASE}/sur1/evaluate`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(surplusService.evaluate).toHaveBeenCalledWith('sur1');
    });
  });

  // POST /surplus/:id/approve
  describe('POST /surplus/:id/approve', () => {
    it('returns 200 on approve', async () => {
      const res = await request.post(`${BASE}/sur1/approve`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(surplusService.approve).toHaveBeenCalledWith('sur1');
    });
  });

  // POST /surplus/:id/action
  describe('POST /surplus/:id/action', () => {
    it('returns 200 on action', async () => {
      const res = await request.post(`${BASE}/sur1/action`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(surplusService.action).toHaveBeenCalled();
    });
  });

  // POST /surplus/:id/scm-approve
  describe('POST /surplus/:id/scm-approve', () => {
    it('returns 200 on scm-approve', async () => {
      const res = await request.post(`${BASE}/sur1/scm-approve`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(surplusService.scmApprove).toHaveBeenCalled();
    });
  });

  // POST /surplus/:id/close
  describe('POST /surplus/:id/close', () => {
    it('returns 200 on close', async () => {
      const res = await request.post(`${BASE}/sur1/close`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(surplusService.close).toHaveBeenCalledWith('sur1');
    });
  });
});
