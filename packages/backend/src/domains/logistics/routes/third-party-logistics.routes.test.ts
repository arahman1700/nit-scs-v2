/**
 * Integration tests for third-party-logistics (3PL) routes.
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

vi.mock('../services/third-party-logistics.service.js', () => ({
  createContract: vi.fn(),
  getContractById: vi.fn(),
  getContracts: vi.fn(),
  activateContract: vi.fn(),
  suspendContract: vi.fn(),
  terminateContract: vi.fn(),
  createCharge: vi.fn(),
  getCharges: vi.fn(),
  approveCharge: vi.fn(),
  invoiceCharge: vi.fn(),
  payCharge: vi.fn(),
  disputeCharge: vi.fn(),
  getContractSummary: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as tplService from '../services/third-party-logistics.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/3pl/contracts', () => {
  it('should return 200 with list', async () => {
    vi.mocked(tplService.getContracts).mockResolvedValue({
      data: [{ id: 'c-1' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/3pl/contracts').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/3pl/contracts');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/3pl/contracts/:id', () => {
  it('should return 200 with contract detail', async () => {
    vi.mocked(tplService.getContractById).mockResolvedValue({ id: 'c-1', status: 'draft' } as never);

    const res = await request.get('/api/v1/3pl/contracts/c-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/3pl/contracts/c-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/3pl/contracts', () => {
  const validContract = {
    contractCode: 'TPL-001',
    supplierId: '00000000-0000-0000-0000-000000000001',
    serviceType: 'warehousing',
    startDate: '2026-01-01',
    rateSchedule: { storage: 10 },
  };

  it('should return 201 for admin', async () => {
    vi.mocked(tplService.createContract).mockResolvedValue({ id: 'c-1' } as never);

    const res = await request
      .post('/api/v1/3pl/contracts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validContract);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 201 for any authenticated role (permission mocked)', async () => {
    vi.mocked(tplService.createContract).mockResolvedValue({ id: 'c-1' } as never);

    const res = await request
      .post('/api/v1/3pl/contracts')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send(validContract);

    expect(res.status).toBe(201);
  });

  it('should return 400 with invalid body', async () => {
    const res = await request
      .post('/api/v1/3pl/contracts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ contractCode: '' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/3pl/contracts').send(validContract);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/3pl/contracts/:id/activate', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(tplService.activateContract).mockResolvedValue({ id: 'c-1', status: 'active' } as never);

    const res = await request.patch('/api/v1/3pl/contracts/c-1/activate').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for any authenticated role (permission mocked)', async () => {
    vi.mocked(tplService.activateContract).mockResolvedValue({ id: 'c-1', status: 'active' } as never);

    const res = await request.patch('/api/v1/3pl/contracts/c-1/activate').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/3pl/contracts/c-1/activate');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/3pl/contracts/:id/terminate', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(tplService.terminateContract).mockResolvedValue({ id: 'c-1', status: 'terminated' } as never);

    const res = await request
      .patch('/api/v1/3pl/contracts/c-1/terminate')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/3pl/contracts/c-1/terminate');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHARGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/3pl/charges', () => {
  it('should return 200 with list', async () => {
    vi.mocked(tplService.getCharges).mockResolvedValue({
      data: [{ id: 'ch-1' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/3pl/charges').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/3pl/charges');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/3pl/charges', () => {
  const validCharge = {
    contractId: '00000000-0000-0000-0000-000000000001',
    chargeType: 'storage',
    quantity: 100,
    unitRate: 5.5,
    totalAmount: 550,
  };

  it('should return 201 for admin', async () => {
    vi.mocked(tplService.createCharge).mockResolvedValue({ id: 'ch-1' } as never);

    const res = await request
      .post('/api/v1/3pl/charges')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validCharge);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 with invalid body', async () => {
    const res = await request
      .post('/api/v1/3pl/charges')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ chargeType: 'invalid_type' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/3pl/charges').send(validCharge);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/3pl/charges/:id/approve', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(tplService.approveCharge).mockResolvedValue({ id: 'ch-1', status: 'approved' } as never);

    const res = await request.patch('/api/v1/3pl/charges/ch-1/approve').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for any authenticated role (permission mocked)', async () => {
    vi.mocked(tplService.approveCharge).mockResolvedValue({ id: 'ch-1', status: 'approved' } as never);

    const res = await request.patch('/api/v1/3pl/charges/ch-1/approve').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/3pl/charges/ch-1/approve');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/3pl/contracts/:id/summary', () => {
  it('should return 200 with summary', async () => {
    vi.mocked(tplService.getContractSummary).mockResolvedValue({
      contractId: 'c-1',
      draft: 100,
      approved: 200,
      invoiced: 50,
      paid: 300,
      disputed: 0,
      totalAmount: 650,
    } as never);

    const res = await request.get('/api/v1/3pl/contracts/c-1/summary').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/3pl/contracts/c-1/summary');
    expect(res.status).toBe(401);
  });
});
