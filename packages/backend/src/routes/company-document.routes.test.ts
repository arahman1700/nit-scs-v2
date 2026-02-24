/**
 * Integration tests for company-document routes.
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
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        const key = String(prop);
        if (!modelCache[key]) modelCache[key] = {};
        return new Proxy(modelCache[key], {
          get: (obj, method) => {
            const m = String(method);
            if (!obj[m]) obj[m] = vi.fn().mockResolvedValue(null);
            return obj[m];
          },
          set: (obj, method, value) => {
            obj[String(method)] = value;
            return true;
          },
        });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
  if (!modelCache['companyDocument']) modelCache['companyDocument'] = {};
});

describe('GET /api/v1/documents', () => {
  it('should return 200 with documents list', async () => {
    modelCache['companyDocument']!['findMany'] = vi.fn().mockResolvedValue([{ id: 'doc-1', title: 'Policy' }]);
    modelCache['companyDocument']!['count'] = vi.fn().mockResolvedValue(1);

    const res = await request.get('/api/v1/documents').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/documents');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/documents/categories', () => {
  it('should return 200 with category counts', async () => {
    modelCache['companyDocument']!['groupBy'] = vi.fn().mockResolvedValue([
      { category: 'policy', _count: { id: 5 } },
      { category: 'procedure', _count: { id: 3 } },
    ]);

    const res = await request.get('/api/v1/documents/categories').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/documents/categories');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/documents/:id', () => {
  it('should return 200 when document found', async () => {
    modelCache['companyDocument']!['findFirst'] = vi
      .fn()
      .mockResolvedValue({ id: 'doc-1', title: 'Policy', isActive: true });

    const res = await request.get('/api/v1/documents/doc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when document not found', async () => {
    modelCache['companyDocument']!['findFirst'] = vi.fn().mockResolvedValue(null);

    const res = await request.get('/api/v1/documents/not-found').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/documents/doc-1');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/documents/:id', () => {
  it('should return 204 for admin deleting a document', async () => {
    modelCache['companyDocument']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'doc-1', isActive: true });
    modelCache['companyDocument']!['update'] = vi.fn().mockResolvedValue({ id: 'doc-1', isActive: false });

    const res = await request.delete('/api/v1/documents/doc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(204);
  });

  it('should return 404 when document not found', async () => {
    modelCache['companyDocument']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request.delete('/api/v1/documents/not-found').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request.delete('/api/v1/documents/doc-1').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.delete('/api/v1/documents/doc-1');
    expect(res.status).toBe(401);
  });
});
