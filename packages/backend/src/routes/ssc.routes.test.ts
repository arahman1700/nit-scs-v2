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

vi.mock('../services/ssc.service.js', () => ({
  listBids: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'bid1', status: 'pending' }),
  createBid: vi.fn().mockResolvedValue({ id: 'bid1' }),
  acceptBid: vi.fn().mockResolvedValue({ id: 'bid1', status: 'accepted' }),
  rejectBid: vi.fn().mockResolvedValue({ id: 'bid1', status: 'rejected' }),
  signMemo: vi.fn().mockResolvedValue({ id: 'bid1', sscMemoSigned: true }),
  notifyFinance: vi.fn().mockResolvedValue({ id: 'bid1' }),
}));

import * as sscService from '../services/ssc.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/ssc';

describe('SSC Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // POST /:id/accept
  describe('POST /ssc/:id/accept', () => {
    it('returns 200 on accept', async () => {
      const res = await request.post(`${BASE}/bid1/accept`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sscService.acceptBid).toHaveBeenCalledWith('bid1', 'test-user-id');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/bid1/accept`);
      expect(res.status).toBe(401);
    });
  });

  // POST /:id/reject
  describe('POST /ssc/:id/reject', () => {
    it('returns 200 on reject', async () => {
      const res = await request.post(`${BASE}/bid1/reject`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(sscService.rejectBid).toHaveBeenCalledWith('bid1', 'test-user-id');
    });
  });

  // POST /:id/sign-memo
  describe('POST /ssc/:id/sign-memo', () => {
    it('returns 200 on sign memo', async () => {
      const res = await request.post(`${BASE}/bid1/sign-memo`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(sscService.signMemo).toHaveBeenCalledWith('bid1', 'test-user-id');
    });
  });

  // POST /:id/notify-finance
  describe('POST /ssc/:id/notify-finance', () => {
    it('returns 200 on notify finance', async () => {
      const res = await request.post(`${BASE}/bid1/notify-finance`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(sscService.notifyFinance).toHaveBeenCalledWith('bid1');
    });
  });

  // GET / (CRUD list from crud-factory)
  describe('GET /ssc', () => {
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
});
