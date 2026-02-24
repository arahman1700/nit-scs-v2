import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

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

const mockDataSourceFn = vi.fn().mockResolvedValue({ count: 42 });

vi.mock('../services/widget-data.service.js', () => ({
  listDataSources: vi.fn().mockReturnValue(['stats/projects', 'stats/inventory']),
  getDataSource: vi.fn().mockImplementation((key: string) => {
    if (key === 'stats/projects') return mockDataSourceFn;
    return undefined;
  }),
  register: vi.fn(),
  registerDynamicDataSources: vi.fn(),
}));

import * as widgetDataService from '../services/widget-data.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/widget-data';

describe('Widget Data Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set mocks after clearAllMocks
    vi.mocked(widgetDataService.listDataSources).mockReturnValue(['stats/projects', 'stats/inventory']);
    vi.mocked(widgetDataService.getDataSource).mockImplementation((key: string) => {
      if (key === 'stats/projects') return mockDataSourceFn;
      return undefined;
    });
    mockDataSourceFn.mockResolvedValue({ count: 42 });
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /widget-data
  describe('GET /widget-data', () => {
    it('returns 200 with data sources list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dataSources).toContain('stats/projects');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /widget-data/stats/projects
  describe('GET /widget-data/*dataSource', () => {
    it('returns 200 with data from known source', async () => {
      const res = await request.get(`${BASE}/stats/projects`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ count: 42 });
    });

    it('returns 404 for unknown source', async () => {
      const res = await request.get(`${BASE}/unknown/source`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('passes query params as config', async () => {
      await request.get(`${BASE}/stats/projects?limit=10&groupBy=month`).set('Authorization', `Bearer ${adminToken}`);
      expect(mockDataSourceFn).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, groupBy: 'month' }));
    });
  });
});
