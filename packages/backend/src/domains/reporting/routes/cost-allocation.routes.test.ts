/**
 * Integration tests for cost allocation routes.
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
  hasPermissionDB: vi.fn().mockImplementation((role: string, resource: string, action: string) => {
    // warehouse_staff has no 'reports' permission
    if (role === 'warehouse_staff' && resource === 'reports') return Promise.resolve(false);
    return Promise.resolve(true);
  }),
}));

vi.mock('../services/cost-allocation.service.js', () => ({
  getCostAllocation: vi.fn(),
  getCostAllocationSummary: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import { getCostAllocation, getCostAllocationSummary } from '../services/cost-allocation.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const FINANCE_TOKEN = signTestToken({ userId: 'fin-1', systemRole: 'finance_user' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/cost-allocation/summary', () => {
  it('should return 200 with summary', async () => {
    vi.mocked(getCostAllocationSummary).mockResolvedValue([{ projectId: 'p-1', totalCost: 50000 }] as never);

    const res = await request.get('/api/v1/cost-allocation/summary').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow finance_user', async () => {
    vi.mocked(getCostAllocationSummary).mockResolvedValue([] as never);

    const res = await request.get('/api/v1/cost-allocation/summary').set('Authorization', `Bearer ${FINANCE_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/cost-allocation/summary').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/cost-allocation/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/cost-allocation/:projectId', () => {
  it('should return 200 with project breakdown', async () => {
    vi.mocked(getCostAllocation).mockResolvedValue({
      projectId: 'p-1',
      categories: [],
      total: 25000,
    } as never);

    const res = await request.get('/api/v1/cost-allocation/p-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(getCostAllocation).toHaveBeenCalledWith('p-1', undefined, undefined);
  });

  it('should pass date filter params', async () => {
    vi.mocked(getCostAllocation).mockResolvedValue({} as never);

    await request
      .get('/api/v1/cost-allocation/p-1?dateFrom=2026-01-01&dateTo=2026-03-31')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(getCostAllocation).toHaveBeenCalledWith('p-1', expect.any(Date), expect.any(Date));
  });
});
