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

vi.mock('../services/mrf.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'mrf-new', mrfNumber: 'MRF-001' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  submit: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'submitted' }),
  review: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'under_review' }),
  approve: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'approved' }),
  checkStock: vi.fn().mockResolvedValue({ stockResults: [] }),
  convertToMirv: vi.fn().mockResolvedValue({ status: 'mirv_created', mirv: null }),
  fulfill: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'fulfilled' }),
  reject: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'rejected' }),
  cancel: vi.fn().mockResolvedValue({ id: 'mrf-1', status: 'cancelled' }),
  convertToImsf: vi.fn(),
  convertToJo: vi.fn(),
}));

import * as mrfService from '../services/mrf.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);

// MRF is mounted inside logistics.routes at /mrf, and logistics is mounted at / in index.ts
const BASE = '/api/v1/mrf';

describe('MRF Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    // Restore default mock for list since clearAllMocks resets it
    vi.mocked(mrfService.list).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(mrfService.getById).mockResolvedValue({ id: 'mrf-1', status: 'draft' });
  });

  describe('GET /api/v1/mrf', () => {
    it('returns 200 with paginated list', async () => {
      vi.mocked(mrfService.list).mockResolvedValue({
        data: [{ id: 'mrf-1', mrfNumber: 'MRF-001' }],
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

  describe('GET /api/v1/mrf/:id', () => {
    it('returns 200 with single record', async () => {
      const res = await request.get(`${BASE}/mrf-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/mrf-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/mrf/:id/submit', () => {
    it('returns 200 on submit action', async () => {
      vi.mocked(mrfService.submit).mockResolvedValue({ id: 'mrf-1', status: 'submitted' } as any);

      const res = await request.post(`${BASE}/mrf-1/submit`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(mrfService.submit).toHaveBeenCalledWith('mrf-1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/mrf-1/submit`).send({});
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/mrf/:id/approve', () => {
    it('returns 200 on approve action', async () => {
      vi.mocked(mrfService.approve).mockResolvedValue({ id: 'mrf-1', status: 'approved' } as any);

      const res = await request.post(`${BASE}/mrf-1/approve`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(mrfService.approve).toHaveBeenCalled();
    });

    it('returns 403 for unauthorized role', async () => {
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      const res = await request.post(`${BASE}/mrf-1/approve`).set('Authorization', `Bearer ${staffToken}`).send({});

      expect(res.status).toBe(403);
    });
  });
});
