/**
 * Integration tests for bin location routes.
 */

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
        // CRUD factory calls Prisma delegate directly; return object with id for create/update
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue({ id: 'mock-id' }) });
      },
    },
  ),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../system/services/audit.service.js', () => ({
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

describe('GET /api/v1/bin-locations', () => {
  it('should return 200 with bin location list', async () => {
    const res = await request.get('/api/v1/bin-locations').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/bin-locations');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/bin-locations', () => {
  it('should return 201 on create', async () => {
    const res = await request.post('/api/v1/bin-locations').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({
      locationCode: 'A01-R01-S01-B01',
      zoneId: '00000000-0000-0000-0000-000000000001',
      aisle: 'A01',
      rack: 'R01',
      shelf: 'S01',
      bin: 'B01',
    });

    // CRUD factory uses Prisma directly, so mock return determines status
    expect([200, 201]).toContain(res.status);
  });
});
