/**
 * Integration tests for expiry alert routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        // Route uses prisma.inventoryLot.findMany — return array, not null
        if (prop === 'inventoryLot') {
          return {
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../../../utils/scope-filter.js', () => ({
  buildScopeFilter: vi.fn().mockReturnValue({}),
  canAccessRecord: vi.fn().mockReturnValue(true),
  applyScopeFilter: vi.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/inventory/expiring', () => {
  it('should return 200 with expiring items', async () => {
    const res = await request.get('/api/v1/inventory/expiring').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should accept daysAhead param', async () => {
    const res = await request
      .get('/api/v1/inventory/expiring?daysAhead=60')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/inventory/expiring');
    expect(res.status).toBe(401);
  });
});
