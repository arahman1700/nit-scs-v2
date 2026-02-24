import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

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
      get: (_target: unknown, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/staging.service.js', () => ({
  listStagingZones: vi.fn().mockResolvedValue([]),
  listAssignments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createAssignment: vi.fn().mockResolvedValue({ id: 'sa1' }),
  moveFromStaging: vi.fn().mockResolvedValue({ id: 'sa1', status: 'moved' }),
  getOverstayAlerts: vi.fn().mockResolvedValue([]),
  getStagingOccupancy: vi.fn().mockResolvedValue([]),
}));

import * as stagingService from '../services/staging.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/staging';

describe('Staging Routes', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    viewerToken = signTestToken({ userId: 'viewer-id', systemRole: 'viewer' });
  });

  // GET /staging/zones
  describe('GET /staging/zones', () => {
    it('returns 200 with zones', async () => {
      const res = await request.get(`${BASE}/zones?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stagingService.listStagingZones).toHaveBeenCalledWith('wh1');
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/zones`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request.get(`${BASE}/zones?warehouseId=wh1`).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // GET /staging/alerts
  describe('GET /staging/alerts', () => {
    it('returns 200 with alerts', async () => {
      const res = await request.get(`${BASE}/alerts?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stagingService.getOverstayAlerts).toHaveBeenCalledWith('wh1');
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/alerts`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  // GET /staging/occupancy
  describe('GET /staging/occupancy', () => {
    it('returns 200 with occupancy', async () => {
      const res = await request.get(`${BASE}/occupancy?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stagingService.getStagingOccupancy).toHaveBeenCalledWith('wh1');
    });
  });

  // GET /staging
  describe('GET /staging', () => {
    it('returns 200 with list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stagingService.listAssignments).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // POST /staging
  describe('POST /staging', () => {
    const validBody = {
      zoneId: 'z1',
      warehouseId: 'wh1',
      itemId: 'i1',
      sourceDocType: 'grn',
      sourceDocId: 'd1',
      quantity: 10,
      direction: 'inbound',
    };

    it('returns 201 on success', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send(validBody);
      expect(res.status).toBe(201);
      expect(stagingService.createAssignment).toHaveBeenCalled();
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid sourceDocType', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody, sourceDocType: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid direction', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validBody, direction: 'sideways' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${viewerToken}`).send(validBody);
      expect(res.status).toBe(403);
    });
  });

  // POST /staging/:id/move
  describe('POST /staging/:id/move', () => {
    it('returns 200 on move', async () => {
      const res = await request.post(`${BASE}/sa1/move`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(stagingService.moveFromStaging).toHaveBeenCalledWith('sa1', 'test-user-id');
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request.post(`${BASE}/sa1/move`).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });
});
