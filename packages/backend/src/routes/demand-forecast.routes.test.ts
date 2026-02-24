/**
 * Integration tests for demand-forecast routes.
 */

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

vi.mock('../services/demand-forecast.service.js', () => ({
  getForecast: vi.fn(),
  getTopDemandItems: vi.fn(),
  getReorderAlerts: vi.fn(),
  getSeasonalPatterns: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as forecastService from '../services/demand-forecast.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/demand-forecast', () => {
  it('should return 200 with forecasts', async () => {
    vi.mocked(forecastService.getForecast).mockResolvedValue([{ itemId: 'i1', forecast: 100 }] as never);

    const res = await request.get('/api/v1/demand-forecast').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 for invalid months', async () => {
    const res = await request.get('/api/v1/demand-forecast?months=15').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/months/i);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/demand-forecast');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/demand-forecast/top-demand', () => {
  it('should return 200 with top demand items', async () => {
    vi.mocked(forecastService.getTopDemandItems).mockResolvedValue([{ itemId: 'i1', demand: 500 }] as never);

    const res = await request.get('/api/v1/demand-forecast/top-demand').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/demand-forecast/top-demand');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/demand-forecast/reorder-alerts', () => {
  it('should return 200 with alerts', async () => {
    vi.mocked(forecastService.getReorderAlerts).mockResolvedValue([{ itemId: 'i1', reorderQty: 50 }] as never);

    const res = await request
      .get('/api/v1/demand-forecast/reorder-alerts?warehouseId=wh-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 without warehouseId', async () => {
    const res = await request
      .get('/api/v1/demand-forecast/reorder-alerts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/warehouseId/i);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/demand-forecast/reorder-alerts?warehouseId=wh-1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/demand-forecast/seasonal', () => {
  it('should return 200 with patterns', async () => {
    vi.mocked(forecastService.getSeasonalPatterns).mockResolvedValue([{ month: 1, pattern: 'high' }] as never);

    const res = await request.get('/api/v1/demand-forecast/seasonal').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
