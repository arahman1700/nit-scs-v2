/**
 * Integration tests for cycle-count routes.
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

vi.mock('../services/cycle-count.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  createCycleCount: vi.fn(),
  generateCountLines: vi.fn(),
  startCount: vi.fn(),
  recordCount: vi.fn(),
  completeCount: vi.fn(),
  applyAdjustments: vi.fn(),
  cancelCount: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as ccService from '../services/cycle-count.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const WH_TOKEN = signTestToken({ userId: 'wh-1', systemRole: 'warehouse_supervisor' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/cycle-counts', () => {
  it('should return 200 with list', async () => {
    vi.mocked(ccService.list).mockResolvedValue({ data: [{ id: 'cc-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/cycle-counts').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/cycle-counts').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/cycle-counts');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/cycle-counts/:id', () => {
  it('should return 200 with detail', async () => {
    vi.mocked(ccService.getById).mockResolvedValue({ id: 'cc-1', status: 'draft' } as never);

    const res = await request.get('/api/v1/cycle-counts/cc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/cycle-counts', () => {
  it('should return 201 on success', async () => {
    vi.mocked(ccService.createCycleCount).mockResolvedValue({ id: 'cc-new' } as never);

    const res = await request
      .post('/api/v1/cycle-counts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ countType: 'full', warehouseId: 'wh-1', scheduledDate: '2026-03-01' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when missing required fields', async () => {
    const res = await request
      .post('/api/v1/cycle-counts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ countType: 'full' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid countType', async () => {
    const res = await request
      .post('/api/v1/cycle-counts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ countType: 'invalid', warehouseId: 'wh-1', scheduledDate: '2026-03-01' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/cycle-counts').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/cycle-counts/:id/start', () => {
  it('should return 200 on success', async () => {
    vi.mocked(ccService.startCount).mockResolvedValue({ id: 'cc-1', status: 'in_progress' } as never);

    const res = await request.post('/api/v1/cycle-counts/cc-1/start').set('Authorization', `Bearer ${WH_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/cycle-counts/:id/lines/:lineId/count', () => {
  it('should return 200 on success', async () => {
    vi.mocked(ccService.recordCount).mockResolvedValue({ id: 'line-1', countedQty: 50 } as never);

    const res = await request
      .post('/api/v1/cycle-counts/cc-1/lines/line-1/count')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ countedQty: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when countedQty missing', async () => {
    const res = await request
      .post('/api/v1/cycle-counts/cc-1/lines/line-1/count')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/cycle-counts/:id/apply-adjustments', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(ccService.applyAdjustments).mockResolvedValue({ adjusted: 3 } as never);

    const res = await request
      .post('/api/v1/cycle-counts/cc-1/apply-adjustments')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for warehouse staff', async () => {
    const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

    const res = await request
      .post('/api/v1/cycle-counts/cc-1/apply-adjustments')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/cycle-counts/:id', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(ccService.cancelCount).mockResolvedValue({ id: 'cc-1', status: 'cancelled' } as never);

    const res = await request.delete('/api/v1/cycle-counts/cc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.delete('/api/v1/cycle-counts/cc-1');
    expect(res.status).toBe(401);
  });
});
