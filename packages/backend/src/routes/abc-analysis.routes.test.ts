/**
 * Integration tests for ABC Analysis routes.
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

vi.mock('../services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/abc-analysis.service.js', () => ({
  calculateABCClassification: vi.fn(),
  applyABCClassification: vi.fn(),
  getABCSummary: vi.fn(),
  getABCItems: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as abcService from '../services/abc-analysis.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/abc-analysis', () => {
  it('should return 200 with items', async () => {
    vi.mocked(abcService.getABCItems).mockResolvedValue({ items: [{ id: '1', abcClass: 'A' }], total: 1 });

    const res = await request.get('/api/v1/abc-analysis').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(abcService.getABCItems).toHaveBeenCalled();
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/abc-analysis');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/abc-analysis/summary', () => {
  it('should return 200 with summary', async () => {
    vi.mocked(abcService.getABCSummary).mockResolvedValue({ classA: 10, classB: 20, classC: 70 });

    const res = await request.get('/api/v1/abc-analysis/summary').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.classA).toBe(10);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/abc-analysis/summary');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/abc-analysis/recalculate', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(abcService.calculateABCClassification).mockResolvedValue([
      { itemId: '1', abcClass: 'A' },
      { itemId: '2', abcClass: 'B' },
    ] as never);
    vi.mocked(abcService.applyABCClassification).mockResolvedValue(undefined as never);

    const res = await request
      .post('/api/v1/abc-analysis/recalculate')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/recalculated/i);
  });

  it('should return 403 for non-admin/non-manager', async () => {
    const res = await request
      .post('/api/v1/abc-analysis/recalculate')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/abc-analysis/recalculate').send({});
    expect(res.status).toBe(401);
  });
});
