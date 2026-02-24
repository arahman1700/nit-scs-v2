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
// Mock rate limiter to pass-through (avoids in-memory counter exhaustion in tests)
vi.mock('../middleware/rate-limiter.js', () => ({
  rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  aiRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/smart-defaults.service.js', () => ({
  getUserDefaults: vi.fn().mockResolvedValue({
    warehouseId: 'wh-1',
    projectId: 'proj-1',
    supplierId: null,
  }),
  invalidateUserDefaults: vi.fn(),
}));

vi.mock('../services/anomaly-detection.service.js', () => ({
  detectAnomalies: vi.fn().mockResolvedValue([{ type: 'unusual_consumption', itemId: 'item-1', severity: 'high' }]),
  getInventoryHealthSummary: vi.fn().mockResolvedValue({
    totalItems: 100,
    lowStock: 5,
    overstock: 10,
    healthy: 85,
  }),
}));

vi.mock('../services/reorder-prediction.service.js', () => ({
  generateReorderPredictions: vi
    .fn()
    .mockResolvedValue([{ itemId: 'item-1', predictedReorderDate: '2026-03-15', confidence: 0.85 }]),
  getWarehousePredictions: vi.fn().mockResolvedValue([]),
  autoUpdateReorderPoints: vi.fn().mockResolvedValue({ updated: 12, total: 50 }),
}));

import * as smartDefaults from '../services/smart-defaults.service.js';
import * as anomalyService from '../services/anomaly-detection.service.js';
import * as reorderService from '../services/reorder-prediction.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/intelligence';

describe('Intelligence Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/intelligence/defaults', () => {
    it('returns 200 with smart defaults', async () => {
      const res = await request.get(`${BASE}/defaults`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.warehouseId).toBe('wh-1');
      expect(smartDefaults.getUserDefaults).toHaveBeenCalledWith('test-user-id');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/defaults`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/intelligence/anomalies', () => {
    it('returns 200 with anomaly data', async () => {
      const res = await request.get(`${BASE}/anomalies`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(anomalyService.detectAnomalies).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/intelligence/inventory-health', () => {
    it('returns 200 with health summary', async () => {
      const res = await request.get(`${BASE}/inventory-health`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalItems).toBe(100);
      expect(anomalyService.getInventoryHealthSummary).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/intelligence/reorder-predictions', () => {
    it('returns 200 with predictions', async () => {
      const res = await request.get(`${BASE}/reorder-predictions`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(reorderService.generateReorderPredictions).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/intelligence/reorder-predictions/auto-update', () => {
    it('returns 200 when admin triggers auto-update', async () => {
      const res = await request
        .post(`${BASE}/reorder-predictions/auto-update`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updated).toBe(12);
      expect(reorderService.autoUpdateReorderPoints).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/reorder-predictions/auto-update`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });
      const res = await request
        .post(`${BASE}/reorder-predictions/auto-update`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
