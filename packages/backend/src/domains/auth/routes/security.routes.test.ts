/**
 * Integration tests for security routes.
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

vi.mock('../services/security.service.js', () => ({
  getSecurityDashboard: vi.fn(),
  getLoginHistory: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import { getSecurityDashboard, getLoginHistory } from '../services/security.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const MANAGER_TOKEN = signTestToken({ userId: 'mgr-1', systemRole: 'manager' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/security/dashboard', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(getSecurityDashboard).mockResolvedValue({ totalLogins: 100, failedAttempts: 5 } as never);

    const res = await request.get('/api/v1/security/dashboard').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for manager', async () => {
    vi.mocked(getSecurityDashboard).mockResolvedValue({ totalLogins: 50 } as never);

    const res = await request.get('/api/v1/security/dashboard').set('Authorization', `Bearer ${MANAGER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/security/dashboard').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/security/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/security/login-history/:employeeId', () => {
  it('should return 200 for admin viewing any employee', async () => {
    vi.mocked(getLoginHistory).mockResolvedValue({
      data: [{ id: 'log-1', action: 'login' }],
      total: 1,
    } as never);

    const res = await request
      .get('/api/v1/security/login-history/emp-123')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(getLoginHistory).toHaveBeenCalledWith('emp-123', { page: 1, pageSize: 20 });
  });

  it('should allow user to view own history', async () => {
    vi.mocked(getLoginHistory).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request
      .get('/api/v1/security/login-history/staff-1')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for non-admin viewing other employee', async () => {
    const res = await request
      .get('/api/v1/security/login-history/other-user')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it('should pass pagination params', async () => {
    vi.mocked(getLoginHistory).mockResolvedValue({ data: [], total: 0 } as never);

    await request
      .get('/api/v1/security/login-history/emp-1?page=3&pageSize=50')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(getLoginHistory).toHaveBeenCalledWith('emp-1', { page: 3, pageSize: 50 });
  });
});
