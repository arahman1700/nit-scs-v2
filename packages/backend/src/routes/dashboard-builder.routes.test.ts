/**
 * Integration tests for dashboard-builder routes.
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
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn().mockResolvedValue(null);
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

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure model cache entries exist for direct access
  if (!modelCache['dashboard']) modelCache['dashboard'] = {};
  if (!modelCache['dashboardWidget']) modelCache['dashboardWidget'] = {};
});

describe('GET /api/v1/dashboards', () => {
  it('should return 200 with dashboards', async () => {
    modelCache['dashboard']!['findMany'] = vi.fn().mockResolvedValue([{ id: 'db-1', name: 'My Dashboard' }]);

    const res = await request.get('/api/v1/dashboards').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dashboards');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/dashboards', () => {
  it('should return 201 on success', async () => {
    modelCache['dashboard']!['create'] = vi.fn().mockResolvedValue({ id: 'db-new', name: 'New Dashboard' });

    const res = await request
      .post('/api/v1/dashboards')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'New Dashboard' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when name is missing', async () => {
    const res = await request.post('/api/v1/dashboards').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({});

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/dashboards').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboards/:id', () => {
  it('should return 200 with dashboard and widgets', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue({
      id: 'db-1',
      name: 'My Dashboard',
      widgets: [],
      owner: { fullName: 'Admin' },
    });

    const res = await request.get('/api/v1/dashboards/db-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when not found', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request.get('/api/v1/dashboards/not-found').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/dashboards/:id', () => {
  it('should return 200 when owner edits', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'db-1', ownerId: 'test-user-id' });
    modelCache['dashboard']!['update'] = vi.fn().mockResolvedValue({ id: 'db-1', name: 'Updated' });

    const res = await request
      .put('/api/v1/dashboards/db-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when not found', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request
      .put('/api/v1/dashboards/not-found')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('should return 403 when non-admin non-owner edits', async () => {
    const userToken = signTestToken({ userId: 'other-user', systemRole: 'site_engineer' });
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'db-1', ownerId: 'test-user-id' });

    const res = await request
      .put('/api/v1/dashboards/db-1')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/dashboards/:id', () => {
  it('should return 204 for owner', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'db-1', ownerId: 'test-user-id' });
    modelCache['dashboard']!['delete'] = vi.fn().mockResolvedValue({});

    const res = await request.delete('/api/v1/dashboards/db-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(204);
  });

  it('should return 404 when not found', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request.delete('/api/v1/dashboards/not-found').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/dashboards/:id/widgets', () => {
  it('should return 201 on adding widget', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'db-1' });
    if (!modelCache['dashboardWidget']) modelCache['dashboardWidget'] = {};
    modelCache['dashboardWidget']!['create'] = vi.fn().mockResolvedValue({ id: 'w-1', widgetType: 'kpi' });

    const res = await request
      .post('/api/v1/dashboards/db-1/widgets')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ widgetType: 'kpi', title: 'KPI Widget', dataSource: 'inventory' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when missing required fields', async () => {
    const res = await request
      .post('/api/v1/dashboards/db-1/widgets')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ widgetType: 'kpi' });

    expect(res.status).toBe(400);
  });

  it('should return 404 when dashboard not found', async () => {
    modelCache['dashboard']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request
      .post('/api/v1/dashboards/not-found/widgets')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ widgetType: 'kpi', title: 'Test', dataSource: 'test' });

    expect(res.status).toBe(404);
  });
});
