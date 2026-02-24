/**
 * Integration tests for email-log routes.
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

// Mock permission service — email-log uses requirePermission('email_log', 'read')
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

beforeEach(async () => {
  vi.clearAllMocks();
  if (!modelCache['emailLog']) modelCache['emailLog'] = {};
  // Re-mock permission after clearAllMocks
  const { hasPermissionDB } = await import('../services/permission.service.js');
  vi.mocked(hasPermissionDB).mockResolvedValue(true);
});

describe('GET /api/v1/email-logs', () => {
  it('should return 200 with email logs', async () => {
    modelCache['emailLog']!['findMany'] = vi
      .fn()
      .mockResolvedValue([{ id: 'log-1', toEmail: 'test@example.com', status: 'sent' }]);
    modelCache['emailLog']!['count'] = vi.fn().mockResolvedValue(1);

    const res = await request.get('/api/v1/email-logs').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should support status filter', async () => {
    modelCache['emailLog']!['findMany'] = vi.fn().mockResolvedValue([]);
    modelCache['emailLog']!['count'] = vi.fn().mockResolvedValue(0);

    const res = await request.get('/api/v1/email-logs?status=sent').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/email-logs');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/email-logs/stats', () => {
  it('should return 200 with stats', async () => {
    modelCache['emailLog']!['groupBy'] = vi.fn().mockResolvedValue([
      { status: 'sent', _count: { id: 100 } },
      { status: 'failed', _count: { id: 5 } },
    ]);

    const res = await request.get('/api/v1/email-logs/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/email-logs/stats');
    expect(res.status).toBe(401);
  });
});
