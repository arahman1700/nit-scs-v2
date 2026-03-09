/**
 * Integration tests for demand routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../../../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../../utils/prisma.js', () => ({
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
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/consumption-trend.service.js', () => ({
  getItemConsumptionTrend: vi.fn(),
  getTopConsumptionItems: vi.fn(),
}));
vi.mock('../services/demand-forecast.service.js', () => ({
  generateReorderSuggestions: vi.fn(),
  getItemForecastProjection: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import { getItemConsumptionTrend, getTopConsumptionItems } from '../services/consumption-trend.service.js';
import { generateReorderSuggestions, getItemForecastProjection } from '../services/demand-forecast.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const INVENTORY_TOKEN = signTestToken({ userId: 'inv-1', systemRole: 'inventory_specialist' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/demand/trends/:itemId', () => {
  it('should return 200 with item trend', async () => {
    vi.mocked(getItemConsumptionTrend).mockResolvedValue([{ month: '2026-01', qty: 50 }] as never);

    const res = await request.get('/api/v1/demand/trends/item-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/demand/trends/item-1').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/demand/top-items', () => {
  it('should return 200 with top items', async () => {
    vi.mocked(getTopConsumptionItems).mockResolvedValue([{ itemId: 'i-1', total: 200 }] as never);

    const res = await request.get('/api/v1/demand/top-items').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should allow inventory_specialist', async () => {
    vi.mocked(getTopConsumptionItems).mockResolvedValue([] as never);

    const res = await request.get('/api/v1/demand/top-items').set('Authorization', `Bearer ${INVENTORY_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/demand/reorder-suggestions', () => {
  it('should return 200 with suggestions', async () => {
    vi.mocked(generateReorderSuggestions).mockResolvedValue([{ itemId: 'i-1', suggestedQty: 100 }] as never);

    const res = await request.get('/api/v1/demand/reorder-suggestions').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/demand/forecast/:itemId', () => {
  it('should return 200 with forecast', async () => {
    vi.mocked(getItemForecastProjection).mockResolvedValue({
      itemId: 'i-1',
      projections: [],
    } as never);

    const res = await request
      .get('/api/v1/demand/forecast/item-1?warehouseId=wh-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 400 if warehouseId missing', async () => {
    const res = await request.get('/api/v1/demand/forecast/item-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });
});
