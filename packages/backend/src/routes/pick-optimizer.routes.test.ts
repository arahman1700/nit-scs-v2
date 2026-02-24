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

vi.mock('../services/pick-optimizer.service.js', () => ({
  optimizePickPath: vi.fn().mockResolvedValue({ stops: [], totalDistance: 0 }),
  parseBinLocation: vi.fn(),
  manhattanDistance: vi.fn(),
}));

vi.mock('../services/wave-picking.service.js', () => ({
  createWave: vi.fn().mockResolvedValue({ id: 'wave-1', status: 'pending' }),
  getWaves: vi.fn().mockReturnValue([]),
  getWave: vi.fn().mockReturnValue({ id: 'wave-1', status: 'pending' }),
  getWavePickList: vi.fn().mockResolvedValue({ stops: [] }),
  startPicking: vi.fn().mockReturnValue({ id: 'wave-1', status: 'picking' }),
  completeWave: vi.fn().mockReturnValue({ id: 'wave-1', status: 'completed' }),
}));

import { optimizePickPath } from '../services/pick-optimizer.service.js';
import * as waveService from '../services/wave-picking.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/pick-optimizer';

describe('Pick Optimizer Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/pick-optimizer/path', () => {
    it('returns 200 with optimized path', async () => {
      vi.mocked(optimizePickPath).mockResolvedValue({ stops: [], totalDistance: 10 } as any);
      const items = JSON.stringify([{ itemId: 'item-1', quantity: 5 }]);

      const res = await request
        .get(`${BASE}/path?warehouseId=wh-1&items=${encodeURIComponent(items)}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(optimizePickPath).toHaveBeenCalledWith('wh-1', [{ itemId: 'item-1', quantity: 5 }]);
    });

    it('returns 400 when warehouseId or items missing', async () => {
      const res = await request.get(`${BASE}/path`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid JSON items', async () => {
      const res = await request
        .get(`${BASE}/path?warehouseId=wh-1&items=not-json`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/path?warehouseId=wh-1&items=[]`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for unauthorized role', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-1', systemRole: 'viewer' });

      const res = await request
        .get(`${BASE}/path?warehouseId=wh-1&items=[{"itemId":"i1","quantity":1}]`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/pick-optimizer/waves', () => {
    it('returns 201 on create wave', async () => {
      vi.mocked(waveService.createWave).mockResolvedValue({ id: 'wave-new' } as any);

      const res = await request
        .post(`${BASE}/waves`)
        .set('Authorization', `Bearer ${token}`)
        .send({ warehouseId: 'wh-1', miIds: ['mi-1', 'mi-2'] });

      expect(res.status).toBe(201);
      expect(waveService.createWave).toHaveBeenCalledWith('wh-1', ['mi-1', 'mi-2']);
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request
        .post(`${BASE}/waves`)
        .set('Authorization', `Bearer ${token}`)
        .send({ warehouseId: 'wh-1' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/pick-optimizer/waves', () => {
    it('returns 200 with wave list', async () => {
      vi.mocked(waveService.getWaves).mockReturnValue([{ id: 'wave-1' }] as any);

      const res = await request.get(`${BASE}/waves`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/pick-optimizer/waves/:id/start', () => {
    it('returns 200 on start picking', async () => {
      vi.mocked(waveService.startPicking).mockReturnValue({ id: 'wave-1', status: 'picking' } as any);

      const res = await request.post(`${BASE}/waves/wave-1/start`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(waveService.startPicking).toHaveBeenCalledWith('wave-1');
    });
  });
});
