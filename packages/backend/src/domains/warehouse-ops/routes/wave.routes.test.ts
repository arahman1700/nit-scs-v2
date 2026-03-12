/**
 * Integration tests for wave picking routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../../../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
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
vi.mock('../../../utils/scope-filter.js', () => ({
  buildScopeFilter: vi.fn().mockReturnValue({}),
  canAccessRecord: vi.fn().mockReturnValue(true),
  resolveWarehouseScope: vi.fn().mockReturnValue(undefined),
  applyScopeFilter: vi.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../audit/services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/wave.service.js', () => ({
  createWave: vi.fn(),
  getWaveById: vi.fn(),
  getWaves: vi.fn(),
  addLines: vi.fn(),
  confirmPick: vi.fn(),
  release: vi.fn(),
  startPicking: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  getStats: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as waveService from '../services/wave.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/v1/waves ──────────────────────────────────────────────────────
describe('GET /api/v1/waves', () => {
  it('should return 200 with list', async () => {
    vi.mocked(waveService.getWaves).mockResolvedValue({
      data: [{ id: 'wave-1' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/waves').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/waves');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/waves/stats ────────────────────────────────────────────────
describe('GET /api/v1/waves/stats', () => {
  it('should return 200 with stats', async () => {
    vi.mocked(waveService.getStats).mockResolvedValue({
      planning: 2,
      released: 1,
      picking: 3,
      completed: 8,
      cancelled: 0,
    } as never);

    const res = await request.get('/api/v1/waves/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/waves/stats');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/waves/:id ──────────────────────────────────────────────────
describe('GET /api/v1/waves/:id', () => {
  it('should return 200 with detail', async () => {
    vi.mocked(waveService.getWaveById).mockResolvedValue({ id: 'wave-1', status: 'planning' } as never);

    const res = await request.get('/api/v1/waves/wave-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/waves/wave-1');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/waves ─────────────────────────────────────────────────────
describe('POST /api/v1/waves', () => {
  const validBody = {
    waveNumber: 'WAVE-001',
    warehouseId: '00000000-0000-0000-0000-000000000001',
  };

  it('should return 201 for admin', async () => {
    vi.mocked(waveService.createWave).mockResolvedValue({ id: 'wave-1' } as never);

    const res = await request.post('/api/v1/waves').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with invalid body', async () => {
    const res = await request
      .post('/api/v1/waves')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ waveNumber: '' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/waves').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/waves/:id/lines ───────────────────────────────────────────
describe('POST /api/v1/waves/:id/lines', () => {
  const validBody = {
    lines: [
      {
        mirvId: '00000000-0000-0000-0000-000000000002',
        itemId: '00000000-0000-0000-0000-000000000003',
        qtyRequired: 10,
      },
    ],
  };

  it('should return 201 on add lines', async () => {
    vi.mocked(waveService.addLines).mockResolvedValue({ count: 1 } as never);

    const res = await request
      .post('/api/v1/waves/wave-1/lines')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with empty lines', async () => {
    const res = await request
      .post('/api/v1/waves/wave-1/lines')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ lines: [] });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/waves/wave-1/lines').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/waves/:id/release ────────────────────────────────────────
describe('PATCH /api/v1/waves/:id/release', () => {
  it('should return 200 on release', async () => {
    vi.mocked(waveService.release).mockResolvedValue({ id: 'wave-1', status: 'released' } as never);

    const res = await request.patch('/api/v1/waves/wave-1/release').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/waves/wave-1/release');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/waves/:id/start ──────────────────────────────────────────
describe('PATCH /api/v1/waves/:id/start', () => {
  it('should return 200 on start picking', async () => {
    vi.mocked(waveService.startPicking).mockResolvedValue({ id: 'wave-1', status: 'picking' } as never);

    const res = await request.patch('/api/v1/waves/wave-1/start').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/waves/wave-1/start');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/waves/:id/complete ───────────────────────────────────────
describe('PATCH /api/v1/waves/:id/complete', () => {
  it('should return 200 on complete', async () => {
    vi.mocked(waveService.complete).mockResolvedValue({ id: 'wave-1', status: 'completed' } as never);

    const res = await request.patch('/api/v1/waves/wave-1/complete').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/waves/wave-1/complete');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/waves/:id/cancel ─────────────────────────────────────────
describe('PATCH /api/v1/waves/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(waveService.cancel).mockResolvedValue({ id: 'wave-1', status: 'cancelled' } as never);

    const res = await request.patch('/api/v1/waves/wave-1/cancel').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/waves/wave-1/cancel');
    expect(res.status).toBe(401);
  });
});
