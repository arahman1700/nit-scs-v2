import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
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

vi.mock('../services/labor-standard.service.js', () => ({
  listStandards: vi.fn().mockResolvedValue([{ id: 'ls1', taskType: 'receiving', standardMinutes: 15 }]),
  upsertStandard: vi.fn().mockResolvedValue({
    id: 'ls1',
    taskType: 'receiving',
    standardMinutes: 20,
  }),
  getPerformanceReport: vi.fn().mockResolvedValue({
    totalTasks: 100,
    avgEfficiency: 0.92,
  }),
}));

import * as laborStandardService from '../services/labor-standard.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/labor';

describe('Labor Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/labor/standards', () => {
    it('returns 200 with list of labor standards', async () => {
      const res = await request.get(`${BASE}/standards`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].taskType).toBe('receiving');
      expect(laborStandardService.listStandards).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/standards`);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/labor/standards/:taskType', () => {
    it('returns 200 on upsert standard', async () => {
      const res = await request
        .put(`${BASE}/standards/receiving`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ standardMinutes: 20, description: 'Receiving task', unitOfMeasure: 'pallet' });

      expect(res.status).toBe(200);
      expect(res.body.data.standardMinutes).toBe(20);
      expect(laborStandardService.upsertStandard).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.put(`${BASE}/standards/receiving`).send({ standardMinutes: 20 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/labor/performance', () => {
    it('returns 200 with performance report', async () => {
      const res = await request.get(`${BASE}/performance?days=30`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalTasks).toBe(100);
      expect(laborStandardService.getPerformanceReport).toHaveBeenCalledWith(30, undefined);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/performance`);
      expect(res.status).toBe(401);
    });
  });
});
