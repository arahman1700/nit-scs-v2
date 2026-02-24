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

vi.mock('../services/search.service.js', () => ({
  globalSearch: vi.fn().mockResolvedValue([]),
}));

import { globalSearch } from '../services/search.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/search';

describe('Search Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/search', () => {
    it('returns 200 with search results', async () => {
      vi.mocked(globalSearch).mockResolvedValue([
        { type: 'grn', id: 'grn-1', title: 'GRN-001', description: 'Test GRN' },
      ] as any);

      const res = await request.get(`${BASE}?q=GRN-001`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(globalSearch).toHaveBeenCalledWith('GRN-001', { types: undefined, limit: undefined });
    });

    it('passes types and limit params', async () => {
      vi.mocked(globalSearch).mockResolvedValue([]);

      const res = await request.get(`${BASE}?q=test&types=grn,mi&limit=10`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(globalSearch).toHaveBeenCalledWith('test', {
        types: ['grn', 'mi'],
        limit: 10,
      });
    });

    it('returns 400 when query too short', async () => {
      const res = await request.get(`${BASE}?q=a`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('returns 400 when query missing', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}?q=test`);
      expect(res.status).toBe(401);
    });
  });
});
