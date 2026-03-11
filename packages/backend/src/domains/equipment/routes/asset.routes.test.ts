/**
 * Integration tests for asset routes.
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
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
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
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/asset.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transfer: vi.fn(),
  retire: vi.fn(),
  dispose: vi.fn(),
  getAssetSummary: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as assetService from '../services/asset.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const FINANCE_TOKEN = signTestToken({ userId: 'fin-1', systemRole: 'finance_user' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/assets/summary', () => {
  it('should return 200 with summary', async () => {
    vi.mocked(assetService.getAssetSummary).mockResolvedValue({
      totalAssets: 150,
      totalValue: 500000,
    } as never);

    const res = await request.get('/api/v1/assets/summary').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/assets/summary').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/assets', () => {
  it('should return 200 with asset list', async () => {
    vi.mocked(assetService.list).mockResolvedValue({ data: [{ id: 'a-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/assets').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should allow finance_user', async () => {
    vi.mocked(assetService.list).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request.get('/api/v1/assets').set('Authorization', `Bearer ${FINANCE_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/assets');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/assets', () => {
  const validBody = {
    description: 'Forklift CAT 320',
    category: 'equipment',
    serialNumber: 'FK-001',
  };

  it('should return 201 on create', async () => {
    vi.mocked(assetService.create).mockResolvedValue({ id: 'a-1', ...validBody } as never);

    const res = await request.post('/api/v1/assets').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/assets/:id/transfer', () => {
  it('should return 200 on transfer', async () => {
    vi.mocked(assetService.transfer).mockResolvedValue({ id: 'a-1' } as never);

    const res = await request
      .post('/api/v1/assets/a-1/transfer')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ toWarehouseId: '00000000-0000-0000-0000-000000000002', reason: 'Relocation' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/assets/:id/retire', () => {
  it('should return 200 on retire', async () => {
    vi.mocked(assetService.retire).mockResolvedValue({ id: 'a-1', status: 'retired' } as never);

    const res = await request.post('/api/v1/assets/a-1/retire').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for non-approve role', async () => {
    const res = await request.post('/api/v1/assets/a-1/retire').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/assets/:id/dispose', () => {
  it('should return 200 on dispose', async () => {
    vi.mocked(assetService.dispose).mockResolvedValue({ id: 'a-1', status: 'disposed' } as never);

    const res = await request
      .post('/api/v1/assets/a-1/dispose')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ disposalValue: 5000 });

    expect(res.status).toBe(200);
  });
});
