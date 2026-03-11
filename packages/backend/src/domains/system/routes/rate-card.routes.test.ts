/**
 * Integration tests for rate card routes.
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
        // CRUD factory calls Prisma delegate directly; return object with id for create/update
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue({ id: 'mock-id' }) });
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

vi.mock('../services/rate-card.service.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getActiveRateForEquipment: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as rateCardService from '../services/rate-card.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const FINANCE_TOKEN = signTestToken({ userId: 'fin-1', systemRole: 'finance_user' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/rate-cards', () => {
  it('should return 200 with rate card list', async () => {
    vi.mocked(rateCardService.list).mockResolvedValue({ data: [{ id: 'rc-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/rate-cards').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow finance_user', async () => {
    vi.mocked(rateCardService.list).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request.get('/api/v1/rate-cards').set('Authorization', `Bearer ${FINANCE_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 200 for all authenticated roles (permission-based)', async () => {
    // CRUD factory uses requirePermission (mocked to true), so all roles pass
    vi.mocked(rateCardService.list).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request.get('/api/v1/rate-cards').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/rate-cards');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/rate-cards/lookup', () => {
  it('should return 200 with matching rate card', async () => {
    vi.mocked(rateCardService.getActiveRateForEquipment).mockResolvedValue({
      id: 'rc-1',
      dailyRate: 500,
    } as never);

    const res = await request
      .get('/api/v1/rate-cards/lookup?supplierId=sup-1&equipmentTypeId=et-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/rate-cards', () => {
  const validBody = {
    supplierId: '00000000-0000-0000-0000-000000000001',
    equipmentTypeId: '00000000-0000-0000-0000-000000000002',
    dailyRate: 500,
    weeklyRate: 3000,
    monthlyRate: 10000,
    validFrom: '2026-01-01T00:00:00Z',
  };

  it('should return 201 on create', async () => {
    vi.mocked(rateCardService.create).mockResolvedValue({ id: 'rc-1', ...validBody } as never);

    const res = await request.post('/api/v1/rate-cards').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
  });
});
