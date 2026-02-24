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

vi.mock('../services/semantic-layer.service.js', () => ({
  listMeasures: vi.fn().mockResolvedValue([]),
  listDimensions: vi.fn().mockResolvedValue([]),
  getMeasureCatalog: vi.fn().mockResolvedValue({}),
  getCompatibleDimensions: vi.fn().mockResolvedValue([]),
  executeSemanticQuery: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
}));

import {
  listMeasures,
  listDimensions,
  getMeasureCatalog,
  getCompatibleDimensions,
  executeSemanticQuery,
} from '../services/semantic-layer.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/semantic';

describe('Semantic Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/semantic/measures', () => {
    it('returns 200 with measures', async () => {
      vi.mocked(listMeasures).mockResolvedValue([
        { key: 'grn_count', label: 'GRN Count', category: 'receiving' },
      ] as any);

      const res = await request.get(`${BASE}/measures`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(listMeasures).toHaveBeenCalledWith(undefined);
    });

    it('passes category filter', async () => {
      vi.mocked(listMeasures).mockResolvedValue([]);

      const res = await request.get(`${BASE}/measures?category=receiving`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(listMeasures).toHaveBeenCalledWith('receiving');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/measures`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/semantic/dimensions', () => {
    it('returns 200 with dimensions', async () => {
      vi.mocked(listDimensions).mockResolvedValue([
        { key: 'warehouse', label: 'Warehouse', entityType: 'warehouse' },
      ] as any);

      const res = await request.get(`${BASE}/dimensions`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('passes entityType filter', async () => {
      vi.mocked(listDimensions).mockResolvedValue([]);

      const res = await request.get(`${BASE}/dimensions?entityType=project`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(listDimensions).toHaveBeenCalledWith('project');
    });
  });

  describe('GET /api/v1/semantic/catalog', () => {
    it('returns 200 with catalog', async () => {
      vi.mocked(getMeasureCatalog).mockResolvedValue({ receiving: [{ key: 'grn_count' }] } as any);

      const res = await request.get(`${BASE}/catalog`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getMeasureCatalog).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/semantic/measures/:key/dimensions', () => {
    it('returns 200 with compatible dimensions', async () => {
      vi.mocked(getCompatibleDimensions).mockResolvedValue([{ key: 'warehouse' }] as any);

      const res = await request.get(`${BASE}/measures/grn_count/dimensions`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(getCompatibleDimensions).toHaveBeenCalledWith('grn_count');
    });
  });

  describe('POST /api/v1/semantic/query', () => {
    it('returns 200 with query result', async () => {
      vi.mocked(executeSemanticQuery).mockResolvedValue({ rows: [{ count: 10 }], columns: ['count'] } as any);

      const res = await request
        .post(`${BASE}/query`)
        .set('Authorization', `Bearer ${token}`)
        .send({ measures: ['grn_count'], dimensions: ['warehouse'], filters: {} });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(executeSemanticQuery).toHaveBeenCalledWith({
        measures: ['grn_count'],
        dimensions: ['warehouse'],
        filters: {},
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/query`).send({ measures: ['grn_count'] });

      expect(res.status).toBe(401);
    });
  });
});
