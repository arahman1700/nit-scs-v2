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

// rental-contract has resource: 'rental_contract' so uses requirePermission
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/rental-contract.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'rc-1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'rc-new' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
  submit: vi.fn().mockResolvedValue({ id: 'rc-1', status: 'pending_approval' }),
  approve: vi.fn().mockResolvedValue({ id: 'rc-1', status: 'active' }),
  activate: vi.fn().mockResolvedValue({ id: 'rc-1', status: 'active' }),
  extend: vi.fn().mockResolvedValue({ id: 'rc-1', status: 'extended' }),
  terminate: vi.fn().mockResolvedValue({ id: 'rc-1', status: 'terminated' }),
}));

import * as rcService from '../services/rental-contract.service.js';
import { hasPermissionDB } from '../services/permission.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/rental-contracts';

describe('Rental Contract Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    vi.mocked(rcService.list).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(rcService.getById).mockResolvedValue({ id: 'rc-1', status: 'draft' });
    vi.mocked(hasPermissionDB).mockResolvedValue(true);
  });

  describe('GET /api/v1/rental-contracts', () => {
    it('returns 200 with paginated list', async () => {
      vi.mocked(rcService.list).mockResolvedValue({
        data: [{ id: 'rc-1' }],
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

  describe('GET /api/v1/rental-contracts/:id', () => {
    it('returns 200 with single record', async () => {
      const res = await request.get(`${BASE}/rc-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/rc-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/rental-contracts/:id/submit', () => {
    it('returns 200 on submit', async () => {
      vi.mocked(rcService.submit).mockResolvedValue({ id: 'rc-1', status: 'pending_approval' } as any);

      const res = await request.post(`${BASE}/rc-1/submit`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(rcService.submit).toHaveBeenCalledWith('rc-1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/rc-1/submit`).send({});
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/rental-contracts/:id/approve', () => {
    it('returns 200 on approve', async () => {
      vi.mocked(rcService.approve).mockResolvedValue({ id: 'rc-1', status: 'active' } as any);

      const res = await request.post(`${BASE}/rc-1/approve`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(rcService.approve).toHaveBeenCalledWith('rc-1');
    });
  });

  describe('POST /api/v1/rental-contracts/:id/terminate', () => {
    it('returns 200 on terminate', async () => {
      vi.mocked(rcService.terminate).mockResolvedValue({ id: 'rc-1', status: 'terminated' } as any);

      const res = await request.post(`${BASE}/rc-1/terminate`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(rcService.terminate).toHaveBeenCalledWith('rc-1');
    });
  });
});
