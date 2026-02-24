/**
 * Integration tests for DR (Discrepancy Report) routes.
 * DR uses createDocumentRouter factory with resource-based RBAC.
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

// Mock permission service — document-factory uses requirePermission when resource is set
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
  getAllPermissions: vi.fn().mockResolvedValue({}),
  getPermissionsForRole: vi.fn().mockResolvedValue({}),
  invalidatePermissionCache: vi.fn(),
}));

vi.mock('../services/dr.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  sendClaim: vi.fn(),
  resolve: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as drService from '../services/dr.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/dr', () => {
  it('should return 200 with DR list', async () => {
    vi.mocked(drService.list).mockResolvedValue({ data: [{ id: 'dr-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/dr').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dr');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dr/:id', () => {
  it('should return 200 with DR detail', async () => {
    vi.mocked(drService.getById).mockResolvedValue({ id: 'dr-1', status: 'draft' } as never);

    const res = await request.get('/api/v1/dr/dr-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dr/dr-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/dr/:id/send-claim', () => {
  it('should return 200 on success', async () => {
    vi.mocked(drService.sendClaim).mockResolvedValue({ id: 'dr-1', status: 'claim_sent' } as never);

    const res = await request
      .post('/api/v1/dr/dr-1/send-claim')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ claimReference: 'CLM-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/dr/dr-1/send-claim').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/dr/:id/resolve', () => {
  it('should return 200 on success', async () => {
    vi.mocked(drService.resolve).mockResolvedValue({ id: 'dr-1', status: 'resolved' } as never);

    const res = await request
      .post('/api/v1/dr/dr-1/resolve')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ resolutionType: 'credit', resolutionAmount: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/dr/dr-1/resolve').send({});
    expect(res.status).toBe(401);
  });
});
