/**
 * Integration tests for bin-card routes (CRUD factory-based).
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
vi.mock('../services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

// Mock permission service to allow admin through
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
  getAllPermissions: vi.fn().mockResolvedValue({}),
  getPermissionsForRole: vi.fn().mockResolvedValue({}),
  invalidatePermissionCache: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
  if (!modelCache['binCard']) modelCache['binCard'] = {};
});

describe('GET /api/v1/bin-cards', () => {
  it('should return 200 for admin (CRUD factory list)', async () => {
    modelCache['binCard']!['findMany'] = vi.fn().mockResolvedValue([]);
    modelCache['binCard']!['count'] = vi.fn().mockResolvedValue(0);

    const res = await request.get('/api/v1/bin-cards').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/bin-cards');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/bin-cards/:id', () => {
  it('should return 200 when bin card found', async () => {
    modelCache['binCard']!['findUnique'] = vi.fn().mockResolvedValue({
      id: 'bc-1',
      binNumber: 'A-01-01',
      warehouseId: 'wh-1',
    });

    const res = await request.get('/api/v1/bin-cards/bc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when not found', async () => {
    modelCache['binCard']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request.get('/api/v1/bin-cards/not-found').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/bin-cards/bc-1');
    expect(res.status).toBe(401);
  });
});
