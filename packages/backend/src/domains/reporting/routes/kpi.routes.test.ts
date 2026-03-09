/**
 * Integration tests for KPI routes.
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

vi.mock('../services/kpi.service.js', () => ({
  getComprehensiveKpis: vi.fn(),
  getKpisByCategory: vi.fn(),
}));
vi.mock('../../../utils/cache.js', () => ({
  cached: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
  CacheTTL: { DASHBOARD_STATS: 300 },
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import { getComprehensiveKpis, getKpisByCategory } from '../services/kpi.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/kpis', () => {
  it('should return 200 with all KPIs', async () => {
    vi.mocked(getComprehensiveKpis).mockResolvedValue([
      { name: 'Inventory Turnover', value: 4.5, category: 'inventory' },
    ] as never);

    const res = await request.get('/api/v1/kpis').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should pass date params', async () => {
    vi.mocked(getComprehensiveKpis).mockResolvedValue([] as never);

    await request
      .get('/api/v1/kpis?dateFrom=2026-01-01&dateTo=2026-03-31')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(getComprehensiveKpis).toHaveBeenCalledWith(expect.any(Date), expect.any(Date));
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/kpis');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/kpis/:category', () => {
  it('should return 200 for valid category', async () => {
    vi.mocked(getKpisByCategory).mockResolvedValue([{ name: 'Stock Accuracy', value: 98.5 }] as never);

    const res = await request.get('/api/v1/kpis/inventory').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(getKpisByCategory).toHaveBeenCalledWith('inventory', undefined, undefined);
  });

  it('should return 400 for invalid category', async () => {
    const res = await request.get('/api/v1/kpis/invalid-category').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should accept all valid categories', async () => {
    vi.mocked(getKpisByCategory).mockResolvedValue([] as never);

    for (const cat of ['inventory', 'procurement', 'logistics', 'quality', 'financial']) {
      const res = await request.get(`/api/v1/kpis/${cat}`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
    }
  });
});
