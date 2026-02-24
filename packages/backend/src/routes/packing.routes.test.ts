import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

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

vi.mock('../services/packing.service.js', () => ({
  getPackingQueue: vi.fn().mockResolvedValue([]),
  getSessionById: vi.fn().mockResolvedValue({ id: 'sess-1', status: 'in_progress' }),
  createSession: vi.fn().mockResolvedValue({ id: 'sess-new', status: 'in_progress' }),
  addPackingLine: vi.fn().mockResolvedValue({ id: 'line-1', itemId: 'item-1' }),
  completeSession: vi.fn().mockResolvedValue({ id: 'sess-1', status: 'completed' }),
  cancelSession: vi.fn().mockResolvedValue({ id: 'sess-1', status: 'cancelled' }),
}));

import * as packingService from '../services/packing.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/packing';

describe('Packing Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/packing', () => {
    it('returns 200 with packing queue', async () => {
      vi.mocked(packingService.getPackingQueue).mockResolvedValue([{ id: 'mi-1' }] as any);

      const res = await request.get(`${BASE}?warehouseId=wh-1`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(packingService.getPackingQueue).toHaveBeenCalledWith('wh-1');
    });

    it('returns 400 when warehouseId missing', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}?warehouseId=wh-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/packing/:id', () => {
    it('returns 200 with session detail', async () => {
      vi.mocked(packingService.getSessionById).mockResolvedValue({ id: 'sess-1' } as any);

      const res = await request.get(`${BASE}/sess-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/sess-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/packing', () => {
    it('returns 201 on create session', async () => {
      vi.mocked(packingService.createSession).mockResolvedValue({ id: 'sess-new' } as any);

      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ mirvId: 'mirv-1', packedById: 'user-1', warehouseId: 'wh-1' });

      expect(res.status).toBe(201);
      expect(packingService.createSession).toHaveBeenCalledWith('mirv-1', 'user-1', 'wh-1');
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${token}`).send({ mirvId: 'mirv-1' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ mirvId: 'mirv-1', packedById: 'user-1', warehouseId: 'wh-1' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/packing/:id/complete', () => {
    it('returns 200 on complete', async () => {
      vi.mocked(packingService.completeSession).mockResolvedValue({ id: 'sess-1', status: 'completed' } as any);

      const res = await request.post(`${BASE}/sess-1/complete`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(packingService.completeSession).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('POST /api/v1/packing/:id/cancel', () => {
    it('returns 200 on cancel', async () => {
      vi.mocked(packingService.cancelSession).mockResolvedValue({ id: 'sess-1', status: 'cancelled' } as any);

      const res = await request.post(`${BASE}/sess-1/cancel`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(packingService.cancelSession).toHaveBeenCalledWith('sess-1');
    });
  });
});
