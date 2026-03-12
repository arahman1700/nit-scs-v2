/**
 * Integration tests for carrier routes.
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

vi.mock('../services/carrier.service.js', () => ({
  getCarriers: vi.fn(),
  getCarrierById: vi.fn(),
  createCarrier: vi.fn(),
  updateCarrier: vi.fn(),
  deleteCarrier: vi.fn(),
  findBestRate: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as carrierService from '../services/carrier.service.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/v1/carriers ─────────────────────────────────────────────────────

describe('GET /api/v1/carriers', () => {
  it('should return 200 with carrier list', async () => {
    vi.mocked(carrierService.getCarriers).mockResolvedValue({
      data: [{ id: 'c-1', carrierName: 'FedEx' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/carriers').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should pass filter query params to service', async () => {
    vi.mocked(carrierService.getCarriers).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 25,
    } as never);

    await request
      .get('/api/v1/carriers?mode=air&isActive=true&carrierName=DHL')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(carrierService.getCarriers).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'air',
        isActive: true,
        carrierName: 'DHL',
      }),
    );
  });

  it('should return 500 on service error', async () => {
    vi.mocked(carrierService.getCarriers).mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/v1/carriers').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/carriers/best-rate ───────────────────────────────────────────

describe('GET /api/v1/carriers/best-rate', () => {
  it('should return 200 with best rates', async () => {
    vi.mocked(carrierService.findBestRate).mockResolvedValue([
      { id: 'c-1', carrierName: 'FedEx', ratePerUnit: 5.0 },
    ] as never);

    const res = await request.get('/api/v1/carriers/best-rate?mode=air').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.rates).toHaveLength(1);
  });

  it('should return 400 without mode param', async () => {
    const res = await request.get('/api/v1/carriers/best-rate').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/carriers/:id ─────────────────────────────────────────────────

describe('GET /api/v1/carriers/:id', () => {
  it('should return 200 with carrier detail', async () => {
    vi.mocked(carrierService.getCarrierById).mockResolvedValue({
      id: 'c-1',
      carrierName: 'FedEx',
    } as never);

    const res = await request.get('/api/v1/carriers/c-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('c-1');
  });

  it('should return 404 when carrier not found', async () => {
    vi.mocked(carrierService.getCarrierById).mockRejectedValue(new NotFoundError('CarrierService', 'bad-id'));

    const res = await request.get('/api/v1/carriers/bad-id').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/carriers ────────────────────────────────────────────────────

describe('POST /api/v1/carriers', () => {
  const validBody = {
    carrierName: 'FedEx',
    serviceName: 'Express',
    serviceCode: 'FDX-EXP',
    mode: 'air',
    ratePerUnit: 12.5,
    currency: 'USD',
  };

  it('should return 201 on create', async () => {
    vi.mocked(carrierService.createCarrier).mockResolvedValue({ id: 'c-1', ...validBody } as never);

    const res = await request.post('/api/v1/carriers').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('c-1');
  });

  it('should return 409 on duplicate service code', async () => {
    vi.mocked(carrierService.createCarrier).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );

    const res = await request.post('/api/v1/carriers').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(409);
  });

  it('should return 400 on generic service error', async () => {
    vi.mocked(carrierService.createCarrier).mockRejectedValue(new Error('Validation failed'));

    const res = await request.post('/api/v1/carriers').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(400);
  });
});

// ── PUT /api/v1/carriers/:id ─────────────────────────────────────────────────

describe('PUT /api/v1/carriers/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(carrierService.updateCarrier).mockResolvedValue({
      id: 'c-1',
      carrierName: 'FedEx Updated',
    } as never);

    const res = await request
      .put('/api/v1/carriers/c-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ carrierName: 'FedEx Updated' });

    expect(res.status).toBe(200);
    expect(res.body.carrierName).toBe('FedEx Updated');
  });

  it('should return 404 when carrier not found', async () => {
    vi.mocked(carrierService.updateCarrier).mockRejectedValue(new NotFoundError('CarrierService', 'bad-id'));

    const res = await request
      .put('/api/v1/carriers/bad-id')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ carrierName: 'Test' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/carriers/:id ──────────────────────────────────────────────

describe('DELETE /api/v1/carriers/:id', () => {
  it('should return 204 on successful delete', async () => {
    vi.mocked(carrierService.deleteCarrier).mockResolvedValue(undefined as never);

    const res = await request.delete('/api/v1/carriers/c-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(204);
  });

  it('should return 404 when carrier not found', async () => {
    vi.mocked(carrierService.deleteCarrier).mockRejectedValue(new NotFoundError('CarrierService', 'bad-id'));

    const res = await request.delete('/api/v1/carriers/bad-id').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });
});
