import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

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
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

// MRN has resource: 'mrn' so it uses requirePermission -> hasPermissionDB
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/mrn.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'mrn-1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'mrn-new', mrvNumber: 'MRN-001' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  submit: vi.fn().mockResolvedValue({ id: 'mrn-1', status: 'pending' }),
  receive: vi.fn().mockResolvedValue({ id: 'mrn-1', status: 'received' }),
  complete: vi
    .fn()
    .mockResolvedValue({ id: 'mrn-1', status: 'completed', goodLinesRestocked: 0, toWarehouseId: 'wh-1' }),
}));

import * as mrnService from '../services/mrn.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/mrn';

describe('MRN Routes', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(mrnService.list).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(mrnService.getById).mockResolvedValue({ id: 'mrn-1', status: 'draft' });
    // Re-mock permission after clearAllMocks
    const { hasPermissionDB } = await import('../services/permission.service.js');
    vi.mocked(hasPermissionDB).mockResolvedValue(true);
  });

  describe('GET /api/v1/mrn', () => {
    it('returns 200 with paginated list', async () => {
      vi.mocked(mrnService.list).mockResolvedValue({
        data: [{ id: 'mrn-1' }],
        total: 1,
      });

      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/mrn/:id', () => {
    it('returns 200 with single record', async () => {
      const res = await request.get(`${BASE}/mrn-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/mrn-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/mrn/:id/submit', () => {
    it('returns 200 on submit', async () => {
      vi.mocked(mrnService.submit).mockResolvedValue({ id: 'mrn-1', status: 'pending' } as any);

      const res = await request.post(`${BASE}/mrn-1/submit`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(mrnService.submit).toHaveBeenCalledWith('mrn-1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/mrn-1/submit`).send({});
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/mrn/:id/complete', () => {
    it('returns 200 on complete', async () => {
      vi.mocked(mrnService.complete).mockResolvedValue({
        id: 'mrn-1',
        status: 'completed',
        goodLinesRestocked: 2,
        toWarehouseId: 'wh-1',
      } as any);

      const res = await request.post(`${BASE}/mrn-1/complete`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(mrnService.complete).toHaveBeenCalled();
    });
  });
});
