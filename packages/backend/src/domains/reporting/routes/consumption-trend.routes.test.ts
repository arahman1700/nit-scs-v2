/**
 * Integration tests for consumption trend routes.
 */

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
vi.mock('../../../utils/cache.js', () => ({
  cached: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
  CacheTTL: { DASHBOARD_STATS: 300, REPORT_DATA: 600 },
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import { getItemConsumptionTrend, getTopConsumptionItems } from '../services/consumption-trend.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/consumption-trends/items/:itemId', () => {
  it('should return 200 with consumption trend', async () => {
    vi.mocked(getItemConsumptionTrend).mockResolvedValue([{ month: '2026-01', quantity: 100 }] as never);

    const res = await request
      .get('/api/v1/consumption-trends/items/item-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should pass months param', async () => {
    vi.mocked(getItemConsumptionTrend).mockResolvedValue([] as never);

    await request.get('/api/v1/consumption-trends/items/item-1?months=6').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(getItemConsumptionTrend).toHaveBeenCalledWith('item-1', 6);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/consumption-trends/items/item-1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/consumption-trends/top', () => {
  it('should return 200 with top consumption items', async () => {
    vi.mocked(getTopConsumptionItems).mockResolvedValue([
      { itemId: 'item-1', name: 'Cement', totalQuantity: 500 },
    ] as never);

    const res = await request.get('/api/v1/consumption-trends/top').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should pass query params', async () => {
    vi.mocked(getTopConsumptionItems).mockResolvedValue([] as never);

    await request
      .get('/api/v1/consumption-trends/top?warehouseId=wh-1&months=3&limit=5')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(getTopConsumptionItems).toHaveBeenCalledWith('wh-1', 3, 5);
  });
});
