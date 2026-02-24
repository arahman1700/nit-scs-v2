/**
 * Integration tests for cross-dock routes.
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

vi.mock('../services/cross-dock.service.js', () => ({
  identifyOpportunities: vi.fn(),
  createCrossDock: vi.fn(),
  getCrossDocks: vi.fn(),
  getCrossDockById: vi.fn(),
  approveCrossDock: vi.fn(),
  executeCrossDock: vi.fn(),
  completeCrossDock: vi.fn(),
  cancelCrossDock: vi.fn(),
  getStats: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as crossDockService from '../services/cross-dock.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const WH_SUP_TOKEN = signTestToken({ userId: 'sup-1', systemRole: 'warehouse_supervisor' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/cross-docks/opportunities', () => {
  it('should return 200 with opportunities', async () => {
    vi.mocked(crossDockService.identifyOpportunities).mockResolvedValue([{ id: 'opp-1' }] as never);

    const res = await request
      .get('/api/v1/cross-docks/opportunities?warehouseId=wh-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 without warehouseId', async () => {
    const res = await request.get('/api/v1/cross-docks/opportunities').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/cross-docks/opportunities?warehouseId=wh-1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/cross-docks/stats', () => {
  it('should return 200 with stats', async () => {
    vi.mocked(crossDockService.getStats).mockResolvedValue({ total: 10, completed: 5 } as never);

    const res = await request.get('/api/v1/cross-docks/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/cross-docks', () => {
  it('should return 200 with list', async () => {
    vi.mocked(crossDockService.getCrossDocks).mockResolvedValue({
      data: [{ id: 'cd-1' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/cross-docks').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/cross-docks');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/cross-docks/:id', () => {
  it('should return 200 with detail', async () => {
    vi.mocked(crossDockService.getCrossDockById).mockResolvedValue({ id: 'cd-1', status: 'pending' } as never);

    const res = await request.get('/api/v1/cross-docks/cd-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/cross-docks', () => {
  it('should return 201 for admin', async () => {
    vi.mocked(crossDockService.createCrossDock).mockResolvedValue({ id: 'cd-1' } as never);

    const res = await request
      .post('/api/v1/cross-docks')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', itemId: 'item-1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request
      .post('/api/v1/cross-docks')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ warehouseId: 'wh-1' });

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/cross-docks').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/cross-docks/:id/approve', () => {
  it('should return 200 for warehouse supervisor', async () => {
    vi.mocked(crossDockService.approveCrossDock).mockResolvedValue({ id: 'cd-1', status: 'approved' } as never);

    const res = await request.post('/api/v1/cross-docks/cd-1/approve').set('Authorization', `Bearer ${WH_SUP_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.post('/api/v1/cross-docks/cd-1/approve').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/cross-docks/:id/cancel', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(crossDockService.cancelCrossDock).mockResolvedValue({ id: 'cd-1', status: 'cancelled' } as never);

    const res = await request.post('/api/v1/cross-docks/cd-1/cancel').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
