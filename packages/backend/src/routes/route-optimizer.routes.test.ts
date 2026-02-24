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

vi.mock('../services/route-optimizer.service.js', () => ({
  optimizeRoute: vi.fn().mockResolvedValue({ totalDistanceKm: 50, stops: [] }),
  getUndeliveredJOs: vi.fn().mockResolvedValue([]),
  estimateFuelCost: vi.fn().mockReturnValue({ fuelLiters: 10, fuelCost: 50 }),
  haversineDistance: vi.fn(),
}));

import { optimizeRoute, getUndeliveredJOs, estimateFuelCost } from '../services/route-optimizer.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/route-optimizer';

describe('Route Optimizer Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('POST /api/v1/route-optimizer/optimize', () => {
    it('returns 200 with optimized route', async () => {
      vi.mocked(optimizeRoute).mockResolvedValue({ totalDistanceKm: 50, stops: [] } as any);

      const res = await request
        .post(`${BASE}/optimize`)
        .set('Authorization', `Bearer ${token}`)
        .send({ warehouseId: 'wh-1', joIds: ['jo-1', 'jo-2'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(optimizeRoute).toHaveBeenCalledWith('wh-1', ['jo-1', 'jo-2']);
    });

    it('returns 400 when warehouseId missing', async () => {
      const res = await request
        .post(`${BASE}/optimize`)
        .set('Authorization', `Bearer ${token}`)
        .send({ joIds: ['jo-1'] });

      expect(res.status).toBe(400);
    });

    it('returns 400 when joIds is empty', async () => {
      const res = await request
        .post(`${BASE}/optimize`)
        .set('Authorization', `Bearer ${token}`)
        .send({ warehouseId: 'wh-1', joIds: [] });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/optimize`).send({ warehouseId: 'wh-1', joIds: ['jo-1'] });
      expect(res.status).toBe(401);
    });

    it('returns 403 for unauthorized role', async () => {
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      const res = await request
        .post(`${BASE}/optimize`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ warehouseId: 'wh-1', joIds: ['jo-1'] });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/route-optimizer/undelivered', () => {
    it('returns 200 with undelivered JOs', async () => {
      vi.mocked(getUndeliveredJOs).mockResolvedValue([{ joId: 'jo-1' }] as any);

      const res = await request.get(`${BASE}/undelivered?warehouseId=wh-1`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getUndeliveredJOs).toHaveBeenCalledWith('wh-1');
    });

    it('returns 400 when warehouseId missing', async () => {
      const res = await request.get(`${BASE}/undelivered`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/route-optimizer/estimate-fuel', () => {
    it('returns 200 with fuel estimate', async () => {
      vi.mocked(estimateFuelCost).mockReturnValue({ fuelLiters: 10, fuelCost: 50 } as any);

      const res = await request
        .post(`${BASE}/estimate-fuel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ distanceKm: 100, fuelPrice: 5.0 });

      expect(res.status).toBe(200);
      expect(estimateFuelCost).toHaveBeenCalledWith(100, 5.0);
    });

    it('returns 400 for invalid distanceKm', async () => {
      const res = await request
        .post(`${BASE}/estimate-fuel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ distanceKm: -10, fuelPrice: 5.0 });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid fuelPrice', async () => {
      const res = await request
        .post(`${BASE}/estimate-fuel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ distanceKm: 100, fuelPrice: 0 });

      expect(res.status).toBe(400);
    });
  });
});
