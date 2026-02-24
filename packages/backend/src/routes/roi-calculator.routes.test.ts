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

import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/roi-calculator';

describe('ROI Calculator Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('POST /api/v1/roi-calculator/calculate', () => {
    it('returns 200 with ROI calculation using defaults', async () => {
      const res = await request.post(`${BASE}/calculate`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('laborSavingsMonthly');
      expect(res.body.data).toHaveProperty('annualSavings');
      expect(res.body.data).toHaveProperty('roiMonths');
      expect(res.body.data).toHaveProperty('breakdown');
    });

    it('returns 200 with custom inputs', async () => {
      const res = await request.post(`${BASE}/calculate`).set('Authorization', `Bearer ${token}`).send({
        monthlyOrders: 10000,
        warehouseWorkers: 50,
        avgPickTimeMinutes: 5,
        currentAccuracyPercent: 90,
        avgShippingCostPerOrder: 20,
        avgInventoryValue: 1_000_000,
        currentShrinkagePercent: 3,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.annualSavings).toBeGreaterThan(0);
    });

    it('returns 400 for negative input values', async () => {
      const res = await request
        .post(`${BASE}/calculate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ monthlyOrders: -100 });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/calculate`).send({});
      expect(res.status).toBe(401);
    });
  });
});
