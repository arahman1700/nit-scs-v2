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

// QCI has resource: 'qci' so it uses requirePermission -> hasPermissionDB
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/qci.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'qci-1', status: 'pending' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  start: vi.fn().mockResolvedValue({ id: 'qci-1', status: 'in_progress' }),
  complete: vi.fn().mockResolvedValue({ updated: { id: 'qci-1' }, mrrvId: null }),
  completeConditional: vi.fn(),
  pmApprove: vi.fn().mockResolvedValue({ updated: { id: 'qci-1' }, mrrvId: null }),
}));

import * as qciService from '../services/qci.service.js';
import { hasPermissionDB } from '../services/permission.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/qci';

describe('QCI Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(qciService.list).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(qciService.getById).mockResolvedValue({ id: 'qci-1', status: 'pending' });
    vi.mocked(hasPermissionDB).mockResolvedValue(true);
  });

  describe('GET /api/v1/qci', () => {
    it('returns 200 with paginated list', async () => {
      vi.mocked(qciService.list).mockResolvedValue({
        data: [{ id: 'qci-1' }],
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

  describe('GET /api/v1/qci/:id', () => {
    it('returns 200 with single record', async () => {
      const res = await request.get(`${BASE}/qci-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/qci-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/qci/:id/start', () => {
    it('returns 200 on start', async () => {
      vi.mocked(qciService.start).mockResolvedValue({ id: 'qci-1', status: 'in_progress' } as any);

      const res = await request.post(`${BASE}/qci-1/start`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(qciService.start).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/qci-1/start`).send({});
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/qci/:id/complete', () => {
    it('returns 200 on complete', async () => {
      vi.mocked(qciService.complete).mockResolvedValue({
        updated: { id: 'qci-1', status: 'completed' },
        mrrvId: 'mrrv-1',
      } as any);

      const res = await request
        .post(`${BASE}/qci-1/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ result: 'pass', comments: 'All good' });

      expect(res.status).toBe(200);
      expect(qciService.complete).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/qci/:id/pm-approve', () => {
    it('returns 200 on pm-approve', async () => {
      vi.mocked(qciService.pmApprove).mockResolvedValue({
        updated: { id: 'qci-1' },
        mrrvId: null,
      } as any);

      const res = await request
        .post(`${BASE}/qci-1/pm-approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ comments: 'Approved by PM' });

      expect(res.status).toBe(200);
      expect(qciService.pmApprove).toHaveBeenCalled();
    });
  });
});
