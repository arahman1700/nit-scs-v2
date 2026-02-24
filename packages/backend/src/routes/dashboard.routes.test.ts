/**
 * Integration tests for dashboard routes.
 */

const { modelCache } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
  const modelCache: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  return { modelCache };
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
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn().mockResolvedValue([]);
        const key = String(prop);
        if (!modelCache[key]) {
          modelCache[key] = {};
        }
        return new Proxy(modelCache[key], {
          get: (obj, method) => {
            const m = String(method);
            if (!obj[m]) {
              // count returns 0, findMany/groupBy return [], $queryRaw returns []
              if (m === 'count') obj[m] = vi.fn().mockResolvedValue(0);
              else obj[m] = vi.fn().mockResolvedValue([]);
            }
            return obj[m];
          },
        });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/labor-productivity.service.js', () => ({
  getProductivitySummary: vi.fn().mockResolvedValue({ avgEfficiency: 85 }),
}));

vi.mock('../services/inventory.service.js', () => ({
  getCrossDepartmentInventorySummary: vi.fn().mockResolvedValue({ totalValue: 100000 }),
}));

// Must also mock cache so it just calls the fetcher
vi.mock('../utils/cache.js', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()),
  CacheTTL: {
    DASHBOARD_STATS: 60,
    RECENT_ACTIVITY: 60,
    INVENTORY_SUMMARY: 60,
    DOCUMENT_COUNTS: 60,
    SLA_COMPLIANCE: 60,
    TOP_PROJECTS: 60,
    LABOR_PRODUCTIVITY: 60,
  },
  invalidateCache: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  // Reset model cache mocks
  for (const model of Object.values(modelCache)) {
    for (const fn of Object.values(model)) {
      fn.mockClear();
    }
  }
});

describe('GET /api/v1/dashboard/stats', () => {
  it('should return 200 with stats', async () => {
    const res = await request.get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dashboard/stats');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/recent-activity', () => {
  it('should return 200 with activity', async () => {
    const res = await request.get('/api/v1/dashboard/recent-activity').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dashboard/recent-activity');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/inventory-summary', () => {
  it('should return 200 with inventory data', async () => {
    const res = await request.get('/api/v1/dashboard/inventory-summary').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/dashboard/document-counts', () => {
  it('should return 200 with counts', async () => {
    const res = await request.get('/api/v1/dashboard/document-counts').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dashboard/document-counts');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/labor-productivity', () => {
  it('should return 200 with productivity data', async () => {
    const res = await request.get('/api/v1/dashboard/labor-productivity').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/dashboard/exceptions', () => {
  it('should return 200 with exceptions', async () => {
    const res = await request.get('/api/v1/dashboard/exceptions').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dashboard/exceptions');
    expect(res.status).toBe(401);
  });
});
