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

// Scrap has resource: 'scrap' so it uses requirePermission
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/scrap.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'scrap-new' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  report: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'reported' }),
  approveBySiteManager: vi.fn().mockResolvedValue({ id: 'scrap-1' }),
  approveByQc: vi.fn().mockResolvedValue({ id: 'scrap-1' }),
  approveByStorekeeper: vi.fn().mockResolvedValue({ id: 'scrap-1' }),
  approve: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'approved' }),
  sendToSsc: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'in_ssc' }),
  markSold: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'sold' }),
  dispose: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'disposed' }),
  close: vi.fn().mockResolvedValue({ id: 'scrap-1', status: 'closed' }),
}));

import * as scrapService from '../services/scrap.service.js';
import { hasPermissionDB } from '../services/permission.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/scrap';

describe('Scrap Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(scrapService.list).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(scrapService.getById).mockResolvedValue({ id: 'scrap-1', status: 'draft' });
    vi.mocked(hasPermissionDB).mockResolvedValue(true);
  });

  describe('GET /api/v1/scrap', () => {
    it('returns 200 with paginated list', async () => {
      vi.mocked(scrapService.list).mockResolvedValue({
        data: [{ id: 'scrap-1' }],
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

  describe('GET /api/v1/scrap/:id', () => {
    it('returns 200 with single record', async () => {
      const res = await request.get(`${BASE}/scrap-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/scrap-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/scrap/:id/report', () => {
    it('returns 200 on report', async () => {
      vi.mocked(scrapService.report).mockResolvedValue({ id: 'scrap-1', status: 'reported' } as any);

      const res = await request.post(`${BASE}/scrap-1/report`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(scrapService.report).toHaveBeenCalledWith('scrap-1');
    });
  });

  describe('POST /api/v1/scrap/:id/approve', () => {
    it('returns 200 on approve', async () => {
      vi.mocked(scrapService.approve).mockResolvedValue({ id: 'scrap-1', status: 'approved' } as any);

      const res = await request.post(`${BASE}/scrap-1/approve`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(scrapService.approve).toHaveBeenCalledWith('scrap-1');
    });
  });

  describe('POST /api/v1/scrap/:id/mark-sold', () => {
    it('returns 200 on mark-sold', async () => {
      vi.mocked(scrapService.markSold).mockResolvedValue({ id: 'scrap-1', status: 'sold' } as any);

      const res = await request
        .post(`${BASE}/scrap-1/mark-sold`)
        .set('Authorization', `Bearer ${token}`)
        .send({ buyerName: 'Buyer Corp' });

      expect(res.status).toBe(200);
      expect(scrapService.markSold).toHaveBeenCalledWith('scrap-1', 'Buyer Corp');
    });
  });

  describe('POST /api/v1/scrap/:id/close', () => {
    it('returns 200 on close', async () => {
      vi.mocked(scrapService.close).mockResolvedValue({ id: 'scrap-1', status: 'closed' } as any);

      const res = await request.post(`${BASE}/scrap-1/close`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(scrapService.close).toHaveBeenCalledWith('scrap-1');
    });
  });
});
