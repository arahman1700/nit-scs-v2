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

vi.mock('../services/stock-transfer.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'wt1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'wt1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'wt1' } }),
  submit: vi.fn().mockResolvedValue({ id: 'wt1', status: 'pending' }),
  approve: vi.fn().mockResolvedValue({ id: 'wt1', status: 'approved' }),
  ship: vi.fn().mockResolvedValue({ fromWarehouseId: 'wh1', updated: { id: 'wt1', status: 'shipped' } }),
  receive: vi.fn().mockResolvedValue({ toWarehouseId: 'wh2', updated: { id: 'wt1', status: 'received' } }),
  complete: vi.fn().mockResolvedValue({ id: 'wt1', status: 'completed' }),
  cancel: vi.fn().mockResolvedValue({ id: 'wt1', status: 'cancelled' }),
}));

import * as stService from '../services/stock-transfer.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/wt';

describe('WT (Warehouse Transfer) Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /wt
  describe('GET /wt', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /wt/:id
  describe('GET /wt/:id', () => {
    it('returns 200 with transfer', async () => {
      const res = await request.get(`${BASE}/wt1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stService.getById).toHaveBeenCalledWith('wt1');
    });
  });

  // POST /wt/:id/submit
  describe('POST /wt/:id/submit', () => {
    it('returns 200 on submit', async () => {
      const res = await request.post(`${BASE}/wt1/submit`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stService.submit).toHaveBeenCalledWith('wt1');
    });
  });

  // POST /wt/:id/approve
  describe('POST /wt/:id/approve', () => {
    it('returns 200 on approve', async () => {
      const res = await request.post(`${BASE}/wt1/approve`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stService.approve).toHaveBeenCalledWith('wt1');
    });
  });

  // POST /wt/:id/ship
  describe('POST /wt/:id/ship', () => {
    it('returns 200 on ship', async () => {
      const res = await request.post(`${BASE}/wt1/ship`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // POST /wt/:id/receive
  describe('POST /wt/:id/receive', () => {
    it('returns 200 on receive', async () => {
      const res = await request.post(`${BASE}/wt1/receive`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // POST /wt/:id/complete
  describe('POST /wt/:id/complete', () => {
    it('returns 200 on complete', async () => {
      const res = await request.post(`${BASE}/wt1/complete`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stService.complete).toHaveBeenCalledWith('wt1');
    });
  });

  // POST /wt/:id/cancel
  describe('POST /wt/:id/cancel', () => {
    it('returns 200 on cancel', async () => {
      const res = await request.post(`${BASE}/wt1/cancel`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stService.cancel).toHaveBeenCalledWith('wt1');
    });
  });
});
