/**
 * Integration tests for health check routes.
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
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/health', () => {
  it('should return 200 with public health status', async () => {
    const res = await request.get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should not require authentication', async () => {
    const res = await request.get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/health/details', () => {
  it('should return detailed info for admin', async () => {
    const res = await request.get('/api/v1/health/details').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('should return limited info for non-admin', async () => {
    const res = await request.get('/api/v1/health/details').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(200);
    // Non-admin gets public response (no components/memory)
    expect(res.body).toHaveProperty('status');
    expect(res.body).not.toHaveProperty('components');
  });
});

describe('GET /api/v1/live', () => {
  it('should return 200 with alive status', async () => {
    const res = await request.get('/api/v1/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should not require authentication', async () => {
    const res = await request.get('/api/v1/live');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/ready', () => {
  it('should return 200 when database is reachable', async () => {
    const res = await request.get('/api/v1/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should not require authentication', async () => {
    const res = await request.get('/api/v1/ready');
    expect(res.status).toBe(200);
  });
});
