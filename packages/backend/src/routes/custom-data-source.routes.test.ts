/**
 * Integration tests for custom-data-source routes.
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

// Mock permission service to allow admin through requirePermission
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
  getAllPermissions: vi.fn().mockResolvedValue({}),
  getPermissionsForRole: vi.fn().mockResolvedValue({}),
  invalidatePermissionCache: vi.fn(),
}));

vi.mock('../services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/custom-data-source.service.js', () => ({
  listCustomDataSources: vi.fn(),
  getCustomDataSource: vi.fn(),
  createCustomDataSource: vi.fn(),
  updateCustomDataSource: vi.fn(),
  deleteCustomDataSource: vi.fn(),
  executeCustomDataSource: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as cdsService from '../services/custom-data-source.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/custom-data-sources', () => {
  it('should return 200 with data sources', async () => {
    vi.mocked(cdsService.listCustomDataSources).mockResolvedValue([{ id: 'ds-1', name: 'Test' }] as never);

    const res = await request.get('/api/v1/custom-data-sources').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cdsService.listCustomDataSources).toHaveBeenCalledWith('test-user-id');
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/custom-data-sources');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/custom-data-sources/:id', () => {
  it('should return 200 when source accessible', async () => {
    vi.mocked(cdsService.getCustomDataSource).mockResolvedValue({
      id: 'ds-1',
      name: 'Test',
      isPublic: true,
      createdById: 'other-user',
    } as never);

    const res = await request.get('/api/v1/custom-data-sources/ds-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 when source not accessible', async () => {
    const nonAdminToken = signTestToken({ userId: 'user-2', systemRole: 'site_engineer' });
    vi.mocked(cdsService.getCustomDataSource).mockResolvedValue({
      id: 'ds-1',
      name: 'Private',
      isPublic: false,
      createdById: 'other-user',
    } as never);

    const res = await request.get('/api/v1/custom-data-sources/ds-1').set('Authorization', `Bearer ${nonAdminToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/custom-data-sources/ds-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/custom-data-sources', () => {
  it('should return 201 on success', async () => {
    vi.mocked(cdsService.createCustomDataSource).mockResolvedValue({ id: 'ds-new', name: 'New' } as never);

    const res = await request
      .post('/api/v1/custom-data-sources')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'New', entityType: 'mrrv', aggregation: 'count' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/custom-data-sources').send({ name: 'New' });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/custom-data-sources/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(cdsService.updateCustomDataSource).mockResolvedValue({ id: 'ds-1', name: 'Updated' } as never);

    const res = await request
      .put('/api/v1/custom-data-sources/ds-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /api/v1/custom-data-sources/:id', () => {
  it('should return 200 on delete', async () => {
    vi.mocked(cdsService.deleteCustomDataSource).mockResolvedValue(undefined as never);

    const res = await request.delete('/api/v1/custom-data-sources/ds-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.delete('/api/v1/custom-data-sources/ds-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/custom-data-sources/:id/test', () => {
  it('should return 200 with test results', async () => {
    vi.mocked(cdsService.getCustomDataSource).mockResolvedValue({ id: 'ds-1', entityType: 'mrrv' } as never);
    vi.mocked(cdsService.executeCustomDataSource).mockResolvedValue({ value: 42 } as never);

    const res = await request
      .post('/api/v1/custom-data-sources/ds-1/test')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.value).toBe(42);
  });
});
