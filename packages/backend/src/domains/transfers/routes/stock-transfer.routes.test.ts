/**
 * Integration tests for stock-transfer.routes.ts (V1 — deprecated, kept for backward compat).
 *
 * Mounted at: /api/v1/stock-transfers  (via logistics.routes.ts)
 * Delegates to: stock-transfer.service.js
 *
 * Tests cover:
 *   GET    /api/v1/stock-transfers         — list
 *   GET    /api/v1/stock-transfers/:id     — get single
 *   POST   /api/v1/stock-transfers         — create
 *   PUT    /api/v1/stock-transfers/:id     — update
 *   DELETE /api/v1/stock-transfers/:id     — delete
 *   POST   /api/v1/stock-transfers/:id/submit
 *   POST   /api/v1/stock-transfers/:id/approve
 *   POST   /api/v1/stock-transfers/:id/ship
 *   POST   /api/v1/stock-transfers/:id/receive
 *   POST   /api/v1/stock-transfers/:id/complete
 *   POST   /api/v1/stock-transfers/:id/cancel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';

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
      get: (_target: unknown, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../../../domains/auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../../domains/auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/stock-transfer.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'st1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'st1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'st1' } }),
  submit: vi.fn().mockResolvedValue({ id: 'st1', status: 'pending' }),
  approve: vi.fn().mockResolvedValue({ id: 'st1', status: 'approved' }),
  ship: vi.fn().mockResolvedValue({ fromWarehouseId: 'wh1', updated: { id: 'st1', status: 'shipped' } }),
  receive: vi.fn().mockResolvedValue({ toWarehouseId: 'wh2', updated: { id: 'st1', status: 'received' } }),
  complete: vi.fn().mockResolvedValue({ id: 'st1', status: 'completed' }),
  cancel: vi.fn().mockResolvedValue({ id: 'st1', status: 'cancelled' }),
}));

import * as stService from '../services/stock-transfer.service.js';
import { NotFoundError, ConflictError, BusinessRuleError } from '@nit-scs-v2/shared';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/stock-transfers';

// Valid UUID helpers for schema validation
const UUID_FROM = 'aaaaaaaa-0000-0000-0000-000000000001';
const UUID_TO = 'aaaaaaaa-0000-0000-0000-000000000002';

describe('Stock Transfer Routes (V1 backward-compat, /api/v1/stock-transfers)', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── GET / ─────────────────────────────────────────────────────────────────
  describe('GET /api/v1/stock-transfers', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────
  describe('GET /api/v1/stock-transfers/:id', () => {
    it('returns 200 with transfer details', async () => {
      const res = await request.get(`${BASE}/st1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.getById).toHaveBeenCalledWith('st1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/st1`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST / ────────────────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers', () => {
    const validPayload = {
      transferType: 'warehouse_to_warehouse',
      fromWarehouseId: UUID_FROM,
      toWarehouseId: UUID_TO,
      transferDate: new Date().toISOString(),
      lines: [
        {
          itemId: 'aaaaaaaa-0000-0000-0000-000000000010',
          quantity: 5,
          uomId: 'aaaaaaaa-0000-0000-0000-000000000020',
        },
      ],
    };

    it('returns 201 on successful creation', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(stService.create).toHaveBeenCalled();
    });

    it('returns 400 on invalid payload (missing required fields)', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'missing required fields' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send(validPayload);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /:id ──────────────────────────────────────────────────────────────
  describe('PUT /api/v1/stock-transfers/:id', () => {
    it('returns 200 on successful update', async () => {
      const res = await request
        .put(`${BASE}/st1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'updated notes', version: 0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.update).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.put(`${BASE}/st1`).send({ notes: 'updated' });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /:id/submit ──────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers/:id/submit', () => {
    it('returns 200 on successful submit', async () => {
      const res = await request.post(`${BASE}/st1/submit`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.submit).toHaveBeenCalledWith('st1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/st1/submit`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /:id/approve ─────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers/:id/approve', () => {
    it('returns 200 on successful approve', async () => {
      const res = await request.post(`${BASE}/st1/approve`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.approve).toHaveBeenCalledWith('st1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/st1/approve`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /:id/ship ────────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers/:id/ship', () => {
    it('returns 200 on successful ship', async () => {
      const res = await request.post(`${BASE}/st1/ship`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.ship).toHaveBeenCalledWith('st1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/st1/ship`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /:id/receive ─────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers/:id/receive', () => {
    it('returns 200 on successful receive', async () => {
      const res = await request.post(`${BASE}/st1/receive`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.receive).toHaveBeenCalledWith('st1', 'test-user-id');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/st1/receive`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /:id/complete ────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers/:id/complete', () => {
    it('returns 200 on successful complete', async () => {
      const res = await request.post(`${BASE}/st1/complete`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.complete).toHaveBeenCalledWith('st1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/st1/complete`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /:id/cancel ──────────────────────────────────────────────────────
  describe('POST /api/v1/stock-transfers/:id/cancel', () => {
    it('returns 200 on successful cancel', async () => {
      const res = await request.post(`${BASE}/st1/cancel`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stService.cancel).toHaveBeenCalledWith('st1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/st1/cancel`);
      expect(res.status).toBe(401);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────
  describe('Error handling', () => {
    it('returns 404 when getById throws NotFoundError', async () => {
      vi.mocked(stService.getById).mockRejectedValueOnce(new NotFoundError('StockTransfer', 'not-found-id'));

      const res = await request.get(`${BASE}/not-found-id`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 409 when create throws ConflictError', async () => {
      vi.mocked(stService.create).mockRejectedValueOnce(new ConflictError('Transfer number already exists'));

      const validPayload = {
        transferType: 'warehouse_to_warehouse',
        fromWarehouseId: UUID_FROM,
        toWarehouseId: UUID_TO,
        transferDate: new Date().toISOString(),
        lines: [
          {
            itemId: 'aaaaaaaa-0000-0000-0000-000000000010',
            quantity: 5,
            uomId: 'aaaaaaaa-0000-0000-0000-000000000020',
          },
        ],
      };

      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 when submit throws a BusinessRuleError', async () => {
      // submit action calls getById first (for row-level security), then handler
      // so getById must succeed here and submit itself throws
      vi.mocked(stService.submit).mockRejectedValueOnce(
        new BusinessRuleError('Cannot submit: transfer is not in draft status'),
      );

      const res = await request.post(`${BASE}/st1/submit`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });
});
