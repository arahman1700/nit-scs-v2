/**
 * Integration tests for stock-allocation routes.
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

vi.mock('../services/stock-allocation.service.js', () => ({
  allocate: vi.fn(),
  release: vi.fn(),
  confirmPick: vi.fn(),
  cancel: vi.fn(),
  getByDemand: vi.fn(),
  getAvailable: vi.fn(),
  getAllocations: vi.fn(),
  bulkAllocate: vi.fn(),
  getStats: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as stockAllocationService from '../services/stock-allocation.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/v1/stock-allocations ────────────────────────────────────────────

describe('GET /api/v1/stock-allocations', () => {
  it('should return 200 with paginated list', async () => {
    vi.mocked(stockAllocationService.getAllocations).mockResolvedValue({
      data: [{ id: 'sa-1' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/stock-allocations').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/stock-allocations');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/stock-allocations/stats ──────────────────────────────────────

describe('GET /api/v1/stock-allocations/stats', () => {
  it('should return 200 with stats', async () => {
    vi.mocked(stockAllocationService.getStats).mockResolvedValue({
      totalAllocatedQty: 100,
      activeCount: 5,
    } as never);

    const res = await request.get('/api/v1/stock-allocations/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/stock-allocations/stats');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/stock-allocations/available ──────────────────────────────────

describe('GET /api/v1/stock-allocations/available', () => {
  it('should return 200 with available stock data', async () => {
    vi.mocked(stockAllocationService.getAvailable).mockResolvedValue({
      warehouseId: 'wh-1',
      itemId: 'item-1',
      totalAllocated: 50,
    } as never);

    const res = await request
      .get('/api/v1/stock-allocations/available?warehouseId=wh-1&itemId=item-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 without warehouseId and itemId', async () => {
    const res = await request.get('/api/v1/stock-allocations/available').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 400 without itemId', async () => {
    const res = await request
      .get('/api/v1/stock-allocations/available?warehouseId=wh-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/stock-allocations/available?warehouseId=wh-1&itemId=item-1');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/stock-allocations ───────────────────────────────────────────

describe('POST /api/v1/stock-allocations', () => {
  const validBody = {
    warehouseId: '00000000-0000-0000-0000-000000000001',
    itemId: '00000000-0000-0000-0000-000000000002',
    qtyAllocated: 10,
    allocType: 'hard',
    demandDocType: 'MI',
    demandDocId: '00000000-0000-0000-0000-000000000003',
  };

  it('should return 201 on successful allocation', async () => {
    vi.mocked(stockAllocationService.allocate).mockResolvedValue({ id: 'sa-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/stock-allocations')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with invalid body (missing required fields)', async () => {
    const res = await request
      .post('/api/v1/stock-allocations')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('should return 400 with invalid allocType', async () => {
    const res = await request
      .post('/api/v1/stock-allocations')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ ...validBody, allocType: 'invalid_type' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/stock-allocations').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/stock-allocations/:id/release ──────────────────────────────

describe('PATCH /api/v1/stock-allocations/:id/release', () => {
  it('should return 200 on successful release', async () => {
    vi.mocked(stockAllocationService.release).mockResolvedValue({
      id: 'sa-1',
      status: 'released',
    } as never);

    const res = await request
      .patch('/api/v1/stock-allocations/sa-1/release')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/stock-allocations/sa-1/release');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/stock-allocations/:id/pick ─────────────────────────────────

describe('PATCH /api/v1/stock-allocations/:id/pick', () => {
  it('should return 200 on successful confirm pick', async () => {
    vi.mocked(stockAllocationService.confirmPick).mockResolvedValue({
      id: 'sa-1',
      status: 'picked',
    } as never);

    const res = await request
      .patch('/api/v1/stock-allocations/sa-1/pick')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/stock-allocations/sa-1/pick');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/stock-allocations/:id/cancel ───────────────────────────────

describe('PATCH /api/v1/stock-allocations/:id/cancel', () => {
  it('should return 200 on successful cancel', async () => {
    vi.mocked(stockAllocationService.cancel).mockResolvedValue({
      id: 'sa-1',
      status: 'cancelled',
    } as never);

    const res = await request
      .patch('/api/v1/stock-allocations/sa-1/cancel')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/stock-allocations/sa-1/cancel');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/stock-allocations/bulk ──────────────────────────────────────

describe('POST /api/v1/stock-allocations/bulk', () => {
  const validBody = {
    demandDocType: 'MI',
    demandDocId: '00000000-0000-0000-0000-000000000003',
    lines: [{ itemId: '00000000-0000-0000-0000-000000000002', qty: 5 }],
  };

  it('should return 201 on successful bulk allocation', async () => {
    vi.mocked(stockAllocationService.bulkAllocate).mockResolvedValue([{ id: 'sa-1' }] as never);

    const res = await request
      .post('/api/v1/stock-allocations/bulk')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with empty lines array', async () => {
    const res = await request
      .post('/api/v1/stock-allocations/bulk')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ ...validBody, lines: [] });

    expect(res.status).toBe(400);
  });

  it('should return 400 with missing demandDocType', async () => {
    const res = await request
      .post('/api/v1/stock-allocations/bulk')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        demandDocId: '00000000-0000-0000-0000-000000000003',
        lines: [{ itemId: '00000000-0000-0000-0000-000000000002', qty: 5 }],
      });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/stock-allocations/bulk').send(validBody);
    expect(res.status).toBe(401);
  });
});
